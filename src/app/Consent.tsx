import { useEffect, useRef, useState } from "react";

interface Props {
  files: number;
  hidden: number;
  pages: number;
  quality: string;
  empty: string[];
  onCancel(): void;
  onConfirm(): void;
}

export function Consent({ files, hidden, pages, empty, onCancel, onConfirm }: Props) {
  const [ok, setOk] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input")?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onCancel]);

  return (
    <div className="modal-back" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="h-consent" ref={ref}>
        <h2 id="h-consent">Make permanent redacted copies?</h2>
        <p>
          Solas Redact will make {files} new PDF{files === 1 ? "" : "s"} from {pages} page{pages === 1 ? "" : "s"}, hiding {hidden} item{hidden === 1 ? "" : "s"}.
        </p>
        {empty.length > 0 && (
          <p className="note" role="alert">
            Nothing is hidden in {empty.length === 1 ? "this file" : `these ${empty.length} files`}: {empty.slice(0, 4).join(", ")}
            {empty.length > 4 ? ", ..." : ""}. {empty.length === 1 ? "Its copy" : "Their copies"} will look the same as the original, as page pictures.
          </p>
        )}
        <ul className="consent-list">
          <li><strong>The black boxes are permanent.</strong> The text and pictures under them are deleted from the copy. Nobody, including you, can bring them back from the copy.</li>
          <li><strong>The whole copy becomes page pictures.</strong> You cannot select, search or copy text in it, and links, forms, comments, bookmarks and attachments are gone.</li>
          <li><strong>Your original files are not changed.</strong> Solas Redact only makes new files, named with _REDACTED. Keep the originals if you may need them.</li>
          <li><strong>Check the result before you send it.</strong> Solas Redact checks each copy, but you are the one who decides what is safe to share.</li>
        </ul>
        <label className="consent-check">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I understand that the redactions in the copies are permanent.
        </label>
        <div className="actions">
          <button className="btn" onClick={onCancel}>Go back</button>
          <button className="btn primary" disabled={!ok} onClick={onConfirm}>Make the copies</button>
        </div>
      </div>
    </div>
  );
}
