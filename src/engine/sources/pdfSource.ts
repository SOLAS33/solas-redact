import { PDFJS_ASSETS, pdfjs } from "../pdfjs";
import { measureOffsets } from "../measure";
import type { Rect, SourceDoc, SourcePage, TextItem } from "../types";

export class PasswordNeeded extends Error {
  constructor(public wrong: boolean) {
    super(wrong ? "That password is not right." : "This PDF is protected by a password.");
  }
}

type PDFDocumentProxy = Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
type PDFPageProxy = Awaited<ReturnType<PDFDocumentProxy["getPage"]>>;

// Annotation types whose text is drawn on the page and so can hold something to hide.
const VISIBLE_TEXT_ANNOTATIONS = new Set(["FreeText", "Widget"]);

async function readMeta(doc: PDFDocumentProxy): Promise<string[]> {
  const out: string[] = [];
  try {
    const m = await doc.getMetadata();
    for (const [k, v] of Object.entries((m.info ?? {}) as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim().length >= 4 && !/^D:\d/.test(v) && k !== "PDFFormatVersion") out.push(v.trim());
    }
    const xmp = m.metadata as { getAll?: () => Record<string, unknown> } | null;
    if (xmp?.getAll) {
      for (const v of Object.values(xmp.getAll())) if (typeof v === "string" && v.trim().length >= 4) out.push(v.trim());
    }
  } catch {
    /* metadata unreadable: nothing to add */
  }
  return [...new Set(out)];
}

export async function openPdf(name: string, data: Uint8Array, password?: string): Promise<SourceDoc> {
  const task = pdfjs.getDocument({ data, password, ...PDFJS_ASSETS } as Parameters<typeof pdfjs.getDocument>[0]);
  let doc: PDFDocumentProxy;
  try {
    doc = await task.promise;
  } catch (e) {
    const err = e as { name?: string; code?: number };
    if (err?.name === "PasswordException") throw new PasswordNeeded(err.code === 2);
    throw e;
  }
  const notes: string[] = [];
  try {
    const att = await doc.getAttachments();
    if (att && Object.keys(att).length) notes.push(`${Object.keys(att).length} attached file(s) will be left out of the copy.`);
  } catch {
    /* ignore */
  }
  const metaStrings = await readMeta(doc);

  const getPage = async (index: number): Promise<SourcePage> => {
    const page: PDFPageProxy = await doc.getPage(index + 1);
    const vp = page.getViewport({ scale: 1 });
    const widthPt = vp.width;
    const heightPt = vp.height;
    const pageNotes: string[] = [];
    const items: TextItem[] = [];
    let charCount = 0;

    // Loading the page's fonts into the document lets us measure real glyph widths. A tiny render does that.
    const probe = document.createElement("canvas");
    const pvp = page.getViewport({ scale: 0.05 });
    probe.width = Math.max(1, Math.ceil(pvp.width));
    probe.height = Math.max(1, Math.ceil(pvp.height));
    try {
      await page.render({ canvas: probe, viewport: pvp }).promise;
    } catch {
      /* measuring falls back to system fonts */
    }
    probe.width = probe.height = 0;

    const tc = await page.getTextContent();
    const styles = tc.styles as Record<string, { fontFamily?: string }>;
    for (const raw of tc.items) {
      if (!("str" in raw) || !raw.str) continue;
      const tx = pdfjs.Util.transform(vp.transform, raw.transform) as number[];
      const lu = Math.hypot(tx[0], tx[1]) || 1;
      const lv = Math.hypot(tx[2], tx[3]) || 1;
      const fs = lv;
      const family = styles[raw.fontName]?.fontFamily || "sans-serif";
      const str = raw.str;
      const w = raw.width || 0;
      charCount += str.replace(/\s/g, "").length;
      let cache: number[] | null = null;
      items.push({
        str,
        ox: tx[4],
        oy: tx[5],
        ux: tx[0] / lu,
        uy: tx[1] / lu,
        vx: tx[2] / lv,
        vy: tx[3] / lv,
        w,
        fs,
        eol: raw.hasEOL,
        charX: () => (cache ??= measureOffsets(str, `100px ${family}`, w)),
      });
    }

    // Text that lives in annotations (form fields, typed-on text boxes) is not in the page text.
    try {
      const anns = (await page.getAnnotations()) as Array<Record<string, unknown>>;
      const counts = new Map<string, number>();
      for (const a of anns) {
        const sub = String(a.subtype ?? "");
        if (sub === "Link" || sub === "Popup") continue;
        counts.set(sub, (counts.get(sub) ?? 0) + 1);
        if (!VISIBLE_TEXT_ANNOTATIONS.has(sub) || !Array.isArray(a.rect)) continue;
        const texts: string[] = [];
        const cont = (a.contentsObj as { str?: string } | undefined)?.str ?? (typeof a.contents === "string" ? a.contents : "");
        if (cont) texts.push(cont);
        const fv = a.fieldValue;
        if (typeof fv === "string" && fv) texts.push(fv);
        else if (Array.isArray(fv)) texts.push(...fv.filter((x): x is string => typeof x === "string" && !!x));
        if (!texts.length) continue;
        const m = vp.transform as number[];
        const [rx1, ry1, rx2, ry2] = a.rect as number[];
        const x1 = m[0] * rx1 + m[2] * ry1 + m[4];
        const y1 = m[1] * rx1 + m[3] * ry1 + m[5];
        const x2 = m[0] * rx2 + m[2] * ry2 + m[4];
        const y2 = m[1] * rx2 + m[3] * ry2 + m[5];
        const whole: Rect = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
        const str = texts.join(" ");
        charCount += str.replace(/\s/g, "").length;
        items.push({ str, ox: whole.x, oy: whole.y + whole.h, ux: 1, uy: 0, vx: 0, vy: -1, w: whole.w, fs: whole.h, eol: true, whole });
      }
      if (counts.size) {
        const parts = [...counts].map(([k, n]) => `${n} ${k === "Widget" ? "form field" : k === "FreeText" ? "text box" : k.toLowerCase()}${n > 1 ? "s" : ""}`);
        pageNotes.push(`Has ${parts.join(", ")}. These are flattened into the picture of the page.`);
      }
    } catch {
      /* annotations unreadable */
    }

    return {
      index,
      widthPt,
      heightPt,
      items,
      charCount,
      notes: pageNotes,
      async render(canvas, scale) {
        const v = page.getViewport({ scale });
        canvas.width = Math.ceil(v.width);
        canvas.height = Math.ceil(v.height);
        await page.render({ canvas, viewport: v, background: "#ffffff" }).promise;
      },
    };
  };

  return {
    kind: "pdf",
    name,
    pageCount: doc.numPages,
    getPage,
    metaStrings,
    notes,
    destroy() {
      void task.destroy();
    },
  };
}
