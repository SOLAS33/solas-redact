/** Shared types. All geometry is in PDF points (1/72 inch) with the origin at the top left of the page as displayed (rotation already applied). */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * One run of text on a page. The run sits on a baseline that starts at (ox, oy) and runs along the unit vector (ux, uy).
 * (vx, vy) is the unit vector pointing up from the baseline (towards the top of the letters).
 */
export interface TextItem {
  str: string;
  ox: number;
  oy: number;
  ux: number;
  uy: number;
  vx: number;
  vy: number;
  /** Length of the run along the baseline. */
  w: number;
  /** Font size in points. */
  fs: number;
  /** True when the run ends a line. */
  eol: boolean;
  /** Offsets along the baseline at each character boundary (str.length + 1 numbers). Computed on demand. */
  charX?: () => number[];
  /** When set, any match that touches this run redacts this whole rectangle (form fields, comments, OCR words). */
  whole?: Rect;
}

export interface SourcePage {
  index: number;
  widthPt: number;
  heightPt: number;
  items: TextItem[];
  /** Number of text characters found on the page. */
  charCount: number;
  /** Notes about this page the reviewer should see (annotations, form fields). */
  notes: string[];
  /** Paint the page onto the canvas. The canvas is resized to widthPt*scale by heightPt*scale. */
  render(canvas: HTMLCanvasElement, scale: number): Promise<void>;
}

export type SourceKind = "pdf" | "image" | "text" | "email" | "docx";

export interface SourceDoc {
  kind: SourceKind;
  name: string;
  pageCount: number;
  getPage(index: number): Promise<SourcePage>;
  /** Metadata strings found in the original, used by verification to prove none of them reach the output. */
  metaStrings: string[];
  /** What the conversion changed or could not carry over. Shown to the user. */
  notes: string[];
  destroy(): void;
}

export type RedactionOrigin = "search" | "pattern" | "manual" | "ocr";

export interface Redaction {
  id: string;
  /** Redactions from one match share a group so they are accepted or rejected together. */
  group: string;
  page: number;
  rect: Rect;
  origin: RedactionOrigin;
  /** Rule name for the audit report, for example "Email address" or "Search term". Never the matched text. */
  rule: string;
  /** The text found, shown in the review list only. Never written to the report or kept after the session. */
  text: string;
  accepted: boolean;
}

export interface FindOptions {
  terms: string[];
  wholeWord: boolean;
  caseSensitive: boolean;
  ignoreAccents: boolean;
  patterns: string[];
  ocr: boolean;
}

export interface QualityPreset {
  id: "standard" | "high" | "best" | "bw";
  label: string;
  dpi: number;
  jpeg: number;
  /** Store each page as a 1-bit black and white picture: far smaller for text, no greys or colour. */
  bw?: boolean;
}

export const QUALITY: QualityPreset[] = [
  { id: "standard", label: "Standard (150 dpi, smallest files)", dpi: 150, jpeg: 0.82 },
  { id: "high", label: "High (200 dpi)", dpi: 200, jpeg: 0.86 },
  { id: "best", label: "Best (300 dpi, largest files)", dpi: 300, jpeg: 0.9 },
  { id: "bw", label: "Black and white (300 dpi, smallest files for text)", dpi: 300, jpeg: 0, bw: true },
];

export interface Check {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface VerifyReport {
  ok: boolean;
  checks: Check[];
}

export const PAD_PT = 2;
export const MAX_CANVAS_PIXELS = 40_000_000;
