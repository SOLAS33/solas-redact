import { measureOffsets, textWidth } from "../measure";
import type { SourceDoc, SourceKind, SourcePage, TextItem } from "../types";

/** A4 in points. */
export const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 56;
const MAX_PAGES = 1500;

const SANS = `Arial, "Helvetica Neue", Helvetica, "Liberation Sans", sans-serif`;
const MONO = `Consolas, "Courier New", "Liberation Mono", monospace`;

export interface Block {
  text: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  mono?: boolean;
  indent?: number;
  before?: number;
  /** Keep spaces and line breaks exactly (plain text, code, tables). */
  pre?: boolean;
}

interface Line {
  text: string;
  x: number;
  y: number;
  css: string;
  fs: number;
}

function fontCss(b: Block, fs: number): string {
  return `${b.italic ? "italic " : ""}${b.bold ? "bold " : ""}${fs}px ${b.mono ? MONO : SANS}`;
}

/** Break a block into lines that fit the line width, using the browser's own glyph widths. */
function wrap(b: Block, css: string, maxW: number): string[] {
  const out: string[] = [];
  const paragraphs = b.text.replace(/\t/g, "    ").split(/\r?\n/);
  for (const para of paragraphs) {
    if (!para.trim() && !b.pre) {
      out.push("");
      continue;
    }
    const words = b.pre ? para.split(/(?<= )/) : para.split(/\s+/).filter(Boolean);
    let line = "";
    const pushLong = (w: string) => {
      let chunk = "";
      for (const ch of w) {
        if (textWidth(chunk + ch, css) > maxW && chunk) {
          out.push(chunk);
          chunk = "";
        }
        chunk += ch;
      }
      return chunk;
    };
    for (const w of words) {
      const trial = line ? (b.pre ? line + w : line + " " + w) : w;
      if (textWidth(trial.trimEnd(), css) <= maxW) {
        line = trial;
        continue;
      }
      if (line) out.push(line.trimEnd());
      line = textWidth(w.trimEnd(), css) > maxW ? pushLong(w) : w;
    }
    out.push(line.trimEnd());
  }
  return out;
}

/** Lay blocks out on A4 pages. Returns the lines of each page. */
export function layout(blocks: Block[]): { pages: Line[][]; truncated: boolean } {
  const pages: Line[][] = [[]];
  let y = MARGIN;
  let truncated = false;
  const maxW = A4.w - MARGIN * 2;
  outer: for (const b of blocks) {
    const fs = b.size ?? (b.mono ? 9.5 : 10.5);
    const css = fontCss(b, fs);
    const lh = fs * (b.mono ? 1.25 : 1.4);
    y += b.before ?? 0;
    const x = MARGIN + (b.indent ?? 0);
    for (const text of wrap(b, css, maxW - (b.indent ?? 0))) {
      if (y + lh > A4.h - MARGIN) {
        if (pages.length >= MAX_PAGES) {
          truncated = true;
          break outer;
        }
        pages.push([]);
        y = MARGIN;
      }
      y += lh;
      if (text) pages[pages.length - 1].push({ text, x, y: y - fs * 0.28, css, fs });
    }
  }
  return { pages, truncated };
}

function pageFromLines(index: number, lines: Line[]): SourcePage {
  const items: TextItem[] = lines.map((l) => {
    const w = textWidth(l.text, l.css);
    let cache: number[] | null = null;
    return {
      str: l.text,
      ox: l.x,
      oy: l.y,
      ux: 1,
      uy: 0,
      vx: 0,
      vy: -1,
      w,
      fs: l.fs,
      eol: true,
      charX: () => (cache ??= measureOffsets(l.text, l.css, w)),
    };
  });
  return {
    index,
    widthPt: A4.w,
    heightPt: A4.h,
    items,
    charCount: lines.reduce((n, l) => n + l.text.replace(/\s/g, "").length, 0),
    notes: [],
    async render(canvas, scale) {
      canvas.width = Math.ceil(A4.w * scale);
      canvas.height = Math.ceil(A4.h * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(scale, scale);
      ctx.fillStyle = "#000";
      ctx.textBaseline = "alphabetic";
      for (const l of lines) {
        ctx.font = l.css;
        ctx.fillText(l.text, l.x, l.y);
      }
      ctx.restore();
    },
  };
}

export function docFromBlocks(kind: SourceKind, name: string, blocks: Block[], notes: string[], metaStrings: string[] = []): SourceDoc {
  const { pages, truncated } = layout(blocks);
  const all = notes.slice();
  if (truncated) all.push(`The file is very long. Only the first ${MAX_PAGES} pages were converted. Split the file and convert the rest separately.`);
  const cache = new Map<number, SourcePage>();
  return {
    kind,
    name,
    pageCount: pages.length,
    metaStrings,
    notes: all,
    async getPage(i) {
      let p = cache.get(i);
      if (!p) {
        p = pageFromLines(i, pages[i]);
        cache.set(i, p);
      }
      return p;
    },
    destroy() {
      cache.clear();
    },
  };
}
