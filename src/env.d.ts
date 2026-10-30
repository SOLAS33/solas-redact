/// <reference types="vite/client" />

declare module "pdfjs-dist/build/pdf.min.mjs" {
  export * from "pdfjs-dist";
}

declare module "pdfjs-dist/build/pdf.worker.min.mjs?url" {
  const url: string;
  export default url;
}

declare module "mammoth/mammoth.browser" {
  const mammoth: {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: Record<string, unknown>): Promise<{ value: string; messages: Array<{ type: string; message: string }> }>;
    images: { imgElement(convert: (image: unknown) => Promise<{ src: string }>): unknown };
  };
  export default mammoth;
}

declare module "tesseract.js/dist/tesseract.esm.min.js" {
  const T: typeof import("tesseract.js");
  export default T;
}

declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export * from "pdfjs-dist";
}
