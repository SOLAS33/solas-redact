import { A4 } from "./layout";
import type { SourceDoc } from "../types";

/** A picture becomes one page, scaled to fit A4 in whichever orientation suits it. */
export async function openImage(name: string, blob: Blob): Promise<SourceDoc> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new Error("This browser cannot read that picture format. Open it in an image editor and save it as PNG or JPEG.");
  }
  const landscape = bitmap.width > bitmap.height;
  const box = landscape ? { w: A4.h, h: A4.w } : { w: A4.w, h: A4.h };
  const k = Math.min(box.w / bitmap.width, box.h / bitmap.height);
  const widthPt = bitmap.width * k;
  const heightPt = bitmap.height * k;
  return {
    kind: "image",
    name,
    pageCount: 1,
    metaStrings: [],
    notes: ["A picture has no text layer. Tick the scanned-pages option to read the text in it, or draw boxes by hand."],
    async getPage(index) {
      return {
        index,
        widthPt,
        heightPt,
        items: [],
        charCount: 0,
        notes: [],
        async render(canvas, scale) {
          canvas.width = Math.ceil(widthPt * scale);
          canvas.height = Math.ceil(heightPt * scale);
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        },
      };
    },
    destroy() {
      bitmap.close();
    },
  };
}
