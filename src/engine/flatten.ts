import { PDFDocument } from "pdf-lib";
import { MAX_CANVAS_PIXELS, type QualityPreset, type Rect, type Redaction, type SourceDoc } from "./types";
import { VERSION } from "../version";

export interface FlatPage {
  widthPt: number;
  heightPt: number;
  /** The black boxes that were painted, in points. */
  boxes: Rect[];
  /** True when the page was too large to render at the chosen resolution and was rendered smaller. */
  reduced: boolean;
}

export interface FlatResult {
  bytes: Uint8Array;
  pages: FlatPage[];
}

export function scaleFor(widthPt: number, heightPt: number, dpi: number): { scale: number; reduced: boolean } {
  const want = dpi / 72;
  const cap = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(widthPt * heightPt, 1));
  return cap < want ? { scale: cap, reduced: true } : { scale: want, reduced: false };
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (b) => {
        if (!b) return reject(new Error("The browser could not encode a page. The page may be too large for this computer's memory."));
        resolve(new Uint8Array(await b.arrayBuffer()));
      },
      "image/jpeg",
      quality
    );
  });
}

/**
 * The redaction itself. Every page is drawn to a picture, the accepted boxes are painted solid black over the picture,
 * and a brand new PDF is built from the pictures alone. Nothing from the original file is copied across: no text, no
 * fonts, no metadata, no attachments, no form fields. The original file is never written to.
 */
export async function flatten(doc: SourceDoc, redactions: Redaction[], q: QualityPreset, onPage?: (done: number, total: number) => void): Promise<FlatResult> {
  const out = await PDFDocument.create({ updateMetadata: false });
  const pages: FlatPage[] = [];
  for (let i = 0; i < doc.pageCount; i++) {
    const src = await doc.getPage(i);
    const { scale, reduced } = scaleFor(src.widthPt, src.heightPt, q.dpi);
    const canvas = document.createElement("canvas");
    await src.render(canvas, scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    const boxes: Rect[] = [];
    for (const r of redactions) {
      if (!r.accepted || r.page !== i) continue;
      const x0 = Math.max(0, Math.floor(r.rect.x * scale));
      const y0 = Math.max(0, Math.floor(r.rect.y * scale));
      const x1 = Math.min(canvas.width, Math.ceil((r.rect.x + r.rect.w) * scale));
      const y1 = Math.min(canvas.height, Math.ceil((r.rect.y + r.rect.h) * scale));
      if (x1 <= x0 || y1 <= y0) continue;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      boxes.push({ x: x0 / scale, y: y0 / scale, w: (x1 - x0) / scale, h: (y1 - y0) / scale });
    }
    const jpeg = await toJpeg(canvas, q.jpeg);
    canvas.width = canvas.height = 0;
    const img = await out.embedJpg(jpeg);
    const page = out.addPage([src.widthPt, src.heightPt]);
    page.drawImage(img, { x: 0, y: 0, width: src.widthPt, height: src.heightPt });
    pages.push({ widthPt: src.widthPt, heightPt: src.heightPt, boxes, reduced });
    onPage?.(i + 1, doc.pageCount);
    // let the interface breathe between pages
    await new Promise((r) => setTimeout(r, 0));
  }
  const now = new Date();
  out.setProducer(`Ebon ${VERSION}`);
  out.setCreator("Ebon");
  out.setCreationDate(now);
  out.setModificationDate(now);
  const bytes = await out.save({ useObjectStreams: false });
  return { bytes, pages };
}
