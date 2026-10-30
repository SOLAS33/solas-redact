let ctx: CanvasRenderingContext2D | null = null;

function context(): CanvasRenderingContext2D {
  if (!ctx) ctx = document.createElement("canvas").getContext("2d")!;
  return ctx;
}

/**
 * Where each character boundary falls along a run of text, in points.
 * Uses the browser's own glyph widths for the font, then scales so the end of the run lands exactly on the width the PDF reports.
 */
export function measureOffsets(str: string, font: string, targetWidth: number): number[] {
  const c = context();
  c.font = font;
  const n = str.length;
  const xs = new Array<number>(n + 1);
  xs[0] = 0;
  for (let i = 1; i <= n; i++) xs[i] = c.measureText(str.slice(0, i)).width;
  const total = xs[n];
  if (!(total > 0)) return xs.map((_, i) => (targetWidth * i) / Math.max(n, 1));
  const k = targetWidth / total;
  return xs.map((x) => x * k);
}

export function textWidth(str: string, font: string): number {
  const c = context();
  c.font = font;
  return c.measureText(str).width;
}
