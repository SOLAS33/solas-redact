/**
 * End-to-end test in a real Chrome: the built app, served with its real security headers.
 *   npm run build && npm run test:e2e        (CHROME_PATH can point at any Chrome or Chromium)
 * It adds seven kinds of file, searches, reviews, makes copies, downloads them, and then checks the downloaded files
 * with separate code (a different build of the PDF reader and raw byte searches), not with the app's own checks.
 */
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import puppeteer, { type ElementHandle, type Page } from "puppeteer-core";
import { unzipSync, strFromU8 } from "fflate";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument, PDFName } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";
import { SECRETS, helveticaWidth, makeFixtures } from "../fixtures/make";

const root = join(import.meta.dirname, "..", "..");
const dist = join(root, "dist");
const out = join(import.meta.dirname, "out");
const shots = process.env.SCREENSHOTS ? join(root, "docs", "img") : join(out, "shots");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
mkdirSync(shots, { recursive: true });
const downloads = join(out, "downloads");
mkdirSync(downloads);

// ---- serve dist with the headers from public/_headers ----
const headerRules: Array<{ path: string; headers: Record<string, string> }> = [];
{
  let cur: { path: string; headers: Record<string, string> } | null = null;
  for (const line of readFileSync(join(dist, "_headers"), "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (!line.startsWith(" ")) headerRules.push((cur = { path: line.trim(), headers: {} }));
    else if (cur) {
      const i = line.indexOf(":");
      cur.headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
}
const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".wasm": "application/wasm", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url!, "http://x").pathname);
  let file = join(dist, p);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
    return;
  }
  const h: Record<string, string> = { "Content-Type": types[extname(file)] ?? "application/octet-stream" };
  for (const r of headerRules) {
    const match = r.path === "/*" || r.path === p || (r.path.endsWith("/*") && p.startsWith(r.path.slice(0, -1)));
    if (match) Object.assign(h, r.headers);
  }
  res.writeHead(200, h).end(readFileSync(file));
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

const chrome = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
if (!chrome) throw new Error("No Chrome found. Set CHROME_PATH.");
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });

let failures = 0;
const check = (ok: boolean, what: string, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  -> ${detail}` : ""}`);
  if (!ok) failures++;
};
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- a picture of text, drawn in the browser ----
const scanSecret = "Seamus Gallagher";
const tmp = await browser.newPage();
const scanDataUrl: string = await tmp.evaluate((secret: string) => {
  const c = document.createElement("canvas");
  c.width = 1800;
  c.height = 660;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#000";
  ctx.font = "bold 84px Arial, Helvetica, sans-serif";
  ctx.fillText("Account holder:", 70, 230);
  ctx.fillText(secret, 70, 470);
  return c.toDataURL("image/png");
}, scanSecret);
await tmp.close();
const fx = await makeFixtures(join(out, "files"), Buffer.from(scanDataUrl.split(",")[1], "base64"));
const originals = [fx.contract, fx.scanPdf, join(fx.dir, "scan.png"), fx.notes, fx.mail, fx.letter, fx.rotated, fx.sheet];
const originalHashes = originals.map(sha);

// ---- the app ----
const requests: string[] = [];
const problems: string[] = [];
async function newPage(): Promise<Page> {
  const page = await browser.newPage();
  // the test runner adds a helper named __name to functions; the page needs a stand-in
  await page.evaluateOnNewDocument("window.__name = (f) => f;");
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
  page.on("request", (r) => requests.push(r.url()));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" || /Content Security Policy|Refused to/i.test(t)) problems.push(`${m.type()}: ${t}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e}`));
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  return page;
}
const page = await newPage();

async function clickButton(p: Page, text: string): Promise<void> {
  const h = await p.evaluateHandle((t: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(t) && !(b as HTMLButtonElement).disabled), text);
  const el = h.asElement() as ElementHandle<Element> | null;
  if (!el) throw new Error(`No enabled button starting "${text}"`);
  await el.click();
}
async function tickLabel(p: Page, text: string): Promise<void> {
  const ok = await p.evaluate((t: string) => {
    const l = [...document.querySelectorAll("label")].find((x) => x.textContent?.includes(t));
    const i = l?.querySelector("input[type=checkbox]") as HTMLInputElement | null;
    if (!i) return false;
    if (!i.checked) i.click();
    return true;
  }, text);
  if (!ok) throw new Error(`No checkbox labelled "${text}"`);
}
const h1 = (p: Page) => p.$eval("h1", (e) => e.textContent ?? "");
async function waitH1(p: Page, text: string, timeout = 120_000): Promise<void> {
  await p.waitForFunction((t: string) => document.querySelector("h1")?.textContent?.includes(t), { timeout }, text);
}
const rowsText = (p: Page) => p.$$eval(".matches li", (els) => els.map((e) => (e.textContent ?? "").replace(/\s+/g, " ").trim()));

await page.goto(`${base}/app/`);
await waitH1(page, "Add the files to redact");
check((await h1(page)).includes("Add the files"), "app opens at /app/");
check(!!(await page.$("input[type=file]")), "file picker is present");

// ---- 1. add files ----
const input = await page.$("input[type=file]");
await input!.uploadFile(fx.contract, fx.scanPdf, join(fx.dir, "scan.png"), fx.notes, fx.mail, fx.letter, fx.rotated, fx.sheet);
await page.waitForFunction(() => document.querySelectorAll(".file.ready").length === 7 && document.querySelectorAll(".file.error").length === 1, { timeout: 120_000 });
const errText = await page.$eval(".file.error", (e) => e.textContent ?? "");
check(errText.includes("Excel") && errText.includes("Save as PDF"), "an unsupported file is refused with a plain explanation", errText);
const fileText = await page.$$eval(".file", (els) => els.map((e) => e.textContent ?? ""));
check(fileText.some((t) => t.includes("contract.pdf") && t.includes("3 pages")), "PDF is opened with its page count");
check(fileText.some((t) => t.includes("notes.txt") && t.includes("converted to PDF")), "text file is converted");
check(fileText.some((t) => t.includes("letter.docx") && t.includes("Word, converted")), "Word file is converted");
check(fileText.some((t) => t.includes("mail.eml") && t.includes("Email, converted")), "email is converted");
await page.screenshot({ path: join(shots, "1-files.png") });

// ---- 2. rules ----
await clickButton(page, "Choose what to hide");
await waitH1(page, "What to hide");
await page.type("#terms", `${SECRETS.name}\n${SECRETS.project}\n${scanSecret}\n${SECRETS.rotatedName}`);
for (const l of ["Email addresses", "Irish PPS numbers", "Eircodes", "Phone numbers", "IBANs", "Dates written as numbers"]) await tickLabel(page, l);
await page.screenshot({ path: join(shots, "2-rules.png") });
await clickButton(page, "Find matches and review");
await waitH1(page, "Review before anything is made", 240_000);
await page.waitForSelector(".pv-canvas");

// ---- 3. review: the contract ----
let rows = await rowsText(page);
const has = (needle: string) => rows.some((r) => r.includes(needle));
check(has(SECRETS.name), "review lists the name");
check(has(SECRETS.email) && has(SECRETS.phone) && has(SECRETS.pps) && has(SECRETS.iban), "review lists email, phone, PPS number and IBAN");
check(has(SECRETS.date) && has(SECRETS.eircode) && has(SECRETS.project), "review lists date, Eircode and the project name");
check(rows.filter((r) => r.includes(SECRETS.name)).length === 2, "the name is found on both pages", JSON.stringify(rows));
check(!rows.some((r) => r.includes("nothing sensitive")), "ordinary text is not marked");
await sleep(1500);
await page.screenshot({ path: join(shots, "3-review.png") });

// box accuracy against the real Helvetica metrics
{
  const geo = fx.geometry;
  const start = geo.x + (await helveticaWidth(geo.before, geo.font));
  const end = start + (await helveticaWidth(geo.term, geo.font));
  const box = await page.evaluate((name: string) => {
    const b = [...document.querySelectorAll(".box.on")].find((x) => (x.getAttribute("aria-label") ?? "").includes(name)) as HTMLElement | undefined;
    if (!b) return null;
    const f = (s: string) => parseFloat(s);
    return { l: f(b.style.left), t: f(b.style.top), w: f(b.style.width), h: f(b.style.height) };
  }, SECRETS.name);
  if (!box) check(false, "a box sits on the name on page 1");
  else {
    const left = (box.l / 100) * geo.pageW;
    const right = left + (box.w / 100) * geo.pageW;
    const top = (box.t / 100) * geo.pageH;
    const bottom = top + (box.h / 100) * geo.pageH;
    check(left <= start + 0.3 && left >= start - 6, `box starts at the first letter (box ${left.toFixed(1)}, letter ${start.toFixed(1)})`);
    check(right >= end - 0.3 && right <= end + 6, `box ends at the last letter (box ${right.toFixed(1)}, letter ${end.toFixed(1)})`);
    check(top <= geo.baselineFromTop - 8.5 && top >= geo.baselineFromTop - 16, `box covers the tops of the letters (top ${top.toFixed(1)}, baseline ${geo.baselineFromTop})`);
    check(bottom >= geo.baselineFromTop + 2.5 && bottom <= geo.baselineFromTop + 9, `box covers the descenders (bottom ${bottom.toFixed(1)})`);
  }
}

// keep one match: Project Falcon
await page.evaluate((needle: string) => {
  const li = [...document.querySelectorAll(".matches li")].find((x) => x.textContent?.includes(needle));
  (li?.querySelector("input[type=checkbox]") as HTMLInputElement).click();
}, SECRETS.project);
rows = await rowsText(page);

// ---- 4. review: the scanned PDF and the manual box ----
await page.evaluate(() => (document.querySelectorAll(".rf")[1] as HTMLElement).click());
await sleep(500);
rows = await rowsText(page);
check(has(scanSecret), "text recognition finds the name in a scanned PDF", JSON.stringify(rows));
const ov = await page.$("[data-testid=overlay]");
const ob = (await ov!.boundingBox())!;
await page.mouse.move(ob.x + ob.width * 0.05, ob.y + ob.height * 0.1);
await page.mouse.down();
await page.mouse.move(ob.x + ob.width * 0.4, ob.y + ob.height * 0.3, { steps: 6 });
await page.mouse.up();
rows = await rowsText(page);
check(has("Box drawn by hand"), "a box can be drawn by hand");
await page.evaluate(() => (document.querySelectorAll(".rf")[2] as HTMLElement).click());
await sleep(500);
rows = await rowsText(page);
check(has(scanSecret), "text recognition finds the name in a picture file", JSON.stringify(rows));
for (let i = 3; i <= 6; i++) {
  await page.evaluate((n: number) => (document.querySelectorAll(".rf")[n] as HTMLElement).click(), i);
  await sleep(200);
  rows = await rowsText(page);
  check(rows.length > 0, `converted file ${i + 1} has matches`);
}
const createBtn = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Create")));
check(await createBtn.asElement()!.evaluate((b) => (b as HTMLButtonElement).disabled), "Create stays disabled until every file is marked as checked");
await clickButton(page, "Mark all files as checked");

// ---- 5. consent and creation ----
await clickButton(page, "Create 7 redacted copies");
await page.waitForSelector(".modal");
const consentText = await page.$eval(".modal", (e) => e.textContent ?? "");
check(consentText.includes("permanent") && consentText.includes("original files are not changed"), "consent says the redactions are permanent and the originals are not changed");
await page.screenshot({ path: join(shots, "4-consent.png") });
const makeDisabled = await page.evaluate(() => ([...document.querySelectorAll(".modal button")].find((b) => b.textContent?.startsWith("Make the copies")) as HTMLButtonElement).disabled);
check(makeDisabled, "the button stays disabled until the box is ticked");
await page.click(".modal input[type=checkbox]");
await clickButton(page, "Make the copies");
await waitH1(page, "Redacted copies", 600_000);
const results = await page.$$eval(".res", (els) => els.map((e) => ({ cls: e.className, text: (e.textContent ?? "").replace(/\s+/g, " ") })));
check(results.length === 7, "seven files were processed", String(results.length));
const failedChecks = await page.$$eval(".checks li.fail", (els) => els.map((e) => (e.textContent ?? "").trim()));
if (failedChecks.length) console.log("  failed checks: " + [...new Set(failedChecks)].join(" | "));
check(results.every((r) => r.cls.includes("done")), "every copy passed its checks", JSON.stringify(results.map((r) => r.text.slice(0, 160))));
await page.evaluate(() => document.querySelectorAll("details").forEach((d) => d.setAttribute("open", "")));
await page.screenshot({ path: join(shots, "5-results.png"), fullPage: true });
const checkLabels = await page.$$eval(".checks li", (els) => els.map((e) => e.textContent ?? ""));
check(checkLabels.some((t) => t.includes("Reading the finished pages")), "the deep check ran");
check(checkLabels.every((t) => t.trim().startsWith("✓")), "every listed check passed");

// ---- 6. download ----
const names = await page.$$eval(".res .btn.primary", (els) => els.map((e) => (e.textContent ?? "").replace("Download ", "")));
check(names.length === 7 && names.every((n) => n.endsWith("_REDACTED.pdf")), "copies are named _REDACTED.pdf", names.join(", "));
for (const n of names) {
  await page.evaluate((name: string) => ([...document.querySelectorAll(".res .btn.primary")].find((b) => b.textContent?.includes(name)) as HTMLElement).click(), n);
  await sleep(400);
}
await clickButton(page, "Download all as a zip file");
await clickButton(page, "Download the report");
for (let i = 0; i < 60 && !(existsSync(join(downloads, "Ebon-redacted-copies.zip")) && existsSync(join(downloads, "Ebon-report.txt"))); i++) await sleep(500);
await sleep(1000);
const got = readdirSync(downloads).filter((f) => !f.endsWith(".crdownload"));
check(names.every((n) => got.includes(n)), "all copies were downloaded", got.join(", "));

// ---- 7. check the downloaded files with separate code ----
const forbidden = [SECRETS.name, "Murphy", SECRETS.email, SECRETS.phone, SECRETS.pps, SECRETS.iban, SECRETS.eircode, SECRETS.date, SECRETS.formValue, SECRETS.attachment, SECRETS.link, SECRETS.title, SECRETS.author, SECRETS.subject, SECRETS.creator, SECRETS.producer, "secret.example", "Seamus", "Gallagher", "Doyle"];
const lower = (s: string) => s.toLowerCase();
const enc = (s: string) => [s, Buffer.from(s, "utf8").toString("latin1"), "\0" + [...s].join("\0")].map(lower);
async function textOf(buf: Buffer): Promise<{ pages: number; chars: number; annots: number }> {
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false, isEvalSupported: false, verbosity: 0 } as never);
  const d = await task.promise;
  let chars = 0;
  let annots = 0;
  for (let i = 1; i <= d.numPages; i++) {
    const p = await d.getPage(i);
    chars += (await p.getTextContent()).items.reduce((n, it) => n + ("str" in it ? it.str.length : 0), 0);
    annots += (await p.getAnnotations()).length;
  }
  const n = d.numPages;
  await task.destroy();
  return { pages: n, chars, annots };
}
for (const n of names) {
  const buf = readFileSync(join(downloads, n));
  const t = await textOf(buf);
  check(t.chars === 0 && t.annots === 0, `${n}: no text and no annotations when read by another build of the reader`, JSON.stringify(t));
  const hay = buf.toString("latin1").toLowerCase();
  const leaked = forbidden.filter((s) => enc(s).some((e) => hay.includes(e)));
  check(leaked.length === 0, `${n}: none of the secrets or original metadata are in the raw file`, leaked.join(", "));
  const lib = await PDFDocument.load(buf, { updateMetadata: false });
  check(lib.getTitle() === undefined && lib.getAuthor() === undefined && lib.getSubject() === undefined && lib.getKeywords() === undefined, `${n}: no title, author, subject or keywords`);
  check((lib.getProducer() ?? "").startsWith("Ebon "), `${n}: producer is Ebon`, lib.getProducer() ?? "");
  check(lib.context.trailerInfo.Encrypt === undefined && !lib.catalog.has(PDFName.of("Names")), `${n}: no names tree, attachments or encryption`);
}
const contractOut = readFileSync(join(downloads, "contract_REDACTED.pdf"));
const ct = await textOf(contractOut);
check(ct.pages === 3, "contract copy has 3 pages");
check(originals.every((p, i) => sha(p) === originalHashes[i]), "every original file is byte for byte unchanged");

// ---- the hidden words' own pixels are covered: render the original and the copy with separate code ----
async function renderNode(buf: Buffer, pageNo: number, scale: number) {
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), standardFontDataUrl: join(root, "node_modules", "pdfjs-dist", "standard_fonts") + "/", isEvalSupported: false, verbosity: 0 } as never);
  const d = await task.promise;
  const p = await d.getPage(pageNo);
  const vp = p.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  await p.render({ canvas: canvas as never, canvasContext: canvas.getContext("2d") as never, viewport: vp, background: "#ffffff" } as never).promise;
  const img = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  const m = vp.transform as number[];
  await task.destroy();
  return { data: img.data, w: canvas.width, h: canvas.height, m };
}
async function coverage(src: string, out: string, rect: [number, number, number, number]) {
  const a = await renderNode(readFileSync(src), 1, 2);
  const b = await renderNode(readFileSync(out), 1, 2);
  const [x0, y0, x1, y1] = rect; // PDF user space
  const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => [a.m[0] * x + a.m[2] * y + a.m[4], a.m[1] * x + a.m[3] * y + a.m[5]]);
  const px0 = Math.floor(Math.min(...pts.map((p) => p[0])));
  const px1 = Math.ceil(Math.max(...pts.map((p) => p[0])));
  const py0 = Math.floor(Math.min(...pts.map((p) => p[1])));
  const py1 = Math.ceil(Math.max(...pts.map((p) => p[1])));
  let ink = 0;
  let uncovered = 0;
  for (let y = py0; y < py1; y++)
    for (let x = px0; x < px1; x++) {
      const i = (y * a.w + x) * 4;
      if (a.data[i] < 110) {
        ink++;
        const j = (y * b.w + x) * 4;
        if (b.data[j] > 70) uncovered++;
      }
    }
  return { ink, uncovered, size: [b.w, b.h] };
}
{
  const g = fx.geometry;
  const s0 = g.x + (await helveticaWidth(g.before, g.font));
  const e0 = s0 + (await helveticaWidth(g.term, g.font));
  const r1 = await coverage(fx.contract, join(downloads, "contract_REDACTED.pdf"), [s0 + 0.6, 700 - 0.21 * 12, e0 - 0.6, 700 + 0.72 * 12]);
  check(r1.ink > 80 && r1.uncovered === 0, `every dark pixel of the hidden name is under a black box (${r1.ink} pixels, ${r1.uncovered} uncovered)`);
  const s1 = 72 + (await helveticaWidth("Name: ", 12));
  const e1 = s1 + (await helveticaWidth(SECRETS.rotatedName, 12));
  const r2 = await coverage(fx.rotated, join(downloads, "rotated_REDACTED.pdf"), [s1 + 0.6, 700 - 0.21 * 12, e1 - 0.6, 700 + 0.72 * 12]);
  check(r2.ink > 80 && r2.uncovered === 0, `the same on a page turned a quarter turn (${r2.ink} pixels, ${r2.uncovered} uncovered)`);
  const rl = await PDFDocument.load(readFileSync(join(downloads, "rotated_REDACTED.pdf")), { updateMetadata: false });
  const sz = rl.getPage(0).getSize();
  check(Math.round(sz.width) === 792 && Math.round(sz.height) === 612, "the quarter-turn page keeps its shape (792 x 612)", JSON.stringify(sz));
}

const zip = unzipSync(new Uint8Array(readFileSync(join(downloads, "Ebon-redacted-copies.zip"))));
const zipNames = Object.keys(zip);
check(names.every((n) => zipNames.includes(n)) && zipNames.includes("Ebon-report.txt") && zipNames.includes("Ebon-report.json"), "zip holds the copies and both reports", zipNames.join(", "));
const reportTxt = strFromU8(zip["Ebon-report.txt"]);
const reportJson = JSON.parse(strFromU8(zip["Ebon-report.json"]));
check(forbidden.every((s) => !reportTxt.includes(s) && !JSON.stringify(reportJson).includes(s)), "the report holds no hidden text");
check(reportJson.files.length === 7 && reportJson.files.every((f: { verified: boolean; originalSha256: string }) => f.verified && f.originalSha256.length === 64), "the report lists seven verified files with fingerprints");
const c0 = reportJson.files.find((f: { original: string }) => f.original === "contract.pdf");
check(createHash("sha256").update(contractOut).digest("hex") === c0.outputSha256, "the report's fingerprint matches the downloaded file");
check(c0.originalSha256 === originalHashes[0], "the report's original fingerprint matches the original file");
check(readFileSync(join(downloads, "Ebon-report.txt"), "utf8").includes("ALL PASSED"), "the plain text report says all checks passed");

// ---- 8. privacy ----
const origin = new URL(base).origin;
const foreign = requests.filter((u) => !u.startsWith(origin) && !u.startsWith("blob:") && !u.startsWith("data:"));
check(foreign.length === 0, "every request went to our own address", foreign.slice(0, 3).join(", "));
const stores = await page.evaluate(async () => ({
  ls: localStorage.length,
  ss: sessionStorage.length,
  idb: ((await (indexedDB as unknown as { databases(): Promise<unknown[]> }).databases?.()) ?? []).length,
}));
check(stores.ls === 0 && stores.ss === 0 && stores.idb === 0, "nothing is kept in local storage, session storage or IndexedDB", JSON.stringify(stores));
const foreignCaches = await page.evaluate(async () => (await caches.keys()).filter((k: string) => !k.startsWith("ebon-")).length);
check(foreignCaches === 0, "only Ebon's own app caches exist");
const docCache = await page.evaluate(async () => {
  let n = 0;
  for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) if (/\.pdf|contract|notes|REDACTED/i.test(new URL(r.url).pathname)) n++;
  return n;
});
check(docCache === 0, "no document is in any cache");
check(problems.length === 0, "no console errors or security policy violations", problems.slice(0, 3).join(" | "));

// ---- 9. offline ----
await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
await sleep(1500);
const off = await newPage();
await off.goto(`${base}/app/`);
await waitH1(off, "Add the files");
await off.setOfflineMode(true);
await off.reload();
await waitH1(off, "Add the files", 30_000).catch(() => undefined);
check((await h1(off).catch(() => "")).includes("Add the files"), "the app opens again with no connection");
const ex = await off.$("input[type=file]");
await ex!.uploadFile(fx.notes);
await off.waitForFunction(() => document.querySelectorAll(".file.ready").length === 1, { timeout: 30_000 }).catch(() => undefined);
check((await off.$$(".file.ready")).length === 1, "a file can be opened with no connection");

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
