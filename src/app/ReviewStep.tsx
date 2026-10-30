import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Redaction, SourceDoc } from "../engine/types";
import { newId } from "../engine/search";
import type { FileEntry, Mode } from "./state";
import { FilePick } from "./Start";

interface Props {
  entries: FileEntry[];
  mode: Mode;
  totals: { files: number; hidden: number; pages: number };
  onChange(id: string, f: (r: Redaction[]) => Redaction[]): void;
  onSeen(id: string, page: number): void;
  onAdd(files: File[]): void;
  onScan(): void;
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

export function ReviewStep({ entries, mode, totals, onChange, onSeen, onAdd, onScan, onCreate }: Props) {
  const [sel, setSel] = useState(entries[0]?.id);
  const [pageIndex, setPageIndex] = useState(0);
  const [fitWidth, setFitWidth] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const history = useRef<Array<{ id: string; reds: Redaction[] }>>([]);
  const entry = entries.find((e) => e.id === sel) ?? entries[0];
  const rows = useMemo(() => (entry ? rowsOf(entry.redactions) : []), [entry]);
  const pageCount = entry?.doc?.pageCount ?? 1;

  useEffect(() => {
    setPageIndex(0);
  }, [entry?.id]);

  const entryId = entry?.id;
  useEffect(() => {
    if (entryId) onSeen(entryId, pageIndex);
  }, [entryId, pageIndex, onSeen]);

  // Every change to the boxes goes through here, so one Undo covers drawing, removing and keeping.
  const change = (f: (r: Redaction[]) => Redaction[]) => {
    if (!entry) return;
    history.current.push({ id: entry.id, reds: entry.redactions });
    setUndoCount(history.current.length);
    onChange(entry.id, f);
  };
  const undo = useCallback(() => {
    const last = history.current.pop();
    setUndoCount(history.current.length);
    if (!last) return;
    setSel(last.id);
    onChange(last.id, () => last.reds);
  }, [onChange]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches?.("input, textarea, select")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (e.key === "ArrowRight" || e.key === "PageDown") setPageIndex((p) => Math.min(pageCount - 1, p + 1));
      else if (e.key === "ArrowLeft" || e.key === "PageUp") setPageIndex((p) => Math.max(0, p - 1));
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [undo, pageCount]);

  if (!entry || !entry.doc) return null;
  const doc: SourceDoc = entry.doc;
  const pageReds = entry.redactions.filter((r) => r.page === pageIndex);
  const toggleRow = (row: Row) => change((rs) => rs.map((r) => ((row.manual ? r.id === row.key : r.group === row.group) ? { ...r, accepted: !row.accepted } : r)));
  const setAll = (v: boolean) => change((rs) => rs.map((r) => (r.origin === "manual" ? r : { ...r, accepted: v })));
  const removeManual = (id: string) => change((rs) => rs.filter((r) => r.id !== id));
  const addManual = (rect: Redaction["rect"]) => change((rs) => [...rs, { id: newId("m"), group: newId("g"), page: pageIndex, rect, origin: "manual", rule: "Drawn by hand", text: "", accepted: true }]);
  const hiddenHere = rows.filter((r) => r.accepted).length;
  const showList = mode === "scan";

  return (
    <section className={`work ${entries.length > 1 ? "with-rail" : ""} ${showList ? "with-list" : ""}`} aria-labelledby="h-review">
      <h1 id="h-review" className="sr">{mode === "scan" ? "Review matches" : "Redact by hand"}</h1>

      <div className="bar-top">
        <div className="bt-left">
          <span className="bt-file" title={entry.file.name}>{entry.file.name}</span>
          <FilePick className="link quiet" testId="file-input" onFiles={onAdd}>Add files</FilePick>
          {mode === "manual" ? <button className="link quiet" onClick={onScan}>Scan for words</button> : <button className="link quiet" onClick={onScan}>Edit search</button>}
        </div>
        <div className="pager">
          <button className="icon" aria-label="Previous page" disabled={pageIndex === 0} onClick={() => setPageIndex(pageIndex - 1)}>‹</button>
          <span className="pager-n">
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
            />
            <span className="muted"> / {doc.pageCount}</span>
          </span>
          <button className="icon" aria-label="Next page" disabled={pageIndex >= doc.pageCount - 1} onClick={() => setPageIndex(pageIndex + 1)}>›</button>
        </div>
        <div className="bt-right">
          <button className="btn quiet" disabled={undoCount === 0} onClick={undo} title="Ctrl+Z">Undo</button>
          <button className="btn quiet" aria-pressed={fitWidth} onClick={() => setFitWidth(!fitWidth)}>{fitWidth ? "Fit page" : "Fit width"}</button>
          <button className="btn primary" onClick={onCreate}>
            {totals.files === 1 ? "Create redacted copy" : `Create ${totals.files} redacted copies`}
          </button>
        </div>
      </div>

      {entries.length > 1 && (
        <aside className="rail" aria-label="Files">
          <ul>
            {entries.map((e) => {
              const n = rowsOf(e.redactions).filter((r) => r.accepted).length;
              return (
                <li key={e.id}>
                  <button className={`rf ${e.id === entry.id ? "on" : ""}`} onClick={() => setSel(e.id)} aria-current={e.id === entry.id}>
                    <span className="rf-name">{e.file.name}</span>
                    <span className="rf-meta">{n} hidden · {e.pages} pp</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      )}

      <div className="stage-wrap">
        {entry.pagesWithoutText.includes(pageIndex) && <p className="note stage-note" role="note">This page is a picture and was not searched. Check it by eye.</p>}
        {entry.notes.map((n, i) => <p key={i} className="note stage-note">{n}</p>)}
        <PageView doc={doc} index={pageIndex} fitWidth={fitWidth} reds={pageReds} onToggle={(r) => toggleRow({ key: r.origin === "manual" ? r.id : r.group, group: r.group, page: r.page, rule: r.rule, text: r.text, accepted: r.accepted, manual: r.origin === "manual", ids: [r.id] })} onDraw={addManual} onRemoveManual={removeManual} />
      </div>

      {showList && (
        <aside className="list" aria-label="Matches">
          <div className="list-head">
            <span className="kicker">{hiddenHere} of {rows.length} hidden</span>
            <span className="list-all">
              <button className="link quiet" onClick={() => setAll(true)}>All</button>
              <button className="link quiet" onClick={() => setAll(false)}>None</button>
            </span>
          </div>
          {rows.length === 0 && <p className="muted small list-empty">No matches in this file.</p>}
          <ul className="matches">
            {rows.map((r) => (
              <li key={r.key} className={r.page === pageIndex ? "here" : ""}>
                <input type="checkbox" checked={r.accepted} onChange={() => toggleRow(r)} aria-label={`Hide ${r.manual ? "box drawn by hand" : r.text} on page ${r.page + 1}`} />
                <button className="m-text" onClick={() => setPageIndex(r.page)}>
                  <span className="m-val">{r.manual ? "Box drawn by hand" : r.text}</span>
                  <span className="m-rule">{r.rule} · p{r.page + 1}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </section>
  );
}

interface PageViewProps {
  doc: SourceDoc;
  index: number;
  fitWidth: boolean;
  reds: Redaction[];
  onToggle(r: Redaction): void;
  onDraw(rect: Redaction["rect"]): void;
  onRemoveManual(id: string): void;
}

const STAGE_PAD = 40; // room around the page, in CSS pixels

function PageView({ doc, index, fitWidth, reds, onToggle, onDraw, onRemoveManual }: PageViewProps) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const over = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ w: 800, h: 600 });
  const [dims, setDims] = useState<{ doc: SourceDoc; index: number; w: number; h: number } | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRoom({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let dead = false;
    setError("");
    (async () => {
      try {
        const page = await doc.getPage(index);
        if (!dead) setDims({ doc, index, w: page.widthPt, h: page.heightPt });
      } catch (e) {
        if (!dead) setError(`This page could not be drawn: ${(e as Error).message}`);
      }
    })();
    return () => {
      dead = true;
    };
  }, [doc, index]);

  const current = dims && dims.doc === doc && dims.index === index ? dims : null;
  // The page takes all the room it can: the whole page in view, or the full width when asked.
  const availW = Math.max(240, room.w - STAGE_PAD);
  const availH = Math.max(240, room.h - STAGE_PAD);
  const exact = current ? (fitWidth ? availW : Math.min(availW, availH * (current.w / current.h))) : availW;
  const width = Math.max(240, Math.round(exact / 10) * 10);

  useEffect(() => {
    if (!current) return;
    let dead = false;
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
      } catch (e) {
        if (!dead) setError(`This page could not be drawn: ${(e as Error).message}`);
      }
    })();
    return () => {
      dead = true;
    };
  }, [doc, index, width, current]);

  const frac = (e: React.PointerEvent) => {
    const r = over.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  return (
    <div className="stage" ref={stage}>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="pv-page" style={{ width, aspectRatio: current ? `${current.w} / ${current.h}` : "1 / 1.414" }}>
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
            if (draft && current) {
              const x = Math.min(draft.x0, draft.x1) * current.w;
              const y = Math.min(draft.y0, draft.y1) * current.h;
              const w = Math.abs(draft.x1 - draft.x0) * current.w;
              const h = Math.abs(draft.y1 - draft.y0) * current.h;
              if (w > 4 && h > 4) onDraw({ x, y, w, h });
            }
            setDraft(null);
          }}
          data-testid="overlay"
        >
          {current &&
            reds.map((r) => (
              <button
                key={r.id}
                className={`box ${r.accepted ? "on" : "off"} ${r.origin === "manual" ? "manual" : ""}`}
                style={{ left: `${(r.rect.x / current.w) * 100}%`, top: `${(r.rect.y / current.h) * 100}%`, width: `${(r.rect.w / current.w) * 100}%`, height: `${(r.rect.h / current.h) * 100}%` }}
                onClick={() => (r.origin === "manual" ? onRemoveManual(r.id) : onToggle(r))}
                aria-label={r.origin === "manual" ? "Box drawn by hand. Click to remove." : `${r.accepted ? "Will be hidden" : "Kept"}: ${r.text}. Click to ${r.accepted ? "keep" : "hide"}.`}
                title={r.origin === "manual" ? "Click to remove" : r.accepted ? "Click to keep this text" : "Click to hide this text"}
              />
            ))}
          {draft && <div className="box draft" style={{ left: `${Math.min(draft.x0, draft.x1) * 100}%`, top: `${Math.min(draft.y0, draft.y1) * 100}%`, width: `${Math.abs(draft.x1 - draft.x0) * 100}%`, height: `${Math.abs(draft.y1 - draft.y0) * 100}%` }} />}
        </div>
      </div>
    </div>
  );
}
