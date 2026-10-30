import { useState } from "react";
import { canSaveToFolder, download, pickFolder, saveToFolder, zipBlobs } from "../engine/output";
import type { Report } from "../engine/audit";
import { formatBytes, type ResultEntry } from "./state";

interface Props {
  results: ResultEntry[];
  running: boolean;
  report: Report;
  text: string;
  onStop(): void;
  onBack(): void;
  onAgain(): void;
}

const LABEL: Record<ResultEntry["status"], string> = { queued: "Waiting", building: "Making the copy", checking: "Checking the copy", done: "Ready", failed: "Not kept", stopped: "Stopped" };

export function ResultsStep({ results, running, report, text, onStop, onBack, onAgain }: Props) {
  const [msg, setMsg] = useState("");
  const done = results.filter((r) => r.status === "done" && r.blob);
  const failed = results.filter((r) => r.status === "failed");
  const reportFiles = () => [
    { name: "Ebon-report.txt", text },
    { name: "Ebon-report.json", text: JSON.stringify(report, null, 2) },
  ];

  const zipAll = async () => {
    setMsg("Packing the zip file");
    try {
      const blob = await zipBlobs([...done.map((r) => ({ name: r.outName!, blob: r.blob! })), ...reportFiles()]);
      download(blob, "Ebon-redacted-copies.zip");
      setMsg("");
    } catch (e) {
      setMsg(`Could not make the zip file: ${(e as Error).message}. Download the files one at a time instead.`);
    }
  };

  const toFolder = async () => {
    try {
      const dir = await pickFolder();
      const names = await saveToFolder(dir, [...done.map((r) => ({ name: r.outName!, blob: r.blob! })), ...reportFiles().map((f) => ({ name: f.name, blob: new Blob([f.text], { type: "text/plain" }) }))]);
      setMsg(`Saved ${names.length} file${names.length === 1 ? "" : "s"} to the folder. Files already there were not replaced.`);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsg(`Could not save to the folder: ${(e as Error).message}`);
    }
  };

  return (
    <section className="panel" aria-labelledby="h-res">
      <h1 id="h-res">{running ? "Making the copies" : "Redacted copies"}</h1>
      {!running && (
        <p className="lead">
          {done.length} cop{done.length === 1 ? "y" : "ies"} ready{failed.length ? `, ${failed.length} not kept because a check failed` : ""}. Nothing has been uploaded. The originals are untouched.
        </p>
      )}

      <ul className="results">
        {results.map((r) => (
          <li key={r.id} className={`res ${r.status}`}>
            <div className="res-head">
              <strong>{r.name}</strong>
              <span className={`pill ${r.status === "done" ? "ok" : r.status === "failed" ? "bad" : ""}`}>{LABEL[r.status]}</span>
            </div>
            {(r.status === "building" || r.status === "checking") && (
              <div role="status" aria-live="polite">
                <div className="bar"><i style={{ width: `${Math.round(r.progress * 100)}%` }} /></div>
                <p className="muted small">{r.message}</p>
              </div>
            )}
            {r.error && <p className="err" role="alert">{r.error}</p>}
            {r.status === "failed" && <p className="err">{r.message} Go back, change the settings or the boxes, and try again.</p>}
            {r.verify && (
              <details open={r.status === "failed"}>
                <summary>{r.verify.ok ? `All ${r.verify.checks.length} checks passed` : "Checks"}</summary>
                <ul className="checks">
                  {r.verify.checks.map((c) => (
                    <li key={c.id} className={c.ok ? "pass" : "fail"}>
                      <span aria-hidden="true">{c.ok ? "✓" : "✗"}</span> <strong>{c.label}.</strong> <span className="muted">{c.detail}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {r.status === "done" && r.blob && (
              <div className="actions tight">
                <button className="btn primary" onClick={() => download(r.blob!, r.outName!)}>Download {r.outName}</button>
                <span className="muted small">{formatBytes(r.blob.size)}</span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {running ? (
        <div className="actions"><button className="btn" onClick={onStop}>Stop after this file</button></div>
      ) : (
        <>
          <div className="actions">
            <button className="btn" onClick={onBack}>Back to review</button>
            {done.length > 0 && <button className="btn primary" onClick={zipAll}>Download all as a zip file</button>}
            {done.length > 0 && canSaveToFolder() && <button className="btn" onClick={toFolder}>Save to a folder</button>}
            <button className="btn" onClick={() => download(new Blob([text], { type: "text/plain" }), "Ebon-report.txt")}>Download the report</button>
          </div>
          {msg && <p role="status" className="note">{msg}</p>}
          <p className="muted small">
            The report lists file names, page counts, how many items were hidden by each rule, and a SHA-256 fingerprint of each original and each copy. It does not contain any of the hidden text.
          </p>
          <div className="actions">
            <button className="btn" onClick={() => confirm("Remove everything from Ebon? Copies you have not downloaded will be lost.") && onAgain()}>Finish and clear everything</button>
          </div>
        </>
      )}
    </section>
  );
}
