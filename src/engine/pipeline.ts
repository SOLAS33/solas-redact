import { PDFDocument } from "pdf-lib";
import { flatten, type FlatResult } from "./flatten";
import { ocrItems } from "./ocr";
import { findOnPage, normText } from "./search";
import { verify } from "./verify";
import { VERSION } from "../version";
import { sha256, type FileRecord } from "./audit";
import { QUALITY, type FindOptions, type QualityPreset, type Redaction, type SourceDoc, type VerifyReport } from "./types";

/** A page with fewer text characters than this is treated as a picture of a page. */
export const MIN_TEXT_CHARS = 10;

export interface ScanResult {
  redactions: Redaction[];
  /** Pages (0-based) that have no text layer and were not read by text recognition. */
  pagesWithoutText: number[];
  ocrPages: number;
}

export interface Cancel {
  cancelled: boolean;
}

/** Look through every page for what the rules ask to hide. */
export async function scanDoc(doc: SourceDoc, opts: FindOptions, onPage: (done: number, total: number, what: string) => void, cancel: Cancel): Promise<ScanResult> {
  const redactions: Redaction[] = [];
  const pagesWithoutText: number[] = [];
  let ocrPages = 0;
  const anyRule = opts.terms.some((t) => t.trim()) || opts.patterns.length > 0;
  for (let i = 0; i < doc.pageCount; i++) {
    if (cancel.cancelled) break;
    const page = await doc.getPage(i);
    let items = page.items;
    const isPicture = page.charCount < MIN_TEXT_CHARS;
    if (isPicture && opts.ocr && anyRule) {
      onPage(i, doc.pageCount, `Reading page ${i + 1} of ${doc.pageCount} (scanned)`);
      items = await ocrItems(page);
      ocrPages += 1;
    } else {
      onPage(i, doc.pageCount, `Searching page ${i + 1} of ${doc.pageCount}`);
      if (isPicture) pagesWithoutText.push(i);
    }
    if (anyRule) redactions.push(...findOnPage(i, page.widthPt, page.heightPt, items, opts));
    await new Promise((r) => setTimeout(r, 0));
  }
  return { redactions, pagesWithoutText, ocrPages };
}

let baseline: string | null = null;
async function baselineBytes(): Promise<string> {
  if (baseline === null) {
    const d = await PDFDocument.create({ updateMetadata: false });
    d.setProducer(`Solas Redact ${VERSION}`);
    d.setCreator("Solas Redact");
    d.addPage([100, 100]);
    const b = await d.save({ useObjectStreams: false });
    baseline = new TextDecoder("latin1").decode(b).toLowerCase();
  }
  return baseline;
}

export interface Built {
  flat: FlatResult;
  verify: VerifyReport;
  sha: string;
}

/** Build the redacted copy and check it. A copy that fails any check must not be offered for download. */
export async function buildRedacted(
  doc: SourceDoc,
  redactions: Redaction[],
  q: QualityPreset,
  deep: boolean,
  onStatus: (msg: string, done?: number, total?: number) => void,
  cancel: Cancel
): Promise<Built | null> {
  const flat = await flatten(doc, redactions, q, (d, t) => onStatus(`Building page ${d} of ${t}`, d, t));
  if (cancel.cancelled) return null;

  const accepted = redactions.filter((r) => r.accepted);
  const base = await baselineBytes();
  const forbidden = [...doc.metaStrings, ...accepted.map((r) => r.text)].filter((s) => !base.includes(s.toLowerCase()));

  // Deep-check bookkeeping: a hidden text may still be readable once for each match the reviewer chose to keep.
  const groups = new Map<string, Redaction[]>();
  for (const r of redactions) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
  const allowed = Array.from({ length: doc.pageCount }, () => new Map<string, number>());
  const hidden = new Set<string>();
  const kept = new Map<string, number>();
  for (const rs of groups.values()) {
    const key = normText(rs[0].text);
    if (!key) continue;
    const pk = `${rs[0].page}|${key}`;
    if (rs.some((r) => r.accepted)) hidden.add(pk);
    else kept.set(pk, (kept.get(pk) ?? 0) + 1);
  }
  for (const pk of hidden) {
    const at = pk.indexOf("|");
    allowed[Number(pk.slice(0, at))].set(pk.slice(at + 1), kept.get(pk) ?? 0);
  }

  const report = await verify({ bytes: flat.bytes, pages: flat.pages, forbidden, allowed, deep }, (m) => onStatus(`Checking: ${m}`));
  const sha = await sha256(flat.bytes);
  return { flat, verify: report, sha };
}

export function countByRule(redactions: Redaction[]): { byRule: Record<string, number>; manual: number; total: number } {
  const byRule: Record<string, number> = {};
  let manual = 0;
  const seen = new Set<string>();
  for (const r of redactions) {
    if (!r.accepted) continue;
    if (r.origin === "manual") {
      manual += 1;
      continue;
    }
    if (seen.has(r.group)) continue;
    seen.add(r.group);
    byRule[r.rule] = (byRule[r.rule] ?? 0) + 1;
  }
  const total = Object.values(byRule).reduce((a, b) => a + b, 0) + manual;
  return { byRule, manual, total };
}

export function recordFor(init: Pick<FileRecord, "original" | "originalSha256" | "originalBytes" | "converted" | "pages" | "notes" | "pagesWithoutText">, redactions: Redaction[], built: Built | null, outName: string | null): FileRecord {
  const c = countByRule(redactions);
  return {
    ...init,
    output: built && outName ? outName : null,
    outputSha256: built && outName ? built.sha : null,
    outputBytes: built && outName ? built.flat.bytes.length : null,
    redactions: c.total,
    byRule: c.byRule,
    manual: c.manual,
    verified: !!built?.verify.ok,
    checks: built?.verify.checks ?? [],
  };
}

export const DEFAULT_QUALITY = QUALITY[0];
