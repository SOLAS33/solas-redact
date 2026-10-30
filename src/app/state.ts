import type { FindOptions, Redaction, SourceDoc, VerifyReport } from "../engine/types";

export type Step = "start" | "files" | "rules" | "review" | "results";
export type Mode = "manual" | "scan";

export interface FileEntry {
  id: string;
  file: File;
  status: "loading" | "password" | "ready" | "error";
  error?: string;
  wrongPassword?: boolean;
  doc?: SourceDoc;
  sha?: string;
  pages?: number;
  notes: string[];
  redactions: Redaction[];
  pagesWithoutText: number[];
  ocrPages: number;
  scanned: boolean;
  /** Page numbers (from 0) the person has had on screen. */
  seen: number[];
}

export interface Settings {
  terms: string;
  wholeWord: boolean;
  caseSensitive: boolean;
  ignoreAccents: boolean;
  patterns: string[];
  ocr: boolean;
  quality: "standard" | "high" | "best" | "bw";
  deep: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  terms: "",
  wholeWord: true,
  caseSensitive: false,
  ignoreAccents: true,
  patterns: [],
  ocr: true,
  quality: "standard",
  deep: true,
};

export function findOptions(s: Settings): FindOptions {
  return {
    terms: s.terms.split(/\r?\n/).map((t) => t.trim()).filter(Boolean),
    wholeWord: s.wholeWord,
    caseSensitive: s.caseSensitive,
    ignoreAccents: s.ignoreAccents,
    patterns: s.patterns,
    ocr: s.ocr,
  };
}

export type ResultStatus = "queued" | "building" | "checking" | "done" | "failed" | "stopped";

export interface ResultEntry {
  id: string;
  name: string;
  status: ResultStatus;
  message: string;
  progress: number;
  outName?: string;
  blob?: Blob;
  verify?: VerifyReport;
  error?: string;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
