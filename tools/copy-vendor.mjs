// Copies the support files the app loads at run time (PDF fonts and colour data, text-recognition engine and English data)
// from node_modules into public/vendor, so every file is served from our own address. Nothing is fetched from a CDN.
// Runs before dev and build. public/vendor is generated and not committed.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const nm = "node_modules";
const out = join("public", "vendor");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const need = (p) => {
  if (!existsSync(p)) throw new Error(`Missing ${p}. Run npm ci first.`);
  return p;
};

// PDF.js support files
const pdf = need(join(nm, "pdfjs-dist"));
cpSync(join(pdf, "cmaps"), join(out, "pdfjs", "cmaps"), { recursive: true });
cpSync(join(pdf, "iccs"), join(out, "pdfjs", "iccs"), { recursive: true });
mkdirSync(join(out, "pdfjs", "standard_fonts"), { recursive: true });
for (const f of readdirSync(join(pdf, "standard_fonts"))) {
  // Only the Foxit fonts (PDFium licence). The Liberation fonts are GPL-2.0 with a font exception and are left out on purpose.
  if (/^Foxit.*\.pfb$/.test(f) || f === "LICENSE_FOXIT") cpSync(join(pdf, "standard_fonts", f), join(out, "pdfjs", "standard_fonts", f));
}
mkdirSync(join(out, "pdfjs", "wasm"), { recursive: true });
for (const f of readdirSync(join(pdf, "wasm"))) {
  if (/quickjs/.test(f)) continue; // PDF scripting engine: not used, scripts are never run
  cpSync(join(pdf, "wasm", f), join(out, "pdfjs", "wasm", f));
}

// Fonts for the app and the website
mkdirSync(join(out, "fonts"), { recursive: true });
const it = need(join(nm, "@fontsource-variable", "inter-tight"));
const plex = need(join(nm, "@fontsource", "ibm-plex-mono"));
for (const f of ["inter-tight-latin-wght-normal.woff2", "inter-tight-latin-ext-wght-normal.woff2"]) cpSync(join(it, "files", f), join(out, "fonts", f));
for (const f of ["ibm-plex-mono-latin-400-normal.woff2", "ibm-plex-mono-latin-500-normal.woff2"]) cpSync(join(plex, "files", f), join(out, "fonts", f));
cpSync(join(it, "LICENSE"), join(out, "fonts", "LICENSE-Inter-Tight.txt"));
cpSync(join(plex, "LICENSE"), join(out, "fonts", "LICENSE-IBM-Plex-Mono.txt"));

// Tesseract text recognition
const tj = need(join(nm, "tesseract.js"));
const core = need(join(nm, "tesseract.js-core"));
const data = need(join(nm, "@tesseract.js-data", "eng"));
mkdirSync(join(out, "tesseract", "core"), { recursive: true });
mkdirSync(join(out, "tesseract", "lang"), { recursive: true });
cpSync(join(tj, "dist", "worker.min.js"), join(out, "tesseract", "worker.min.js"));
cpSync(join(tj, "dist", "worker.min.js.LICENSE.txt"), join(out, "tesseract", "worker.min.js.LICENSE.txt"));
for (const f of readdirSync(core)) if (/-lstm\.wasm\.js$/.test(f)) cpSync(join(core, f), join(out, "tesseract", "core", f));
cpSync(join(core, "LICENSE"), join(out, "tesseract", "core", "LICENSE"));
cpSync(join(data, "4.0.0_best_int", "eng.traineddata.gz"), join(out, "tesseract", "lang", "eng.traineddata.gz"));
console.log("vendor files copied to", out);
