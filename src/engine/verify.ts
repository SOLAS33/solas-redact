import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef, PDFStream, decodePDFRawStream } from "pdf-lib";
import { openPdf } from "./sources/pdfSource";
import { ocrText, OCR_DPI } from "./ocr";
import { scaleFor, type FlatPage } from "./flatten";
import { normText } from "./search";
import type { Check, VerifyReport } from "./types";

export interface VerifyInput {
  bytes: Uint8Array;
  pages: FlatPage[];
  /** Strings that must not appear anywhere in the output file: the redacted text and the original metadata. */
  forbidden: string[];
  /** For the deep check: per page, how many times each (folded) text may still be readable because the reviewer chose to keep it. */
  allowed: Array<Map<string, number>>;
  deep: boolean;
}

const BANNED_KEYS = ["Annots", "AcroForm", "Metadata", "OpenAction", "AA", "JS", "JavaScript", "EmbeddedFile", "EmbeddedFiles", "Names", "Outlines", "StructTreeRoot", "URI", "Dests", "Thumb", "PieceInfo", "Encrypt", "Font", "FontDescriptor"];
const ALLOWED_INFO = new Set(["Producer", "Creator", "CreationDate", "ModDate"]);
const ALLOWED_CATALOG = new Set(["Type", "Pages"]);
const ALLOWED_PAGE = new Set(["Type", "Parent", "MediaBox", "Contents", "Resources"]);
const ALLOWED_OPS = new Set(["q", "Q", "cm", "Do"]);

const latin1 = (b: Uint8Array) => {
  // chunked so very large files do not overflow the argument limit
  const parts: string[] = [];
  for (let i = 0; i < b.length; i += 1 << 16) parts.push(String.fromCharCode(...b.subarray(i, Math.min(b.length, i + (1 << 16)))));
  return parts.join("");
};

function encodings(s: string): string[] {
  const utf8 = latin1(new TextEncoder().encode(s));
  const utf16be = "\0" + [...s].map((c) => c).join("\0");
  return [...new Set([s, utf8, utf16be])].map((x) => x.toLowerCase());
}

function keysOf(d: PDFDict): string[] {
  return d.keys().map((k) => k.asString().replace(/^\//, ""));
}

/** pdf-lib writes empty /Annots, /Font and /ExtGState containers on its own pages. Only a container with something in it counts. */
function filled(d: PDFDict, key: string): boolean {
  const v = d.lookup(PDFName.of(key));
  if (v instanceof PDFArray) return v.size() > 0;
  if (v instanceof PDFDict) return v.keys().length > 0;
  return true;
}

/**
 * Reads the raw objects of the finished file. It does not use pdf-lib's page API, because that API quietly adds empty
 * annotation and font entries to every page it touches, which would hide or fake what is really in the file.
 */
function structureCheck(doc: PDFDocument, expectedPages: number): Check[] {
  const problems: string[] = [];
  for (const k of keysOf(doc.catalog)) if (!ALLOWED_CATALOG.has(k)) problems.push(`document has /${k}`);
  const info = doc.context.trailerInfo.Info;
  const infoDict = info ? doc.context.lookup(info, PDFDict) : undefined;
  const infoProblems: string[] = [];
  if (infoDict) for (const k of keysOf(infoDict)) if (!ALLOWED_INFO.has(k)) infoProblems.push(k);
  if (doc.context.trailerInfo.Encrypt) problems.push("file is encrypted");

  let pageCount = 0;
  let imageCount = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFStream ? obj.dict : obj instanceof PDFDict ? obj : null;
    if (!dict) continue;
    for (const k of keysOf(dict)) if (BANNED_KEYS.includes(k) && filled(dict, k)) problems.push(`file contains /${k}`);
    const type = dict.get(PDFName.of("Type"))?.toString();
    if (obj instanceof PDFStream && dict.get(PDFName.of("Subtype"))?.toString() === "/Image") imageCount += 1;
    if (type !== "/Page") continue;
    pageCount += 1;
    for (const k of keysOf(dict)) if (!ALLOWED_PAGE.has(k) && filled(dict, k)) problems.push(`page ${pageCount} has /${k}`);
    const res = dict.lookupMaybe(PDFName.of("Resources"), PDFDict);
    if (res) {
      for (const k of keysOf(res)) if (k !== "XObject" && k !== "ProcSet" && filled(res, k)) problems.push(`page ${pageCount} resources include /${k}`);
      const xo = res.lookupMaybe(PDFName.of("XObject"), PDFDict);
      for (const [, ref] of xo ? xo.entries() : []) {
        const target = ref instanceof PDFRef ? doc.context.lookup(ref) : ref;
        if (!(target instanceof PDFStream) || target.dict.get(PDFName.of("Subtype"))?.toString() !== "/Image") problems.push(`page ${pageCount} has an object that is not a picture`);
      }
    }
    // The page content may only place pictures: no text operators.
    const c = dict.lookup(PDFName.of("Contents"));
    const streams: PDFRawStream[] = [];
    if (c instanceof PDFRawStream) streams.push(c);
    else if (c instanceof PDFArray)
      for (let n = 0; n < c.size(); n++) {
        const s = c.lookup(n);
        if (s instanceof PDFRawStream) streams.push(s);
      }
    for (const s of streams) {
      const text = latin1(decodePDFRawStream(s).decode());
      for (const tok of text.split(/\s+/).filter(Boolean)) {
        if (/^[-+]?[\d.]+$/.test(tok) || tok.startsWith("/") || ALLOWED_OPS.has(tok)) continue;
        problems.push(`page ${pageCount} content has operator "${tok.slice(0, 12)}"`);
        break;
      }
    }
  }
  if (pageCount !== expectedPages) problems.push(`${pageCount} page object(s), expected ${expectedPages}`);
  return [
    {
      id: "structure",
      label: "The file contains only page pictures",
      ok: problems.length === 0 && imageCount >= pageCount && pageCount > 0,
      detail: problems.length ? [...new Set(problems)].slice(0, 4).join("; ") : `${pageCount} page(s), ${imageCount} picture(s), no fonts, text, forms, links, scripts, attachments or bookmarks`,
    },
    {
      id: "metadata",
      label: "No original metadata is carried over",
      ok: infoProblems.length === 0,
      detail: infoProblems.length ? `Unexpected entries: ${infoProblems.join(", ")}` : "Only the Solas Redact producer name and the new file dates are present",
    },
  ];
}

export async function verify(input: VerifyInput, onProgress?: (msg: string) => void): Promise<VerifyReport> {
  const checks: Check[] = [];
  const { bytes, pages } = input;

  // 1. Open the finished file with a separate pass of the PDF reader and compare it with what was meant to be written.
  onProgress?.("Opening the finished file");
  const reopened = await openPdf("check.pdf", bytes.slice());
  try {
    const sizeBad: string[] = [];
    if (reopened.pageCount !== pages.length) sizeBad.push(`page count ${reopened.pageCount}, expected ${pages.length}`);
    let chars = 0;
    let annots = 0;
    const boxFail: string[] = [];
    let boxesChecked = 0;
    for (let i = 0; i < Math.min(reopened.pageCount, pages.length); i++) {
      const p = await reopened.getPage(i);
      if (Math.abs(p.widthPt - pages[i].widthPt) > 0.05 || Math.abs(p.heightPt - pages[i].heightPt) > 0.05) sizeBad.push(`page ${i + 1} size differs`);
      chars += p.charCount;
      annots += p.notes.length;
      if (pages[i].boxes.length) {
        // 2. Render the finished page and look at the pixels under every black box.
        const scale = Math.min(2, scaleFor(p.widthPt, p.heightPt, 144).scale);
        const canvas = document.createElement("canvas");
        await p.render(canvas, scale);
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        for (const b of pages[i].boxes) {
          const x0 = Math.ceil(b.x * scale) + 1;
          const y0 = Math.ceil(b.y * scale) + 1;
          const x1 = Math.floor((b.x + b.w) * scale) - 1;
          const y1 = Math.floor((b.y + b.h) * scale) - 1;
          if (x1 <= x0 || y1 <= y0) continue;
          const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
          let max = 0;
          for (let k = 0; k < d.length; k += 4) max = Math.max(max, d[k], d[k + 1], d[k + 2]);
          boxesChecked += 1;
          if (max > 48) boxFail.push(`page ${i + 1}`);
        }
        canvas.width = canvas.height = 0;
      }
      onProgress?.(`Checked page ${i + 1} of ${pages.length}`);
    }
    checks.push({
      id: "pages",
      label: "Page count and page sizes match",
      ok: sizeBad.length === 0,
      detail: sizeBad.length ? sizeBad.slice(0, 3).join("; ") : `${pages.length} page(s)`,
    });
    checks.push({
      id: "text",
      label: "No readable text is left in the file",
      ok: chars === 0 && annots === 0,
      detail: chars === 0 && annots === 0 ? "A text search of every page finds nothing, and there are no annotations or form fields" : `${chars} character(s) of text and ${annots} annotation note(s) found`,
    });
    checks.push({
      id: "boxes",
      label: "Every black box is solid black",
      ok: boxFail.length === 0,
      detail: boxFail.length ? `Not fully black on: ${[...new Set(boxFail)].slice(0, 5).join(", ")}` : `${boxesChecked} box(es) checked by reading the pixels of the finished pages`,
    });
  } finally {
    reopened.destroy();
  }

  // 3. The file's structure, read with a different library.
  onProgress?.("Checking the file structure");
  try {
    const lib = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: false });
    checks.push(...structureCheck(lib, pages.length));
  } catch (e) {
    checks.push({ id: "structure", label: "The file contains only page pictures", ok: false, detail: `Could not read the file structure: ${(e as Error).message}` });
  }

  // 4. Search the raw bytes for the redacted text and the original metadata.
  onProgress?.("Searching the file for hidden text");
  const hay = latin1(bytes).toLowerCase();
  const found: number[] = [];
  const needles = [...new Set(input.forbidden.map((s) => s.trim()).filter((s) => s.length >= 4))];
  for (const s of needles) if (encodings(s).some((e) => hay.includes(e))) found.push(1);
  checks.push({
    id: "bytes",
    label: "Redacted text and original metadata are not in the file",
    ok: found.length === 0,
    detail: found.length ? `${found.length} of ${needles.length} protected string(s) were found in the raw file` : `${needles.length} protected string(s) searched for in the raw bytes, none found`,
  });

  // 5. Optional deep check: read the finished pages like a person would and look for the hidden words.
  if (input.deep) {
    const leaks: string[] = [];
    let pagesRead = 0;
    const reopened2 = await openPdf("check2.pdf", bytes.slice());
    try {
      for (let i = 0; i < pages.length; i++) {
        const allowed = input.allowed[i];
        if (!allowed || !pages[i].boxes.length) continue;
        onProgress?.(`Reading page ${i + 1} to look for hidden words`);
        const p = await reopened2.getPage(i);
        const canvas = document.createElement("canvas");
        await p.render(canvas, scaleFor(p.widthPt, p.heightPt, OCR_DPI).scale);
        const read = normText(await ocrText(canvas));
        canvas.width = canvas.height = 0;
        pagesRead += 1;
        for (const [needle, ok] of allowed) {
          if (needle.length < 4) continue;
          let n = 0;
          for (let at = read.indexOf(needle); at >= 0; at = read.indexOf(needle, at + 1)) n += 1;
          if (n > ok) leaks.push(`page ${i + 1}`);
        }
      }
    } finally {
      reopened2.destroy();
    }
    checks.push({
      id: "deep",
      label: "Reading the finished pages finds none of the hidden words",
      ok: leaks.length === 0,
      detail: leaks.length ? `A hidden word is still readable on: ${[...new Set(leaks)].slice(0, 5).join(", ")}` : `${pagesRead} page(s) with redactions read by text recognition`,
    });
  }

  return { ok: checks.every((c) => c.ok), checks };
}
