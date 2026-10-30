import type { Check } from "./types";
import { REPO_URL, VERSION } from "../version";

/** What the report says about one file. It never contains the text that was hidden. */
export interface FileRecord {
  original: string;
  originalSha256: string;
  originalBytes: number;
  converted: string | null;
  output: string | null;
  outputSha256: string | null;
  outputBytes: number | null;
  pages: number;
  redactions: number;
  byRule: Record<string, number>;
  manual: number;
  pagesWithoutText: number;
  verified: boolean;
  checks: Check[];
  notes: string[];
}

export interface Report {
  tool: string;
  version: string;
  source: string;
  createdAt: string;
  settings: { dpi: number; jpegQuality: number; ocr: boolean; deepCheck: boolean };
  files: FileRecord[];
}

export async function sha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = data instanceof Uint8Array ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer) : data;
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function makeReport(files: FileRecord[], settings: Report["settings"]): Report {
  return { tool: "Solas Redact", version: VERSION, source: REPO_URL, createdAt: new Date().toISOString(), settings, files };
}

export function reportText(r: Report): string {
  const L: string[] = [];
  L.push(`Solas Redact redaction report`);
  L.push(`Made ${r.createdAt} with Solas Redact ${r.version} (${r.source})`);
  L.push(`Page resolution ${r.settings.dpi} dpi, JPEG quality ${r.settings.jpegQuality}, text recognition for scanned pages ${r.settings.ocr ? "on" : "off"}, deep check ${r.settings.deepCheck ? "on" : "off"}`);
  L.push(`This report lists counts and file fingerprints only. It does not contain the text that was hidden.`);
  L.push("");
  for (const f of r.files) {
    L.push(`File: ${f.original}`);
    L.push(`  Original fingerprint (SHA-256): ${f.originalSha256}   ${f.originalBytes} bytes. The original was not changed.`);
    if (f.converted) L.push(`  Converted before redaction: ${f.converted}`);
    if (f.output) {
      L.push(`  Redacted copy: ${f.output}   ${f.outputBytes} bytes, ${f.pages} page(s)`);
      L.push(`  Copy fingerprint (SHA-256): ${f.outputSha256}`);
    } else L.push(`  No copy was made.`);
    L.push(`  Redactions: ${f.redactions} (${f.manual} drawn by hand)`);
    for (const [k, n] of Object.entries(f.byRule)) L.push(`    ${k}: ${n}`);
    if (f.pagesWithoutText) L.push(`  Pages with no text layer: ${f.pagesWithoutText}`);
    L.push(`  Checks on the finished file: ${f.verified ? "ALL PASSED" : "FAILED"}`);
    for (const c of f.checks) L.push(`    [${c.ok ? "pass" : "FAIL"}] ${c.label}: ${c.detail}`);
    for (const n of f.notes) L.push(`  Note: ${n}`);
    L.push("");
  }
  return L.join("\r\n");
}
