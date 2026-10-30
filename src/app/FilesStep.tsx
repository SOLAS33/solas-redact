import { useRef, useState } from "react";
import { ACCEPT } from "../engine/sources/convert";
import { formatBytes, type FileEntry } from "./state";

interface Props {
  entries: FileEntry[];
  onAdd(files: File[]): void;
  onRemove(id: string): void;
  onPassword(id: string, pw: string): void;
  onNext(): void;
}

const KIND_LABEL: Record<string, string> = { pdf: "PDF", image: "Picture, converted to PDF", text: "Text, converted to PDF", email: "Email, converted to PDF", docx: "Word, converted to PDF" };

export function FilesStep({ entries, onAdd, onRemove, onPassword, onNext }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const ready = entries.filter((e) => e.status === "ready").length;
  const busy = entries.some((e) => e.status === "loading");

  return (
    <section className="panel" aria-labelledby="h-files">
      <h1 id="h-files">Add the files to redact</h1>
      <p className="lead">PDFs go in as they are. Pictures, Word .docx files, emails (.eml) and text files are converted to PDF first. Add as many as you like.</p>

      <div
        className={`drop ${over ? "over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const files = [...e.dataTransfer.files];
          if (files.length) onAdd(files);
        }}
      >
        <p>Drag files here</p>
        <button className="btn primary" onClick={() => input.current?.click()}>Choose files</button>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            if (files.length) onAdd(files);
            e.target.value = "";
          }}
          data-testid="file-input"
        />
      </div>

      {entries.length > 0 && (
        <ul className="files" aria-label="Files added">
          {entries.map((e) => (
            <li key={e.id} className={`file ${e.status}`}>
              <div className="file-main">
                <strong>{e.file.name}</strong>
                <span className="muted">
                  {formatBytes(e.file.size)}
                  {e.status === "ready" && e.doc ? ` · ${e.pages} page${e.pages === 1 ? "" : "s"} · ${KIND_LABEL[e.doc.kind]}` : ""}
                  {e.status === "loading" ? " · opening" : ""}
                </span>
                {e.status === "error" && <p className="err" role="alert">{e.error}</p>}
                {e.status === "password" && <PasswordRow wrong={!!e.wrongPassword} onSubmit={(pw) => onPassword(e.id, pw)} />}
                {e.status === "ready" && e.notes.map((n, i) => <p key={i} className="note">{n}</p>)}
              </div>
              <button className="link" onClick={() => onRemove(e.id)} aria-label={`Remove ${e.file.name}`}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <button className="btn primary big" disabled={ready === 0 || busy} onClick={onNext}>
          Choose what to hide
        </button>
        {entries.length > 0 && ready === 0 && !busy && <span className="muted">No file could be opened.</span>}
      </div>
    </section>
  );
}

function PasswordRow({ wrong, onSubmit }: { wrong: boolean; onSubmit(pw: string): void }) {
  const [pw, setPw] = useState("");
  return (
    <form
      className="pw"
      onSubmit={(e) => {
        e.preventDefault();
        if (pw) onSubmit(pw);
      }}
    >
      <label>
        {wrong ? "That password is not right. Try again:" : "This PDF needs a password to open:"}{" "}
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" />
      </label>{" "}
      <button className="btn" type="submit">Open</button>
    </form>
  );
}
