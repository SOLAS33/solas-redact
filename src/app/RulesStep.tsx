import { PATTERNS } from "../engine/patterns";
import { invalidTerms } from "../engine/search";
import { QUALITY } from "../engine/types";
import { findOptions, type FileEntry, type Settings } from "./state";

interface Props {
  settings: Settings;
  onChange(s: Settings): void;
  ready: FileEntry[];
  scan: { busy: boolean; message: string; pct: number };
  onFind(): void;
  onCancel(): void;
  onBack(): void;
}

export function RulesStep({ settings, onChange, ready, scan, onFind, onCancel, onBack }: Props) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  const opts = findOptions(settings);
  const bad = invalidTerms(opts.terms, opts);
  const togglePattern = (id: string) => set("patterns", settings.patterns.includes(id) ? settings.patterns.filter((p) => p !== id) : [...settings.patterns, id]);
  const pictures = ready.filter((e) => e.doc?.kind === "image").length;

  return (
    <section className="panel" aria-labelledby="h-rules">
      <h1 id="h-rules">What to hide</h1>
      <p className="lead">
        Type the words to hide, one per line, and tick the kinds of details to look for. Ebon marks every match in all {ready.length} file{ready.length === 1 ? "" : "s"}. You review each one before anything is made.
        You can also skip this and draw boxes by hand in the next step.
      </p>

      <div className="grid2">
        <div>
          <label htmlFor="terms"><strong>Words and names to hide</strong></label>
          <textarea
            id="terms"
            rows={8}
            value={settings.terms}
            onChange={(e) => set("terms", e.target.value)}
            placeholder={"Seán Murphy\n12 Main Street\nProject Falcon"}
            spellCheck={false}
          />
          <p className="muted small">
            One term per line. A line written between slashes, like <code>/case\s?\d+/</code>, is used as a pattern.
          </p>
          {bad.length > 0 && <p className="err" role="alert">Cannot use: {bad.join(", ")}</p>}
          <fieldset className="opts">
            <legend className="sr">Matching</legend>
            <label><input type="checkbox" checked={settings.wholeWord} onChange={(e) => set("wholeWord", e.target.checked)} /> Whole words only</label>
            <label><input type="checkbox" checked={settings.caseSensitive} onChange={(e) => set("caseSensitive", e.target.checked)} /> Match upper and lower case exactly</label>
            <label><input type="checkbox" checked={settings.ignoreAccents} onChange={(e) => set("ignoreAccents", e.target.checked)} /> Treat Seán and Sean as the same</label>
          </fieldset>
        </div>

        <div>
          <strong id="pat-h">Kinds of details to look for</strong>
          <ul className="patterns" aria-labelledby="pat-h">
            {PATTERNS.map((p) => (
              <li key={p.id}>
                <label>
                  <input type="checkbox" checked={settings.patterns.includes(p.id)} onChange={() => togglePattern(p.id)} /> {p.label} <span className="muted small">e.g. {p.example}</span>
                </label>
                <span className="muted small hint">{p.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h2>Options</h2>
      <div className="opts-row">
        <label>
          Page quality{" "}
          <select value={settings.quality} onChange={(e) => set("quality", e.target.value as Settings["quality"])}>
            {QUALITY.map((q) => (
              <option key={q.id} value={q.id}>{q.label}</option>
            ))}
          </select>
        </label>
        <label title="Reads text from pages that are pictures, so they can be searched. Slower. English only in this version.">
          <input type="checkbox" checked={settings.ocr} onChange={(e) => set("ocr", e.target.checked)} /> Read scanned pages and pictures (English text recognition)
        </label>
        <label title="After the copy is made, Ebon reads the finished pages again and looks for the hidden words. Slower.">
          <input type="checkbox" checked={settings.deep} onChange={(e) => set("deep", e.target.checked)} /> Read the finished pages to check nothing shows through
        </label>
      </div>
      {pictures > 0 && !settings.ocr && <p className="note">You added {pictures} picture file{pictures === 1 ? "" : "s"}. Without text recognition they cannot be searched. Draw boxes by hand in the next step.</p>}

      {scan.busy ? (
        <div className="progress" role="status" aria-live="polite">
          <div className="bar"><i style={{ width: `${scan.pct}%` }} /></div>
          <p>{scan.message}</p>
          <button className="btn" onClick={onCancel}>Stop</button>
        </div>
      ) : (
        <div className="actions">
          <button className="btn" onClick={onBack}>Back</button>
          <button className="btn primary big" disabled={bad.length > 0} onClick={onFind}>
            {opts.terms.length || opts.patterns.length ? "Find matches and review" : "Go to review"}
          </button>
        </div>
      )}
    </section>
  );
}
