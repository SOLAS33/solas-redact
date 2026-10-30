import { useEffect, useMemo, useRef, useState } from "react";
import type { Redaction, SourceDoc } from "../engine/types";
import { newId } from "../engine/search";
import type { FileEntry, Settings } from "./state";

interface Props {
  entries: FileEntry[];
  settings: Settings;
  totals: { files: number; hidden: number; pages: number };
  onChange(id: string, f: (r: Redaction[]) => Redaction[]): void;
  onApprove(id: string, v: boolean): void;
  onBack(): void;
  onCreate(): void;
}

interface Row {
  key: string;
  group: string;
  page: number;
  rule: string;
  text: string;
  accepted: boolean;
  manual: boolean;
  ids: string[];
}

function rowsOf(reds: Redaction[]): Row[] {
  const by = new Map<string, Row>();
  for (const r of reds) {
    const key = r.origin === "manual" ? r.id : r.group;
    const row = by.get(key);
    if (row) {
      row.ids.push(r.id);
      row.accepted = row.accepted && r.accepted;
    } else by.set(key, { key, group: r.group, page: r.page, rule: r.rule, text: r.text, accepted: r.accepted, manual: r.origin === "manual", ids: [r.id] });
  }
  return [...by.values()].sort((a, b) => a.page - b.page);
}

export function ReviewStep({ entries, totals, onChange, onApprove, onBack, onCreate }: Props) {
  const [sel, setSel] = useState(entries[0]?.id);
  const [pageIndex, setPageIndex] = useState(0);
  const entry = entries.find((e) => e.id === sel) ?? entries[0];
  const allApproved = entries.length > 0 && entries.every((e) => e.approved);
  const rows = useMemo(() => (entry ? rowsOf(entry.redactions) : []), [entry]);

  useEffect(() => {
    setPageIndex(0);
  }, [entry?.id]);

  if (!entry || !entry.doc) return null;
  const doc: SourceDoc = entry.doc;
  const pageReds = entry.redactions.filter((r) => r.page === pageIndex);
  const toggleRow = (row: Row) => onChange(entry.id, (rs) => rs.map((r) => ((row.manual ? r.id === row.key : r.group === row.group) ? { ...r, accepted: !row.accepted } : r)));
  const setAll = (v: boolean) => onChange(entry.id, (rs) => rs.map((r) => (r.origin === "manual" ? r : { ...r, accepted: v })));
  const removeManual = (id: string) => onChange(entry.id, (rs) => rs.filter((r) => r.id !== id));
  const addManual = (rect: Redaction["rect"]) =>
    onChange(entry.id, (rs) => [...rs, { id: newId("m"), group: newId("g"), page: pageIndex, rect, origin: "manual", rule: "Drawn by hand", text: "", accepted: true }]);
  const hiddenHere = rows.filter((r) => r.accepted).length;

  return (
    <section className="review" aria-labelledby="h-review">
      <h1 id="h-review">Review before anything is made</h1>
      <p className="lead">
        Black boxes show what will be hidden. Click a box to keep that text instead. Drag on the page to draw a box of your own. Tick “Checked” on every file, then create the copies.
      </p>

      <div className="review-grid">
        <aside className="r-files" aria-label="Files">
          <ul>
            {entries.map((e) => {
              const n = rowsOf(e.redactions).filter((r) => r.accepted).length;
              return (
                <li key={e.id}>
                  <button className={`rf ${e.id === entry.id ? "on" : ""}`} onClick={() => setSel(e.id)} aria-current={e.id === entry.id}>
                    <span className="rf-name">{e.file.name}</span>
                    <span className="muted small">{n} to hide · {e.pages} page{e.pages === 1 ? "" : "s"}</span>
                    <span className={`pill ${e.approved ? "ok" : ""}`}>{e.approved ? "Checked" : "Not checked"}</span>
                    {n === 0 && <span className="pill warn">Nothing is hidden</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="r-page">
          <div className="pager">
            <button className="btn" disabled={pageIndex === 0} onClick={() => setPageIndex(pageIndex - 1)}>Previous page</button>
            <span>
              Page{" "}
              <input
                aria-label="Page number"
                className="pg"
                type="number"
                min={1}
                max={doc.pageCount}
                value={pageIndex + 1}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 1 && n <= doc.pageCount) setPageIndex(n - 1);
                }}
              />{" "}
              of {doc.pageCount}
            </span>
            <button className="btn" disabled={pageIndex >= doc.pageCount - 1} onClick={() => setPageIndex(pageIndex + 1)}>Next page</button>
          </div>
          {entry.pagesWithoutText.includes(pageIndex) && (
            <p className="note" role="note">This page is a picture with no text, so it was not searched. Check it by eye and draw boxes where needed.</p>
          )}
          <PageView doc={doc} index={pageIndex} reds={pageReds} onToggle={(r) => toggleRow({ key: r.origin === "manual" ? r.id : r.group, group: r.group, page: r.page, rule: r.rule, text: r.text, accepted: r.accepted, manual: r.origin === "manual", ids: [r.id] })} onDraw={addManual} onRemoveManual={removeManual} />
        </div>

        <aside className="r-list" aria-label="Matches">
          <div className="r-head">
            <strong>{hiddenHere} of {rows.length} will be hidden</strong>
            <span>
              <button className="link" onClick={() => setAll(true)}>All</button> · <button className="link" onClick={() => setAll(false)}>None</button>
            </span>
          </div>
          {rows.length === 0 && <p className="muted">No matches. Draw boxes on the page if something needs hiding.</p>}
          <ul className="matches">
            {rows.map((r) => (
              <li key={r.key} className={r.page === pageIndex ? "here" : ""}>
                <label>
                  <input type="checkbox" checked={r.accepted} onChange={() => toggleRow(r)} aria-label={`Hide ${r.manual ? "box drawn by hand" : r.text} on page ${r.page + 1}`} />
                </label>
                <button className="m-text" onClick={() => setPageIndex(r.page)}>
                  <span className="m-rule">{r.rule}</span>
                  <span className="m-val">{r.manual ? "Box drawn by hand" : r.text}</span>
                  <span className="muted small">page {r.page + 1}</span>
                </button>
                {r.manual && <button className="link" onClick={() => removeManual(r.key)} aria-label="Remove this box">Remove</button>}
              </li>
            ))}
          </ul>
          <label className="check-file">
            <input type="checkbox" checked={entry.approved} onChange={(e) => onApprove(entry.id, e.target.checked)} /> Checked: this file looks right
          </label>
          {entry.notes.map((n, i) => <p key={i} className="note small">{n}</p>)}
        </aside>
      </div>

      <div className="actions sticky">
        <button className="btn" onClick={onBack}>Back</button>
        <button className="btn" onClick={() => entries.forEach((e) => onApprove(e.id, true))}>Mark all files as checked</button>
        <button className="btn primary big" disabled={!allApproved} onClick={onCreate}>
          Create {totals.files} redacted cop{totals.files === 1 ? "y" : "ies"}
        </button>
        {!allApproved && <span className="muted">Tick “Checked” on every file first.</span>}
      </div>
    </section>
  );
}

interface PageViewProps {
  doc: SourceDoc;
  index: number;
  reds: Redaction[];
  onToggle(r: Redaction): void;
  onDraw(rect: Redaction["rect"]): void;
  onRemoveManual(id: string): void;
}

function PageView({ doc, index, reds, onToggle, onDraw, onRemoveManual }: PageViewProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const over = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(240, Math.min(900, Math.round(el.clientWidth / 40) * 40))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let dead = false;
    setError("");
    (async () => {
      try {
        const page = await doc.getPage(index);
        const scale = (width / page.widthPt) * Math.min(2, window.devicePixelRatio || 1);
        const off = document.createElement("canvas");
        await page.render(off, scale);
        if (dead || !canvas.current) return;
        canvas.current.width = off.width;
        canvas.current.height = off.height;
        canvas.current.getContext("2d")!.drawImage(off, 0, 0);
        off.width = off.height = 0;
        setDims({ w: page.widthPt, h: page.heightPt });
      } catch (e) {
        if (!dead) setError(`This page could not be drawn: ${(e as Error).message}`);
      }
    })();
    return () => {
      dead = true;
    };
  }, [doc, index, width]);

  const frac = (e: React.PointerEvent) => {
    const r = over.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  return (
    <div className="pv" ref={wrap}>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="pv-page" style={{ width, aspectRatio: dims ? `${dims.w} / ${dims.h}` : "1 / 1.414" }}>
        <canvas ref={canvas} className="pv-canvas" aria-label={`Page ${index + 1}`} />
        <div
          ref={over}
          className="pv-over"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            const p = frac(e);
            setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
          }}
          onPointerMove={(e) => {
            if (draft) {
              const p = frac(e);
              setDraft({ ...draft, x1: p.x, y1: p.y });
            }
          }}
          onPointerUp={() => {
            if (draft && dims) {
              const x = Math.min(draft.x0, draft.x1) * dims.w;
              const y = Math.min(draft.y0, draft.y1) * dims.h;
              const w = Math.abs(draft.x1 - draft.x0) * dims.w;
              const h = Math.abs(draft.y1 - draft.y0) * dims.h;
              if (w > 4 && h > 4) onDraw({ x, y, w, h });
            }
            setDraft(null);
          }}
          data-testid="overlay"
        >
          {dims &&
            reds.map((r) => (
              <button
                key={r.id}
                className={`box ${r.accepted ? "on" : "off"} ${r.origin === "manual" ? "manual" : ""}`}
                style={{ left: `${(r.rect.x / dims.w) * 100}%`, top: `${(r.rect.y / dims.h) * 100}%`, width: `${(r.rect.w / dims.w) * 100}%`, height: `${(r.rect.h / dims.h) * 100}%` }}
                onClick={() => (r.origin === "manual" ? onRemoveManual(r.id) : onToggle(r))}
                aria-label={r.origin === "manual" ? "Box drawn by hand. Click to remove." : `${r.accepted ? "Will be hidden" : "Kept"}: ${r.text}. Click to ${r.accepted ? "keep" : "hide"}.`}
                title={r.origin === "manual" ? "Click to remove this box" : r.accepted ? "Click to keep this text" : "Click to hide this text"}
              />
            ))}
          {draft && <div className="box draft" style={{ left: `${Math.min(draft.x0, draft.x1) * 100}%`, top: `${Math.min(draft.y0, draft.y1) * 100}%`, width: `${Math.abs(draft.x1 - draft.x0) * 100}%`, height: `${Math.abs(draft.y1 - draft.y0) * 100}%` }} />}
        </div>
      </div>
    </div>
  );
}
