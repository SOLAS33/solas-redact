/** Small .eml reader: headers, the readable body, and the names (not contents) of attachments. */

export interface ParsedEmail {
  headers: Array<[string, string]>;
  body: string;
  attachments: string[];
  htmlOnly: boolean;
}

function latin1(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return s;
}

function toBytes(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255;
  return b;
}

function decodeCharset(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder((charset || "utf-8").toLowerCase()).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function qpBytes(s: string): Uint8Array {
  const t = s.replace(/=\r?\n/g, "");
  const out: number[] = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) {
      out.push(parseInt(t.slice(i + 1, i + 3), 16));
      i += 2;
    } else out.push(t.charCodeAt(i) & 255);
  }
  return Uint8Array.from(out);
}

function b64Bytes(s: string): Uint8Array {
  try {
    return toBytes(atob(s.replace(/[^A-Za-z0-9+/=]/g, "")));
  } catch {
    return new Uint8Array();
  }
}

/** RFC 2047 encoded words in header values, for example =?utf-8?B?...?= */
export function decodeWords(v: string): string {
  return v
    .replace(/(\?=)\s+(=\?)/g, "$1$2")
    .replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_m, cs: string, enc: string, text: string) => {
      const bytes = enc.toLowerCase() === "b" ? b64Bytes(text) : qpBytes(text.replace(/_/g, " "));
      return decodeCharset(bytes, cs);
    });
}

function splitHeaders(raw: string): { head: Array<[string, string]>; body: string } {
  const m = /\r?\n\r?\n/.exec(raw);
  const headText = m ? raw.slice(0, m.index) : raw;
  const body = m ? raw.slice(m.index + m[0].length) : "";
  const unfolded = headText.replace(/\r?\n[ \t]+/g, " ");
  const head: Array<[string, string]> = [];
  for (const line of unfolded.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) head.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
  return { head, body };
}

function param(v: string, name: string): string {
  const m = new RegExp(`${name}\\*?=\\s*(?:"([^"]*)"|([^;\\s]+))`, "i").exec(v);
  return m ? (m[1] ?? m[2] ?? "") : "";
}

function htmlToText(html: string): string {
  const d = new DOMParser().parseFromString(html, "text/html");
  d.querySelectorAll("script,style").forEach((n) => n.remove());
  d.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
  d.querySelectorAll("p,div,tr,li,h1,h2,h3,h4,h5,h6").forEach((n) => n.append("\n"));
  return (d.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

interface Walk {
  text: string[];
  html: string[];
  attachments: string[];
}

function walk(raw: string, acc: Walk): Array<[string, string]> {
  const { head, body } = splitHeaders(raw);
  const get = (n: string) => head.find(([k]) => k.toLowerCase() === n)?.[1] ?? "";
  const ctype = get("content-type") || "text/plain";
  const type = ctype.split(";")[0].trim().toLowerCase();
  const disp = get("content-disposition");
  const filename = decodeWords(param(disp, "filename") || param(ctype, "name"));
  if (type.startsWith("multipart/")) {
    const boundary = param(ctype, "boundary");
    if (boundary) {
      const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:--)?\\r?\\n?`));
      for (const p of parts.slice(1)) if (p.trim()) walk(p.replace(/^\r?\n/, ""), acc);
    }
    return head;
  }
  if (/attachment/i.test(disp) || (filename && !type.startsWith("text/"))) {
    acc.attachments.push(filename || type);
    return head;
  }
  const enc = get("content-transfer-encoding").toLowerCase();
  const bytes = enc.includes("base64") ? b64Bytes(body) : enc.includes("quoted-printable") ? qpBytes(body) : toBytes(body);
  const text = decodeCharset(bytes, param(ctype, "charset"));
  if (type === "text/plain") acc.text.push(text);
  else if (type === "text/html") acc.html.push(text);
  else if (filename) acc.attachments.push(filename);
  return head;
}

export function parseEml(data: Uint8Array): ParsedEmail {
  const raw = latin1(data);
  const acc: Walk = { text: [], html: [], attachments: [] };
  const head = walk(raw, acc);
  const htmlOnly = !acc.text.length && acc.html.length > 0;
  const body = (acc.text.length ? acc.text : acc.html.map(htmlToText)).join("\n\n").trim();
  return {
    headers: head.map(([k, v]) => [k, decodeWords(v)] as [string, string]),
    body,
    attachments: acc.attachments,
    htmlOnly,
  };
}
