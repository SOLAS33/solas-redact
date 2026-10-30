import * as pdfjs from "pdfjs-dist/build/pdf.min.mjs";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Where the build puts pdf.js support files (see tools/copy-vendor.mjs). All served from our own origin. */
export const PDFJS_ASSETS = {
  cMapUrl: "/vendor/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/vendor/pdfjs/standard_fonts/",
  wasmUrl: "/vendor/pdfjs/wasm/",
  iccUrl: "/vendor/pdfjs/iccs/",
  // No eval, so the page can run under a content security policy without 'unsafe-eval'.
  isEvalSupported: false,
  useSystemFonts: true,
  enableScripting: false,
} as const;

export { pdfjs };
