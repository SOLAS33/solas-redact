import { useEffect, useRef, useState } from "react";
import { QUALITY } from "../engine/types";
import type { Settings } from "./state";

interface Props {
  files: number;
  hidden: number;
  pages: number;
  settings: Settings;
  onChange(s: Settings): void;
  empty: string[];
  /** Files with pages the person has not looked at, and how many. */
  unseen: Array<{ name: string; pages: number }>;
  onCancel(): void;
  onConfirm(): void;
}

export function Consent({ files, hidden, pages, settings, onChange, empty, unseen, onCancel, onConfirm }: Props) {
  const [ok, setOk] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(".consent-check input")?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onCancel]);

  return (
    <div className="modal-back" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="h-consent" ref={ref}>
        <p className="kicker">{files} file{files === 1 ? "" : "s"} · {pages} page{pages === 1 ? "" : "s"} · {hidden} hidden</p>
        <h2 id="h-consent">Create permanent copies?</h2>
        {empty.length > 0 && (
          <p className="note" role="alert">
            Nothing is hidden in {empty.slice(0, 4).join(", ")}{empty.length > 4 ? `, and ${empty.length - 4} more` : ""}.
          </p>
        )}
        {unseen.length > 0 && (
          <p className="note" role="alert">
            Pages not yet viewed: {unseen.slice(0, 4).map((u) => `${u.name} (${u.pages})`).join(", ")}{unseen.length > 4 ? `, and ${unseen.length - 4} more files` : ""}.
          </p>
        )}
        <ul className="consent-list">
          <li>What is under the boxes is deleted from the copy, for good.</li>
          <li>Each copy becomes page pictures, with no selectable text, links or forms.</li>
          <li>Your original files are not changed.</li>
          <li>Check each copy before you send it.</li>
        </ul>
        <details className="more">
          <summary>Output options</summary>
          <div className="more-body">
            <label>
              Page quality{" "}
              <select value={settings.quality} onChange={(e) => onChange({ ...settings, quality: e.target.value as Settings["quality"] })}>
                {QUALITY.map((q) => (
                  <option key={q.id} value={q.id}>{q.label}</option>
                ))}
              </select>
            </label>
            <label><input type="checkbox" checked={settings.deep} onChange={(e) => onChange({ ...settings, deep: e.target.checked })} /> Read the finished pages to check nothing shows through</label>
          </div>
        </details>
        <label className="consent-check">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I understand these redactions are permanent.
        </label>
        <div className="actions">
          <button className="btn primary" disabled={!ok} onClick={onConfirm}>Make the copies</button>
          <button className="link" onClick={onCancel}>Go back</button>
        </div>
      </div>
    </div>
  );
}
