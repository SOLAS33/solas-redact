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

const LABEL: Record<ResultEntry["status"], string> = { queued: "Waiting", building: "Making", checking: "Checking", done: "Ready", failed: "Not kept", stopped: "Stopped" };

export function ResultsStep({ results, running, report, text, onStop, onBack, onAgain }: Props) {
  const [msg, setMsg] = useState("");
  const done = results.filter((r) => r.status === "done" && r.blob);
  const failed = results.filter((r) => r.status === "failed");
  const single = results.length === 1;
  const reportFiles = () => [
    { name: "Solas-Redact-report.txt", text },
    { name: "Solas-Redact-report.json", text: JSON.stringify(report, null, 2) },
  ];

  const zipAll = async () => {
    setMsg("Packing the zip file");
    try {
      const blob = await zipBlobs([...done.map((r) => ({ name: r.outName!, blob: r.blob! })), ...reportFiles()]);
      download(blob, "Solas-Redact-copies.zip");
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
    <section className="page" aria-labelledby="h-res">
      <div className="page-head">
        <p className="kicker">
          {running ? "Working on this device" : `${done.length} ready${failed.length ? ` · ${failed.length} not kept` : ""}`}
        </p>
        <h1 id="h-res">{running ? "Making the copies" : "Redacted copies"}</h1>
      </div>

      {!running && done.length > 1 && (
        <div className="actions lead-action">
          <button className="btn primary big" onClick={zipAll}>Download all as a zip file</button>
        </div>
      )}

      <ul className="results">
        {results.map((r) => (
          <li key={r.id} className={`res ${r.status}`}>
            <div className="res-head">
              <strong>{r.outName ?? r.name}</strong>
              {r.status === "done" && r.blob ? (
                <span className="res-size">{formatBytes(r.blob.size)}</span>
              ) : (
                <span className={`state ${r.status === "failed" ? "bad" : ""}`}>{LABEL[r.status]}</span>
              )}
              {r.status === "done" && r.blob && (
                <button className={`btn dl ${single ? "primary" : ""}`} data-name={r.outName} onClick={() => download(r.blob!, r.outName!)}>
                  Download
                </button>
              )}
            </div>
            {(r.status === "building" || r.status === "checking") && (
              <div role="status" aria-live="polite">
                <div className="bar"><i style={{ width: `${Math.round(r.progress * 100)}%` }} /></div>
                <p className="muted small">{r.message}</p>
              </div>
            )}
            {r.error && <p className="err" role="alert">{r.error}</p>}
            {r.status === "failed" && <p className="err">{r.message} Go back, change the boxes or settings, and try again.</p>}
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
          </li>
        ))}
      </ul>

      {running ? (
        <div className="actions"><button className="link" onClick={onStop}>Stop after this file</button></div>
      ) : (
        <>
          <div className="actions secondary">
            <button className="link" onClick={() => download(new Blob([text], { type: "text/plain" }), "Solas-Redact-report.txt")} title="File names, counts and SHA-256 fingerprints. It contains none of the hidden text.">Download the report</button>
            {done.length > 0 && canSaveToFolder() && <button className="link" onClick={toFolder}>Save to a folder</button>}
            <button className="link" onClick={onBack}>Back to review</button>
            <button className="link" onClick={() => confirm("Remove everything from Solas Redact? Copies you have not downloaded will be lost.") && onAgain()}>Clear everything</button>
          </div>
          {msg && <p role="status" className="note">{msg}</p>}
        </>
      )}
    </section>
  );
}
