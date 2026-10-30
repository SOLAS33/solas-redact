import { Zip, ZipPassThrough, strToU8 } from "fflate";

/** Output file names: original name + _REDACTED.pdf. If two files share a name (scan.pdf and scan.png) the second gets its original extension in the name. */
export function outputName(base: string, taken: Set<string>, ext = ""): string {
  const clean = base.replace(/[\\/:*?"<>|]+/g, "_").trim() || "document";
  const tryName = (stem: string) => {
    const name = `${stem}_REDACTED.pdf`;
    if (taken.has(name.toLowerCase())) return null;
    taken.add(name.toLowerCase());
    return name;
  };
  const first = tryName(clean);
  if (first) return first;
  if (ext && ext !== "pdf") {
    const second = tryName(`${clean}-${ext}`);
    if (second) return second;
  }
  for (let n = 2; ; n++) {
    const next = tryName(`${clean}-${n}`);
    if (next) return next;
  }
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Build a zip from files without holding a second full copy in one array: chunks go straight into a Blob. */
export async function zipBlobs(entries: Array<{ name: string; blob: Blob } | { name: string; text: string }>): Promise<Blob> {
  const chunks: Uint8Array[] = [];
  let failure: Error | null = null;
  let finish!: () => void;
  const done = new Promise<void>((r) => (finish = r));
  const zip = new Zip((err, chunk, final) => {
    if (err) failure = err;
    else chunks.push(chunk);
    if (final) finish();
  });
  for (const e of entries) {
    const f = new ZipPassThrough(e.name);
    zip.add(f);
    if ("blob" in e) f.push(new Uint8Array(await e.blob.arrayBuffer()), true);
    else f.push(strToU8(e.text), true);
  }
  zip.end();
  await done;
  if (failure) throw failure;
  return new Blob(chunks as BlobPart[], { type: "application/zip" });
}

type DirHandle = {
  getFileHandle(name: string, o?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }>;
};

export function canSaveToFolder(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

export async function pickFolder(): Promise<DirHandle> {
  return (window as unknown as { showDirectoryPicker(o: { mode: string }): Promise<DirHandle> }).showDirectoryPicker({ mode: "readwrite" });
}

/** Write into a chosen folder without ever replacing a file that is already there. Returns the names used. */
export async function saveToFolder(dir: DirHandle, files: Array<{ name: string; blob: Blob }>): Promise<string[]> {
  const used: string[] = [];
  for (const f of files) {
    let name = f.name;
    for (let n = 2; ; n++) {
      try {
        await dir.getFileHandle(name); // exists: pick another name
        name = f.name.replace(/(\.[^.]+)$/, `-${n}$1`);
      } catch {
        break;
      }
    }
    const h = await dir.getFileHandle(name, { create: true });
    const w = await h.createWritable();
    await w.write(f.blob);
    await w.close();
    used.push(name);
  }
  return used;
}
