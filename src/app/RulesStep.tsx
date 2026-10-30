import { PATTERNS } from "../engine/patterns";
import { invalidTerms } from "../engine/search";
import { findOptions, type FileEntry, type Settings } from "./state";

interface Props {
  settings: Settings;
  onChange(s: Settings): void;
  ready: FileEntry[];
  scan: { busy: boolean; message: string; pct: number };
  onFind(): void;
  onCancel(): void;
  onBack(): void;
  onManual(): void;
}

export function RulesStep({ settings, onChange, ready, scan, onFind, onCancel, onBack, onManual }: Props) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  const opts = findOptions(settings);
  const bad = invalidTerms(opts.terms, opts);
  const togglePattern = (id: string) => set("patterns", settings.patterns.includes(id) ? settings.patterns.filter((p) => p !== id) : [...settings.patterns, id]);
  const pictures = ready.filter((e) => e.doc?.kind === "image").length;
  const nothing = !opts.terms.length && !opts.patterns.length;

  return (
    <section className="page" aria-labelledby="h-rules">
      <div className="page-head">
        <p className="kicker">{ready.length} file{ready.length === 1 ? "" : "s"}</p>
        <h1 id="h-rules">Scan for words</h1>
      </div>

      <div className="scan-grid">
        <div>
          <label className="field-label" htmlFor="terms">Words and names, one per line</label>
          <textarea id="terms" rows={11} value={settings.terms} onChange={(e) => set("terms", e.target.value)} placeholder={"Seán Murphy\n12 Main Street\nProject Falcon"} spellCheck={false} />
          {bad.length > 0 && <p className="err" role="alert">Cannot use: {bad.join(", ")}</p>}
        </div>

        <div>
          <span className="field-label" id="pat-h">Also find</span>
          <ul className="patterns" aria-labelledby="pat-h">
            {PATTERNS.map((p) => (
              <li key={p.id}>
                <label title={`${p.note} Example: ${p.example}`}>
                  <input type="checkbox" checked={settings.patterns.includes(p.id)} onChange={() => togglePattern(p.id)} /> {p.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <details className="more">
        <summary>Search options</summary>
        <div className="more-body">
          <label><input type="checkbox" checked={settings.wholeWord} onChange={(e) => set("wholeWord", e.target.checked)} /> Whole words only</label>
          <label><input type="checkbox" checked={settings.caseSensitive} onChange={(e) => set("caseSensitive", e.target.checked)} /> Match upper and lower case exactly</label>
          <label><input type="checkbox" checked={settings.ignoreAccents} onChange={(e) => set("ignoreAccents", e.target.checked)} /> Treat Seán and Sean as the same</label>
          <label><input type="checkbox" checked={settings.ocr} onChange={(e) => set("ocr", e.target.checked)} /> Read scanned pages and pictures (English)</label>
          <p className="muted small">A line written between slashes, like <code>/case\s?\d+/</code>, is used as a pattern.</p>
        </div>
      </details>
      {pictures > 0 && !settings.ocr && <p className="note">{pictures} picture file{pictures === 1 ? "" : "s"} cannot be searched with text recognition off. Draw boxes on them by hand.</p>}

      {scan.busy ? (
        <div className="progress" role="status" aria-live="polite">
          <div className="bar"><i style={{ width: `${scan.pct}%` }} /></div>
          <p className="muted small">{scan.message}</p>
          <button className="link" onClick={onCancel}>Stop</button>
        </div>
      ) : (
        <div className="actions">
          <button className="btn primary big" disabled={bad.length > 0 || nothing} onClick={onFind}>Scan documents</button>
          <button className="link" onClick={onManual}>Redact by hand instead</button>
          <button className="link" onClick={onBack}>Back</button>
        </div>
      )}
    </section>
  );
}
