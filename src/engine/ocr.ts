import type { Worker } from "tesseract.js";
import type { Rect, SourcePage, TextItem } from "./types";

/** Optional text recognition for pages that are pictures. The engine and English data are files on our own origin (see tools/copy-vendor.mjs); nothing is fetched from elsewhere. */

export const OCR_DPI = 200;

let workerPromise: Promise<Worker> | null = null;

async function worker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = (await import("tesseract.js/dist/tesseract.esm.min.js")).default;
      return createWorker("eng", 1, {
        workerPath: "/vendor/tesseract/worker.min.js",
        corePath: "/vendor/tesseract/core",
        langPath: "/vendor/tesseract/lang",
        gzip: true,
        // Do not keep the language data in IndexedDB: nothing of ours is stored in the browser.
        cacheMethod: "none",
        workerBlobURL: false,
      } as Parameters<typeof createWorker>[2]);
    })();
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

export async function stopOcr(): Promise<void> {
  if (!workerPromise) return;
  const w = await workerPromise.catch(() => null);
  workerPromise = null;
  await w?.terminate();
}

interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  line: number;
}

async function recognizeCanvas(canvas: HTMLCanvasElement): Promise<OcrWord[]> {
  const w = await worker();
  const { data } = await w.recognize(canvas, {}, { blocks: true });
  const words: OcrWord[] = [];
  let line = 0;
  for (const b of data.blocks ?? [])
    for (const p of b.paragraphs)
      for (const l of p.lines) {
        line += 1;
        for (const wd of l.words) if (wd.text.trim()) words.push({ text: wd.text, x0: wd.bbox.x0, y0: wd.bbox.y0, x1: wd.bbox.x1, y1: wd.bbox.y1, line });
      }
  return words;
}

/** Read a page that has no text layer. Every word becomes a run that redacts its whole box. */
export async function ocrItems(page: SourcePage): Promise<TextItem[]> {
  const scale = OCR_DPI / 72;
  const canvas = document.createElement("canvas");
  await page.render(canvas, scale);
  const words = await recognizeCanvas(canvas);
  canvas.width = canvas.height = 0;
  return words.map((wd, i) => {
    const whole: Rect = { x: wd.x0 / scale, y: wd.y0 / scale, w: (wd.x1 - wd.x0) / scale, h: (wd.y1 - wd.y0) / scale };
    const last = i === words.length - 1 || words[i + 1].line !== wd.line;
    return { str: wd.text, ox: whole.x, oy: whole.y + whole.h, ux: 1, uy: 0, vx: 0, vy: -1, w: whole.w, fs: whole.h, eol: last, whole };
  });
}

/** Plain text of a rendered page, for the final check that nothing readable is left under a redaction. */
export async function ocrText(canvas: HTMLCanvasElement): Promise<string> {
  const words = await recognizeCanvas(canvas);
  return words.map((w) => w.text).join(" ");
}
