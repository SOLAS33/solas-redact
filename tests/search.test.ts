import { describe, expect, it } from "vitest";
import { foldText, termToRegex, findOnPage, mergeLineRects, buildPageText, normText } from "../src/engine/search";
import { PATTERNS, ibanValid, luhn } from "../src/engine/patterns";
import type { FindOptions, TextItem } from "../src/engine/types";
import { parseEml, decodeWords } from "../src/engine/sources/email";
import { decodeText } from "../src/engine/sources/convert";

const base: FindOptions = { terms: [], wholeWord: true, caseSensitive: false, ignoreAccents: true, patterns: [], ocr: false };

function item(str: string, ox: number, oy: number, w: number, fs = 10, eol = true): TextItem {
  return { str, ox, oy, ux: 1, uy: 0, vx: 0, vy: -1, w, fs, eol };
}

describe("folding", () => {
  it("keeps the length and folds accents and case", () => {
    const s = "Seán Ó Murchú, İstanbul ß";
    const f = foldText(s, { caseSensitive: false, ignoreAccents: true });
    expect(f.length).toBe(s.length);
    expect(f.startsWith("sean o murchu")).toBe(true);
  });
  it("normText drops punctuation and spacing", () => {
    expect(normText("Seán  Murphy-Ó'Brien")).toBe("seanmurphyobrien");
  });
});

describe("terms", () => {
  it("matches whole words only when asked", () => {
    const re = termToRegex("Ann", base)!;
    expect("ann and annie".match(re)?.length).toBe(1);
    const loose = termToRegex("Ann", { ...base, wholeWord: false })!;
    expect("ann and annie".match(loose)?.length).toBe(2);
  });
  it("treats spaces in a term as any whitespace", () => {
    expect(termToRegex("John Smith", base)!.test("john \n  smith")).toBe(true);
  });
  it("escapes punctuation and rejects broken patterns", () => {
    expect(termToRegex("a.b", { ...base, wholeWord: false })!.test("axb")).toBe(false);
    expect(termToRegex("/(unclosed/", base)).toBeNull();
  });
});

describe("patterns", () => {
  const find = (id: string, text: string) => {
    const def = PATTERNS.find((p) => p.id === id)!;
    return [...text.matchAll(new RegExp(def.regex.source, def.regex.flags))].map((m) => m[0]).filter((m) => !def.validate || def.validate(m));
  };
  it("validates cards with Luhn and IBANs with mod 97", () => {
    expect(luhn("4111 1111 1111 1111")).toBe(true);
    expect(luhn("4111 1111 1111 1112")).toBe(false);
    expect(ibanValid("IE29 AIBK 9311 5212 3456 78")).toBe(true);
    expect(ibanValid("IE29 AIBK 9311 5212 3456 79")).toBe(false);
  });
  it("finds emails, PPS numbers, Eircodes, phones, IPs, IBANs and cards", () => {
    expect(find("email", "write to sean.obrien+x@mail.example.ie now")).toEqual(["sean.obrien+x@mail.example.ie"]);
    expect(find("pps", "PPS 1234567TA and 7654321B, not 12345678 or 123456TA")).toEqual(["1234567TA", "7654321B"]);
    expect(find("eircode", "D02 X285, A65 F4E2 and T12AB34 but not O12 ABCD")).toEqual(["D02 X285", "A65 F4E2", "T12AB34"]);
    expect(find("phone", "ring 087 123 4567 or +353 1 234 5678 or 01 234 5678")).toEqual(["087 123 4567", "+353 1 234 5678", "01 234 5678"]);
    expect(find("ip", "from 192.168.1.20 and 999.1.1.1")).toEqual(["192.168.1.20"]);
    expect(find("iban", "IBAN IE29 AIBK 9311 5212 3456 78 and IE00 AIBK 9311 5212 3456 78")).toEqual(["IE29 AIBK 9311 5212 3456 78"]);
    expect(find("card", "card 4111 1111 1111 1111, ref 1234 5678 9012 3456")).toEqual(["4111 1111 1111 1111"]);
  });
});

describe("finding on a page", () => {
  it("puts the box over just the matched characters", () => {
    const items = [item("Hello John Smith here", 100, 200, 210)];
    const r = findOnPage(0, 595, 842, items, { ...base, terms: ["John Smith"] });
    expect(r).toHaveLength(1);
    const box = r[0].rect;
    // "John Smith" starts 6 of 21 characters in and ends 16 of 21 in
    expect(box.x).toBeGreaterThan(100 + 210 * (6 / 21) - 4);
    expect(box.x).toBeLessThan(100 + 210 * (6 / 21) + 0.1);
    expect(box.x + box.w).toBeGreaterThan(100 + 210 * (16 / 21));
    expect(box.y).toBeLessThan(200 - 9);
    expect(box.y + box.h).toBeGreaterThan(200 + 3);
    expect(r[0].text).toBe("John Smith");
    expect(r[0].accepted).toBe(true);
  });
  it("finds a name split over two runs and joins the boxes", () => {
    const items = [item("John", 100, 200, 24, 10, false), item("Smith", 128, 200, 30, 10, true)];
    const r = findOnPage(0, 595, 842, items, { ...base, terms: ["john smith"] });
    expect(r).toHaveLength(1);
    expect(r[0].rect.x).toBeLessThanOrEqual(100);
    expect(r[0].rect.x + r[0].rect.w).toBeGreaterThanOrEqual(158);
  });
  it("matches across a line break only when the term has whitespace there", () => {
    const items = [item("John", 100, 200, 24), item("Smith", 100, 214, 30)];
    expect(findOnPage(0, 595, 842, items, { ...base, terms: ["john smith"] })).toHaveLength(2);
    expect(findOnPage(0, 595, 842, items, { ...base, terms: ["johnsmith"] })).toHaveLength(0);
  });
  it("uses the whole box for form fields and scanned words", () => {
    const whole = { x: 50, y: 60, w: 100, h: 14 };
    const items: TextItem[] = [{ ...item("jo@x.ie", 50, 74, 100, 14), whole }];
    const r = findOnPage(0, 595, 842, items, { ...base, patterns: ["email"] });
    expect(r).toHaveLength(1);
    expect(r[0].rect.x).toBeLessThan(50);
    expect(r[0].rect.w).toBeGreaterThan(100);
  });
  it("merges overlapping hits from different rules into one box", () => {
    const items = [item("mail jo@x.ie now", 0, 20, 160)];
    const r = findOnPage(0, 595, 842, items, { ...base, terms: ["jo@x.ie", "x.ie"], wholeWord: false, patterns: ["email"] });
    expect(r).toHaveLength(1);
  });
  it("builds page text with line breaks", () => {
    expect(buildPageText([item("a", 0, 10, 5), item("b", 0, 30, 5)]).text).toBe("a\nb");
  });
  it("merges boxes on the same line only", () => {
    const m = mergeLineRects([
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 11, y: 0, w: 10, h: 10 },
      { x: 0, y: 30, w: 10, h: 10 },
    ]);
    expect(m).toHaveLength(2);
  });
});

describe("email and text decoding", () => {
  it("reads headers, quoted-printable bodies and attachment names", () => {
    const raw = [
      "From: =?UTF-8?B?U2XDoW4=?= <sean@example.ie>",
      "Subject: Hello =?utf-8?Q?caf=C3=A9?=",
      'Content-Type: multipart/mixed; boundary="XX"',
      "",
      "--XX",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "Caf=C3=A9 and =\r\nmore",
      "--XX",
      'Content-Type: application/pdf; name="secret.pdf"',
      'Content-Disposition: attachment; filename="secret.pdf"',
      "Content-Transfer-Encoding: base64",
      "",
      "JVBERi0=",
      "--XX--",
      "",
    ].join("\r\n");
    const e = parseEml(new TextEncoder().encode(raw));
    expect(e.headers.find(([k]) => k === "From")![1]).toContain("Seán");
    expect(e.headers.find(([k]) => k === "Subject")![1]).toBe("Hello café");
    expect(e.body).toBe("Café and more");
    expect(e.attachments).toEqual(["secret.pdf"]);
    expect(decodeWords("=?utf-8?B?SGk=?= =?utf-8?B?IHRoZXJl?=")).toBe("Hi there");
  });
  it("decodes text files in several encodings", () => {
    expect(decodeText(new TextEncoder().encode("Seán"))).toBe("Seán");
    expect(decodeText(Uint8Array.from([0x53, 0x65, 0xe1, 0x6e]))).toBe("Seán");
    expect(decodeText(Uint8Array.from([0xff, 0xfe, 0x53, 0x00, 0xe1, 0x00]))).toBe("Sá");
  });
});
