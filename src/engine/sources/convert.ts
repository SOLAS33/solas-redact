import { openPdf } from "./pdfSource";
import { openImage } from "./imageSource";
import { docFromBlocks, type Block } from "./layout";
import { parseEml } from "./email";
import type { SourceDoc } from "../types";

export const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.txt,.csv,.tsv,.log,.md,.eml,.docx";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif"]);
const TEXT_EXT = new Set(["txt", "csv", "tsv", "log", "md"]);
const NEEDS_SAVE_AS_PDF: Record<string, string> = {
  doc: "Word 97-2003 (.doc)",
  xls: "Excel (.xls)",
  xlsx: "Excel (.xlsx)",
  ppt: "PowerPoint (.ppt)",
  pptx: "PowerPoint (.pptx)",
  msg: "Outlook message (.msg)",
  rtf: "Rich Text (.rtf)",
  odt: "OpenDocument text (.odt)",
  ods: "OpenDocument spreadsheet (.ods)",
  odp: "OpenDocument presentation (.odp)",
  heic: "HEIC photo (.heic)",
  tif: "TIFF (.tif)",
  tiff: "TIFF (.tiff)",
  svg: "SVG (.svg)",
  html: "Web page (.html)",
  htm: "Web page (.htm)",
};

export class Unsupported extends Error {}

export function extOf(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name);
  return m ? m[1].toLowerCase() : "";
}

export function baseName(name: string): string {
  return name.replace(/\.[A-Za-z0-9]+$/, "");
}

function startsWith(b: Uint8Array, sig: string): boolean {
  for (let i = 0; i < sig.length; i++) if (b[i] !== sig.charCodeAt(i)) return false;
  return true;
}

/** Decode a text file: UTF-8 (with or without BOM), UTF-16 with BOM, else Windows-1252. */
export function decodeText(b: Uint8Array): string {
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(b.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(b).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(b);
  }
}

function emailBlocks(bytes: Uint8Array): { blocks: Block[]; notes: string[] } {
  const e = parseEml(bytes);
  const want = ["From", "To", "Cc", "Bcc", "Subject", "Date"];
  const blocks: Block[] = [];
  for (const k of want) {
    const v = e.headers.find(([n]) => n.toLowerCase() === k.toLowerCase())?.[1];
    if (v) blocks.push({ text: `${k}: ${v}`, bold: k === "Subject", size: k === "Subject" ? 12 : 10.5 });
  }
  blocks.push({ text: "", before: 8 });
  blocks.push({ text: e.body || "(no readable text in this message)", pre: true, before: 4 });
  const notes = ["Converted from an email: the main headers and the readable text are kept. Other headers and formatting are left out."];
  if (e.attachments.length) notes.push(`${e.attachments.length} attachment(s) are not included (${e.attachments.slice(0, 5).join(", ")}${e.attachments.length > 5 ? ", ..." : ""}). Redact them separately.`);
  if (e.htmlOnly) notes.push("This message has no plain-text version, so the text was taken from its HTML.");
  return { blocks, notes };
}

async function docxBlocks(bytes: Uint8Array): Promise<{ blocks: Block[]; notes: string[] }> {
  const { default: mammoth } = await import("mammoth/mammoth.browser");
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  // Pictures are counted, not converted, so large images never enter memory twice.
  const res = await mammoth.convertToHtml({ arrayBuffer: ab }, { convertImage: mammoth.images.imgElement(async () => ({ src: "" })), ignoreEmptyParagraphs: true });
  const dom = new DOMParser().parseFromString(res.value, "text/html");
  const blocks: Block[] = [];
  let images = 0;
  const visit = (el: Element, indent: number) => {
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      blocks.push({ text: el.textContent ?? "", bold: true, size: [18, 15, 13, 12, 11, 11][level - 1], before: 10 });
    } else if (tag === "p") {
      images += el.querySelectorAll("img").length;
      const t = el.textContent ?? "";
      blocks.push({ text: t, indent, before: 5, bold: !!t && [...el.childNodes].every((n) => n.nodeName === "STRONG") });
    } else if (tag === "ul" || tag === "ol") {
      [...el.children].forEach((li, i) => {
        const own = [...li.childNodes].filter((n) => !/^(UL|OL)$/.test(n.nodeName)).map((n) => n.textContent ?? "").join("");
        blocks.push({ text: `${tag === "ol" ? `${i + 1}.` : "•"} ${own}`, indent: indent + 14, before: 2 });
        li.querySelectorAll(":scope > ul, :scope > ol").forEach((sub) => visit(sub, indent + 14));
      });
    } else if (tag === "table") {
      blocks.push({ text: "", before: 4 });
      el.querySelectorAll("tr").forEach((tr) => {
        const cells = [...tr.children].map((c) => (c.textContent ?? "").replace(/\s+/g, " ").trim());
        blocks.push({ text: cells.join("  |  "), indent });
      });
    } else if (tag === "img") {
      images += 1;
    } else {
      [...el.children].forEach((c) => visit(c, indent));
    }
  };
  [...dom.body.children].forEach((c) => visit(c, 0));
  if (!blocks.some((b) => b.text.trim())) blocks.push({ text: "(no readable text found in this document)" });
  const notes = [
    "Converted from Word as a plain text version. Fonts, page layout and images are not kept, and headers, footers and comments may be missing. Compare it with the original before you rely on it.",
  ];
  if (images) notes.push(`${images} picture(s) in the document are not in the copy. Redact pictures from the original if they need it.`);
  return { blocks, notes };
}

export interface OpenResult {
  doc: SourceDoc;
}

/** Open any accepted file as a document of pages. Throws Unsupported with a plain explanation when it cannot. */
export async function openAny(file: File, bytes: Uint8Array, password?: string): Promise<SourceDoc> {
  const ext = extOf(file.name);
  const isPdf = new TextDecoder("latin1").decode(bytes.subarray(0, 1024)).includes("%PDF-");
  if (isPdf) return openPdf(file.name, bytes, password);
  if (ext === "pdf") throw new Unsupported("This file is named .pdf but is not a PDF. It may be damaged or may be another kind of file renamed.");
  const imageMagic =
    (bytes[0] === 0x89 && startsWith(bytes.subarray(1), "PNG")) ||
    (bytes[0] === 0xff && bytes[1] === 0xd8) ||
    startsWith(bytes, "GIF8") ||
    startsWith(bytes, "BM") ||
    (startsWith(bytes, "RIFF") && startsWith(bytes.subarray(8), "WEBP")) ||
    (startsWith(bytes.subarray(4), "ftyp") && /avif|avis/.test(new TextDecoder("latin1").decode(bytes.subarray(8, 16))));
  if (IMAGE_EXT.has(ext) || imageMagic) return openImage(file.name, new Blob([bytes as BlobPart]));
  if (ext === "docx") {
    if (!startsWith(bytes, "PK")) throw new Unsupported("This file is named .docx but is not a Word document.");
    const { blocks, notes } = await docxBlocks(bytes);
    return docFromBlocks("docx", file.name, blocks, notes);
  }
  if (ext === "eml") {
    const { blocks, notes } = emailBlocks(bytes);
    return docFromBlocks("email", file.name, blocks, notes);
  }
  if (TEXT_EXT.has(ext)) {
    const text = decodeText(bytes);
    if (text.length > 6_000_000) throw new Unsupported("This text file is larger than 6 MB. Split it into smaller files.");
    return docFromBlocks("text", file.name, [{ text, mono: true, pre: true }], ["Converted from plain text and laid out in a fixed-width font."]);
  }
  const known = NEEDS_SAVE_AS_PDF[ext];
  if (known) {
    throw new Unsupported(`${known} cannot be converted here yet. Open it in its own program, choose Save as PDF (or Print, then Microsoft Print to PDF), and add the PDF instead.`);
  }
  throw new Unsupported("Ebon cannot read this kind of file. Accepted: PDF, pictures (PNG, JPEG, WebP, GIF, BMP), Word .docx, email .eml, and text files.");
}
