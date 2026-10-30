import { useState } from "react";
import { formatBytes, type FileEntry } from "./state";
import { FilePick } from "./Start";

interface Props {
  entries: FileEntry[];
  onAdd(files: File[]): void;
  onRemove(id: string): void;
  onPassword(id: string, pw: string): void;
  onNext(): void;
}

const KIND_LABEL: Record<string, string> = { pdf: "PDF", image: "Picture, converted to PDF", text: "Text, converted to PDF", email: "Email, converted to PDF", docx: "Word, converted to PDF" };

/** Shown only when a file needs attention: it could not be opened or needs a password. A clean add skips this screen. */
export function FilesStep({ entries, onAdd, onRemove, onPassword, onNext }: Props) {
  const ready = entries.filter((e) => e.status === "ready").length;
  const busy = entries.some((e) => e.status === "loading");

  return (
    <section className="page" aria-labelledby="h-files">
      <div className="page-head">
        <p className="kicker">{entries.length} file{entries.length === 1 ? "" : "s"}</p>
        <h1 id="h-files">Your files</h1>
      </div>

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

      <div className="actions">
        <button className="btn primary big" disabled={ready === 0 || busy} onClick={onNext}>Continue</button>
        <FilePick className="link" testId="file-input" onFiles={onAdd}>Add files</FilePick>
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
