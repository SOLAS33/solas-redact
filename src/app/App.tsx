import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openAny, baseName, extOf, Unsupported } from "../engine/sources/convert";
import { PasswordNeeded } from "../engine/sources/pdfSource";
import { buildRedacted, recordFor, scanDoc, type Cancel } from "../engine/pipeline";
import { makeReport, reportText, sha256, type FileRecord } from "../engine/audit";
import { outputName } from "../engine/output";
import { stopOcr } from "../engine/ocr";
import { QUALITY, type Redaction } from "../engine/types";
import { VERSION } from "../version";
import { DEFAULT_SETTINGS, findOptions, type FileEntry, type ResultEntry, type Settings, type Step } from "./state";
import { FilesStep } from "./FilesStep";
import { RulesStep } from "./RulesStep";
import { ReviewStep } from "./ReviewStep";
import { ResultsStep } from "./ResultsStep";
import { Consent } from "./Consent";

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "files", label: "1 Add files" },
  { id: "rules", label: "2 What to hide" },
  { id: "review", label: "3 Review" },
  { id: "results", label: "4 Copies" },
];

let seq = 0;

export function App() {
  const [step, setStep] = useState<Step>("files");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [scan, setScan] = useState<{ busy: boolean; message: string; pct: number }>({ busy: false, message: "", pct: 0 });
  const [consent, setConsent] = useState(false);
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [records, setRecords] = useState<FileRecord[]>([]);
  const [running, setRunning] = useState(false);
  const cancel = useRef<Cancel>({ cancelled: false });
  const queue = useRef<Promise<void>>(Promise.resolve());
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const patch = useCallback((id: string, p: Partial<FileEntry>) => setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...p } : e))), []);

  const load = useCallback(
    (id: string, file: File, password?: string) => {
      queue.current = queue.current.then(async () => {
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const sha = await sha256(bytes);
          const doc = await openAny(file, bytes, password);
          patch(id, { status: "ready", doc, sha, pages: doc.pageCount, notes: doc.notes, error: undefined, wrongPassword: false });
        } catch (e) {
          if (e instanceof PasswordNeeded) patch(id, { status: "password", wrongPassword: e.wrong });
          else patch(id, { status: "error", error: e instanceof Unsupported ? e.message : `Ebon could not open this file. ${(e as Error)?.message ?? ""}`.trim() });
        }
      });
    },
    [patch]
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const fresh: FileEntry[] = files.map((file) => ({
        id: `f${++seq}`,
        file,
        status: "loading",
        notes: [],
        redactions: [],
        pagesWithoutText: [],
        ocrPages: 0,
        scanned: false,
        approved: false,
      }));
      setEntries((es) => [...es, ...fresh]);
      for (const f of fresh) load(f.id, f.file);
    },
    [load]
  );

  const removeFile = useCallback((id: string) => {
    const e = entriesRef.current.find((x) => x.id === id);
    e?.doc?.destroy();
    setEntries((es) => es.filter((x) => x.id !== id));
  }, []);

  const startAgain = useCallback(() => {
    for (const e of entriesRef.current) e.doc?.destroy();
    void stopOcr();
    setEntries([]);
    setResults([]);
    setRecords([]);
    setSettings(DEFAULT_SETTINGS);
    setStep("files");
  }, []);

  useEffect(() => {
    if (!entries.length) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    addEventListener("beforeunload", h);
    return () => removeEventListener("beforeunload", h);
  }, [entries.length]);

  const ready = useMemo(() => entries.filter((e) => e.status === "ready"), [entries]);

  const runScan = useCallback(async () => {
    cancel.current = { cancelled: false };
    const opts = findOptions(settings);
    setScan({ busy: true, message: "Starting", pct: 0 });
    const list = entriesRef.current.filter((e) => e.status === "ready" && e.doc);
    for (let n = 0; n < list.length; n++) {
      const e = list[n];
      if (cancel.current.cancelled) break;
      // Keep hand-drawn boxes when searching again.
      const manual = e.redactions.filter((r) => r.origin === "manual");
      try {
        const r = await scanDoc(
          e.doc!,
          opts,
          (done, total, what) => setScan({ busy: true, message: `${e.file.name}: ${what}`, pct: ((n + done / total) / list.length) * 100 }),
          cancel.current
        );
        patch(e.id, { redactions: [...manual, ...r.redactions], pagesWithoutText: r.pagesWithoutText, ocrPages: r.ocrPages, scanned: true, approved: false });
      } catch (err) {
        patch(e.id, { status: "error", error: `Searching failed: ${(err as Error).message}` });
      }
    }
    setScan({ busy: false, message: "", pct: 100 });
    if (!cancel.current.cancelled) setStep("review");
  }, [settings, patch]);

  const setRedactions = useCallback((id: string, f: (r: Redaction[]) => Redaction[]) => {
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, redactions: f(e.redactions), approved: false } : e)));
  }, []);

  const create = useCallback(async () => {
    setConsent(false);
    setStep("results");
    cancel.current = { cancelled: false };
    setRunning(true);
    const q = QUALITY.find((x) => x.id === settings.quality) ?? QUALITY[0];
    const list = entriesRef.current.filter((e) => e.status === "ready" && e.doc);
    const taken = new Set<string>();
    setResults(list.map((e) => ({ id: e.id, name: e.file.name, status: "queued", message: "Waiting", progress: 0 })));
    setRecords([]);
    const recs: FileRecord[] = [];
    const upd = (id: string, p: Partial<ResultEntry>) => setResults((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
    for (const e of list) {
      if (cancel.current.cancelled) {
        upd(e.id, { status: "stopped", message: "Stopped before this file" });
        continue;
      }
      const init = {
        original: e.file.name,
        originalSha256: e.sha ?? "",
        originalBytes: e.file.size,
        converted: e.doc!.kind === "pdf" ? null : `from ${e.doc!.kind} to PDF pages`,
        pages: e.doc!.pageCount,
        notes: [...e.notes, ...(e.pagesWithoutText.length ? [`${e.pagesWithoutText.length} page(s) had no text layer and could not be searched.`] : [])],
        pagesWithoutText: e.pagesWithoutText.length,
      };
      try {
        upd(e.id, { status: "building", message: "Starting" });
        const built = await buildRedacted(
          e.doc!,
          e.redactions,
          q,
          settings.deep,
          (msg, d, t) => upd(e.id, { status: msg.startsWith("Checking") ? "checking" : "building", message: msg, progress: d && t ? d / t : 0 }),
          cancel.current
        );
        if (!built) {
          upd(e.id, { status: "stopped", message: "Stopped" });
          recs.push(recordFor(init, e.redactions, null, null));
          continue;
        }
        const name = built.verify.ok ? outputName(baseName(e.file.name), taken, extOf(e.file.name)) : undefined;
        recs.push(recordFor(init, e.redactions, built, name ?? null));
        if (built.verify.ok) upd(e.id, { status: "done", message: "Checked and ready", progress: 1, outName: name, blob: new Blob([built.flat.bytes as BlobPart], { type: "application/pdf" }), verify: built.verify });
        else upd(e.id, { status: "failed", message: "A check failed. No copy was kept.", verify: built.verify });
      } catch (err) {
        upd(e.id, { status: "failed", message: "Could not finish this file.", error: (err as Error).message });
        recs.push(recordFor(init, e.redactions, null, null));
      }
    }
    setRecords(recs);
    setRunning(false);
    void stopOcr();
  }, [settings.quality, settings.deep]);

  const report = useMemo(() => {
    const q = QUALITY.find((x) => x.id === settings.quality) ?? QUALITY[0];
    return makeReport(records, { dpi: q.dpi, jpegQuality: q.jpeg, ocr: settings.ocr, deepCheck: settings.deep });
  }, [records, settings.quality, settings.ocr, settings.deep]);

  const totals = useMemo(() => {
    const hidden = ready.reduce((n, e) => n + new Set(e.redactions.filter((r) => r.accepted).map((r) => (r.origin === "manual" ? r.id : r.group))).size, 0);
    return { files: ready.length, hidden, pages: ready.reduce((n, e) => n + (e.pages ?? 0), 0) };
  }, [ready]);

  const go = (s: Step) => setStep(s);
  const idx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="shell">
      <header className="top">
        <div className="brand" aria-label="Ebon">
          <span className="mark" aria-hidden="true" />
          <strong>Ebon</strong>
          <span className="tag">v{VERSION}</span>
        </div>
        <nav aria-label="Steps" className="steps">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              className={`step ${s.id === step ? "on" : ""} ${i < idx ? "past" : ""}`}
              aria-current={s.id === step ? "step" : undefined}
              disabled={running || scan.busy || (s.id !== "files" && ready.length === 0) || (s.id === "results" && !results.length) || (s.id === "review" && !ready.some((e) => e.scanned))}
              onClick={() => go(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="top-right">
          <a href="/docs/" target="_blank" rel="noreferrer">Guide</a>
          {entries.length > 0 && !running && (
            <button className="link" onClick={() => confirm("Remove all files from Ebon and start again? Your original files on disk are not touched.") && startAgain()}>
              Start again
            </button>
          )}
        </div>
      </header>

      <p className="privacy" role="note">
        Your files stay on this computer. Nothing is uploaded. Ebon makes new copies and never changes the originals.
      </p>

      <main>
        {step === "files" && <FilesStep entries={entries} onAdd={addFiles} onRemove={removeFile} onPassword={(id, pw) => { const e = entriesRef.current.find((x) => x.id === id); if (e) { patch(id, { status: "loading" }); load(id, e.file, pw); } }} onNext={() => go("rules")} />}
        {step === "rules" && <RulesStep settings={settings} onChange={setSettings} ready={ready} scan={scan} onFind={runScan} onCancel={() => (cancel.current.cancelled = true)} onBack={() => go("files")} />}
        {step === "review" && (
          <ReviewStep
            entries={ready}
            settings={settings}
            totals={totals}
            onChange={setRedactions}
            onApprove={(id, v) => patch(id, { approved: v })}
            onBack={() => go("rules")}
            onCreate={() => setConsent(true)}
          />
        )}
        {step === "results" && <ResultsStep results={results} running={running} report={report} text={reportText(report)} onStop={() => (cancel.current.cancelled = true)} onBack={() => go("review")} onAgain={startAgain} />}
      </main>

      {consent && <Consent files={totals.files} hidden={totals.hidden} pages={totals.pages} quality={settings.quality} empty={ready.filter((e) => !e.redactions.some((r) => r.accepted)).map((e) => e.file.name)} onCancel={() => setConsent(false)} onConfirm={create} />}
    </div>
  );
}
