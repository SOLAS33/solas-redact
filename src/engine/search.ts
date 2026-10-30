import { PATTERN_BY_ID } from "./patterns";
import { PAD_PT, type FindOptions, type Rect, type Redaction, type TextItem } from "./types";

/** Lower-case and strip accents without changing the string length, so match positions still line up with the original text. */
export function foldText(s: string, opts: { caseSensitive: boolean; ignoreAccents: boolean }): string {
  let out = "";
  for (const ch of s) {
    let c = ch;
    if (opts.ignoreAccents && c.charCodeAt(0) > 127) {
      const d = c.normalize("NFD");
      if (d.length > 1 && c.length === 1) c = d[0];
    }
    if (!opts.caseSensitive) {
      const l = c.toLowerCase();
      if (l.length === c.length) c = l;
    }
    // keep the length identical to the input
    out += c.length === ch.length ? c : ch;
  }
  return out;
}

/** Letters and digits only, folded, for comparing a hidden text with what text recognition reads back. */
export function normText(s: string): string {
  return foldText(s, { caseSensitive: false, ignoreAccents: true }).replace(/[^\p{L}\p{N}]+/gu, "");
}

interface Span {
  start: number;
  end: number;
  item: number;
}

export interface PageText {
  text: string;
  spans: Span[];
}

/** Join the runs of text on a page into one string, adding a space or line break where the layout has one. */
export function buildPageText(items: TextItem[]): PageText {
  let text = "";
  const spans: Span[] = [];
  let prev: TextItem | null = null;
  items.forEach((it, i) => {
    if (!it.str) return;
    if (prev) {
      if (prev.eol) text += "\n";
      else {
        const dx = (it.ox - prev.ox) * prev.ux + (it.oy - prev.oy) * prev.uy - prev.w;
        const dy = Math.abs((it.ox - prev.ox) * prev.vx + (it.oy - prev.oy) * prev.vy);
        if (dy > 0.5 * Math.max(prev.fs, 1)) text += "\n";
        else if (dx > 0.15 * Math.max(prev.fs, 1) && !/\s$/.test(prev.str) && !/^\s/.test(it.str)) text += " ";
      }
    }
    spans.push({ start: text.length, end: text.length + it.str.length, item: i });
    text += it.str;
    prev = it;
  });
  return { text, spans };
}

/** One search term line to a regular expression over folded text. A line written /like this/ is used as a regular expression. */
export function termToRegex(line: string, opts: Pick<FindOptions, "wholeWord" | "caseSensitive" | "ignoreAccents">): RegExp | null {
  const t = line.trim();
  if (!t) return null;
  try {
    const m = /^\/(.+)\/([a-z]*)$/.exec(t);
    if (m) return new RegExp(m[1], m[2].includes("g") ? m[2] : m[2] + "g");
    const folded = foldText(t, opts);
    const body = folded
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s+");
    const pre = opts.wholeWord ? "(?<![\\p{L}\\p{N}_])" : "";
    const post = opts.wholeWord ? "(?![\\p{L}\\p{N}_])" : "";
    return new RegExp(pre + body + post, "gu");
  } catch {
    return null;
  }
}

export function invalidTerms(terms: string[], opts: Pick<FindOptions, "wholeWord" | "caseSensitive" | "ignoreAccents">): string[] {
  return terms.filter((t) => t.trim() && !termToRegex(t, opts));
}

interface Hit {
  start: number;
  end: number;
  rule: string;
  origin: "search" | "pattern";
}

export function findHits(pt: PageText, opts: FindOptions): Hit[] {
  const hits: Hit[] = [];
  const folded = foldText(pt.text, opts);
  for (const line of opts.terms) {
    const re = termToRegex(line, opts);
    if (!re) continue;
    const isRegexLine = /^\s*\/.+\/[a-z]*\s*$/.test(line);
    const hay = isRegexLine ? pt.text : folded;
    for (const m of hay.matchAll(re)) {
      if (!m[0]) continue;
      hits.push({ start: m.index!, end: m.index! + m[0].length, rule: isRegexLine ? "Pattern you typed" : "Search term", origin: "search" });
    }
  }
  for (const id of opts.patterns) {
    const def = PATTERN_BY_ID.get(id);
    if (!def) continue;
    const re = new RegExp(def.regex.source, def.regex.flags);
    for (const m of pt.text.matchAll(re)) {
      if (!m[0]) continue;
      if (def.validate && !def.validate(m[0])) continue;
      hits.push({ start: m.index!, end: m.index! + m[0].length, rule: def.label, origin: "pattern" });
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  // merge overlapping hits so one stretch of text gives one redaction
  const merged: Hit[] = [];
  for (const h of hits) {
    const last = merged[merged.length - 1];
    if (last && h.start < last.end) {
      if (h.end > last.end) last.end = h.end;
      continue;
    }
    merged.push({ ...h });
  }
  return merged;
}

export function expand(r: Rect, by: number, pageW: number, pageH: number): Rect {
  const x0 = Math.max(0, r.x - by);
  const y0 = Math.max(0, r.y - by);
  const x1 = Math.min(pageW, r.x + r.w + by);
  const y1 = Math.min(pageH, r.y + r.h + by);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/** Box around characters a..b of a run, from the glyph advance positions, with room for ascenders and descenders. */
export function itemSlice(it: TextItem, a: number, b: number): Rect {
  const n = it.str.length;
  let xa: number, xb: number;
  if (a <= 0 && b >= n) {
    xa = 0;
    xb = it.w;
  } else {
    const cx = it.charX ? it.charX() : null;
    if (cx && cx.length === n + 1) {
      xa = cx[a];
      xb = cx[b];
    } else {
      xa = (it.w * a) / n;
      xb = (it.w * b) / n;
    }
  }
  const down = 0.32 * it.fs;
  const up = 0.98 * it.fs;
  const pts = [
    [it.ox + it.ux * xa - it.vx * down, it.oy + it.uy * xa - it.vy * down],
    [it.ox + it.ux * xb - it.vx * down, it.oy + it.uy * xb - it.vy * down],
    [it.ox + it.ux * xb + it.vx * up, it.oy + it.uy * xb + it.vy * up],
    [it.ox + it.ux * xa + it.vx * up, it.oy + it.uy * xa + it.vy * up],
  ];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Join boxes that sit on the same line and almost touch, so a name that spans several runs becomes one black bar. */
export function mergeLineRects(rects: Rect[]): Rect[] {
  const out: Rect[] = [];
  for (const r of rects) {
    const m = out.find((o) => {
      const overlap = Math.min(o.y + o.h, r.y + r.h) - Math.max(o.y, r.y);
      if (overlap < 0.5 * Math.min(o.h, r.h)) return false;
      const gap = Math.max(r.x - (o.x + o.w), o.x - (r.x + r.w));
      return gap < 0.6 * Math.min(o.h, r.h);
    });
    if (m) {
      const x0 = Math.min(m.x, r.x);
      const y0 = Math.min(m.y, r.y);
      const x1 = Math.max(m.x + m.w, r.x + r.w);
      const y1 = Math.max(m.y + m.h, r.y + r.h);
      m.x = x0;
      m.y = y0;
      m.w = x1 - x0;
      m.h = y1 - y0;
    } else out.push({ ...r });
  }
  return out;
}

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}${counter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Find everything on one page that the rules ask to hide, as boxes ready for the reviewer. */
export function findOnPage(pageIndex: number, pageW: number, pageH: number, items: TextItem[], opts: FindOptions): Redaction[] {
  const pt = buildPageText(items);
  if (!pt.text) return [];
  const out: Redaction[] = [];
  for (const h of findHits(pt, opts)) {
    const rects: Rect[] = [];
    const seenWhole = new Set<Rect>();
    for (const sp of pt.spans) {
      if (sp.end <= h.start || sp.start >= h.end) continue;
      const it = items[sp.item];
      if (it.whole) {
        if (!seenWhole.has(it.whole)) {
          seenWhole.add(it.whole);
          rects.push({ ...it.whole });
        }
        continue;
      }
      rects.push(itemSlice(it, Math.max(0, h.start - sp.start), Math.min(it.str.length, h.end - sp.start)));
    }
    if (!rects.length) continue;
    const group = newId("g");
    const text = pt.text.slice(h.start, h.end).replace(/\s+/g, " ");
    for (const r of mergeLineRects(rects)) {
      out.push({
        id: newId("r"),
        group,
        page: pageIndex,
        rect: expand(r, PAD_PT, pageW, pageH),
        origin: h.origin,
        rule: h.rule,
        text,
        accepted: true,
      });
    }
  }
  return out;
}
