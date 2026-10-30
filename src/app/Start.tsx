import { useRef, useState, type ReactNode } from "react";
import { ACCEPT } from "../engine/sources/convert";
import type { Mode } from "./state";

/** A button that opens the file picker. The input stays in the page so a drop or a test can use it directly. */
export function FilePick({ className, testId, onFiles, children }: { className: string; testId: string; onFiles(files: File[]): void; children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()}>{children}</button>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        data-testid={testId}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </>
  );
}

function Choice({ mode, no, title, line, onAdd }: { mode: Mode; no: string; title: string; line: string; onAdd(files: File[], mode: Mode): void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`choice-cell ${over ? "over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = [...e.dataTransfer.files];
        if (files.length) onAdd(files, mode);
      }}
    >
      <FilePick className="choice" testId={`file-input-${mode}`} onFiles={(f) => onAdd(f, mode)}>
        <span className="kicker">{no}</span>
        <span className={`glyph ${mode === "manual" ? "hand" : "scan"}`} aria-hidden="true">
          <i /><i /><i /><i /><i />
          {mode === "manual" ? <b /> : <><b /><b /><b /></>}
        </span>
        <span className="choice-title">{title}</span>
        <span className="choice-line">{line}</span>
        <span className="choice-go">Choose files <span aria-hidden="true">→</span></span>
      </FilePick>
    </div>
  );
}

export function Start({ onAdd }: { onAdd(files: File[], mode: Mode): void }) {
  return (
    <section className="start" aria-labelledby="h-start">
      <div className="start-head">
        <p className="kicker">Permanent redaction</p>
        <h1 id="h-start">Redact a document</h1>
      </div>
      <div className="choices">
        <Choice mode="manual" no="01" title="By hand" line="Draw over what should go." onAdd={onAdd} />
        <Choice mode="scan" no="02" title="Scan for words" line="Find names, numbers and details, then review." onAdd={onAdd} />
      </div>
      <p className="start-foot">PDF, Word, email, pictures and text. Or drop files on either option.</p>
    </section>
  );
}
