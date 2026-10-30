/**
 * End-to-end test in a real browser: the built app, served with its real security headers.
 *   npm run build && npm run test:e2e        (BROWSER=chrome|edge|brave|firefox; CHROME_PATH can point at any Chromium browser)
 * It adds seven kinds of file, searches, reviews, makes copies, downloads them, and then checks the downloaded files
 * with separate code (a different build of the PDF reader and raw byte searches), not with the app's own checks.
 */
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
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

const which = (process.env.BROWSER ?? "chrome").toLowerCase();
const isFirefox = which === "firefox";
const PATHS: Record<string, string[]> = {
  chrome: ["C:/Program Files/Google/Chrome/Application/chrome.exe", join(homedir(), "AppData/Local/Google/Chrome/Application/chrome.exe"), "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"],
  edge: ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"],
  brave: ["C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe"],
  firefox: ["C:/Program Files/Mozilla Firefox/firefox.exe", "/usr/bin/firefox"],
};
const LABEL: Record<string, string> = { chrome: "Chrome", edge: "Edge", brave: "Brave", firefox: "Firefox" };
const executablePath = process.env.CHROME_PATH || PATHS[which]?.find(existsSync);
if (!executablePath) throw new Error(`No ${which} found. Set CHROME_PATH.`);
const browser = isFirefox
  ? await puppeteer.launch({
      browser: "firefox",
      executablePath,
      headless: true,
      extraPrefsFirefox: {
        "browser.download.dir": downloads,
        "browser.download.folderList": 2,
        "browser.download.useDownloadDir": true,
        "browser.download.always_ask_before_handling_new_types": false,
        "browser.download.manager.showWhenStarting": false,
        "browser.helperApps.neverAsk.saveToDisk": "application/pdf,application/zip,text/plain,application/octet-stream",
        "pdfjs.disabled": true,
      },
    })
  : await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
async function downloadTo(page: Page, dir: string): Promise<void> {
  if (!isFirefox) await (await page.createCDPSession()).send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dir });
}

let failures = 0;
const checkNames: string[] = [];
const check = (ok: boolean, what: string, detail = "") => {
  checkNames.push(what);
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
  await downloadTo(page, downloads);
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
async function fileInput(p: Page, id: string): Promise<ElementHandle<HTMLInputElement>> {
  const el = await p.$(`[data-testid=${id}]`);
  if (!el) throw new Error(`No file input ${id}`);
  return el as ElementHandle<HTMLInputElement>;
}
const h1 = (p: Page) => p.$eval("h1", (e) => e.textContent ?? "");
// Polled from here: the waiting helpers built into the driver run code the page's security policy blocks in Firefox.
async function until<A>(p: Page, what: string, fn: (arg: A) => unknown, arg: A, timeout = 120_000): Promise<void> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await p.evaluate(fn as never, arg as never).catch(() => false)) return;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${what}`);
}
const waitH1 = (p: Page, text: string, timeout = 120_000) => until(p, `heading "${text}"`, (t: string) => document.querySelector("h1")?.textContent?.includes(t), text, timeout);
const waitFor = (p: Page, sel: string, timeout = 120_000) => until(p, sel, (x: string) => !!document.querySelector(x), sel, timeout);
const rowsText = (p: Page) => p.$$eval(".matches li", (els) => els.map((e) => (e.textContent ?? "").replace(/\s+/g, " ").trim()));

await page.goto(`${base}/app/`);
await waitH1(page, "Redact a document");
check((await h1(page)).includes("Redact a document"), "app opens at /app/");
check(!!(await page.$("[data-testid=file-input-manual]")) && !!(await page.$("[data-testid=file-input-scan]")), "the start screen offers by hand and scan");
await page.screenshot({ path: join(shots, "0-start.png") });

// ---- 1. add files ----
await (await fileInput(page, "file-input-scan")).uploadFile(fx.contract, fx.scanPdf, join(fx.dir, "scan.png"), fx.notes, fx.mail, fx.letter, fx.rotated, fx.sheet);
await until(page, "the file list", () => document.querySelectorAll(".file.ready").length === 7 && document.querySelectorAll(".file.error").length === 1, 0);
const errText = await page.$eval(".file.error", (e) => e.textContent ?? "");
check(errText.includes("Excel") && errText.includes("Save as PDF"), "an unsupported file is refused with a plain explanation", errText);
const fileText = await page.$$eval(".file", (els) => els.map((e) => e.textContent ?? ""));
check(fileText.some((t) => t.includes("contract.pdf") && t.includes("3 pages")), "PDF is opened with its page count");
check(fileText.some((t) => t.includes("notes.txt") && t.includes("converted to PDF")), "text file is converted");
check(fileText.some((t) => t.includes("letter.docx") && t.includes("Word, converted")), "Word file is converted");
check(fileText.some((t) => t.includes("mail.eml") && t.includes("Email, converted")), "email is converted");
await page.evaluate(() => scrollTo(0, 0));
await page.screenshot({ path: join(shots, "1-files.png") });

// ---- 2. rules ----
await clickButton(page, "Continue");
await waitH1(page, "Scan for words");
await page.type("#terms", `${SECRETS.name}\n${SECRETS.project}\n${scanSecret}\n${SECRETS.rotatedName}`);
for (const l of ["Email addresses", "Irish PPS numbers", "Eircodes", "Phone numbers", "IBANs", "Dates written as numbers"]) await tickLabel(page, l);
await page.evaluate(() => scrollTo(0, 0));
await page.screenshot({ path: join(shots, "2-rules.png") });
await clickButton(page, "Scan documents");
await waitH1(page, "Review matches", 240_000);
await waitFor(page, ".pv-canvas");

// ---- 3. review: the contract ----
let rows = await rowsText(page);
const has = (needle: string) => rows.some((r) => r.includes(needle));
check(has(SECRETS.name), "review lists the name");
check(has(SECRETS.email) && has(SECRETS.phone) && has(SECRETS.pps) && has(SECRETS.iban), "review lists email, phone, PPS number and IBAN");
check(has(SECRETS.date) && has(SECRETS.eircode) && has(SECRETS.project), "review lists date, Eircode and the project name");
check(rows.filter((r) => r.includes(SECRETS.name)).length === 2, "the name is found on both pages", JSON.stringify(rows));
check(!rows.some((r) => r.includes("nothing sensitive")), "ordinary text is not marked");
await sleep(1500);
await page.evaluate(() => scrollTo(0, 0));
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

// ---- 5. consent and creation ----
await clickButton(page, "Create 7 redacted copies");
await waitFor(page, ".modal");
const consentText = await page.$eval(".modal", (e) => e.textContent ?? "");
check(consentText.includes("permanent") && consentText.includes("original files are not changed"), "consent says the redactions are permanent and the originals are not changed");
const consentNotes = await page.$$eval(".modal .note", (els) => els.map((e) => e.textContent ?? "").join(" "));
check(consentNotes.includes("Pages not yet viewed") && consentNotes.includes("contract.pdf (2)"), "the confirmation names pages that were not viewed", consentNotes);
await page.evaluate(() => scrollTo(0, 0));
await page.screenshot({ path: join(shots, "4-consent.png") });
const makeDisabled = await page.evaluate(() => ([...document.querySelectorAll(".modal button")].find((b) => b.textContent?.startsWith("Make the copies")) as HTMLButtonElement).disabled);
check(makeDisabled, "the button stays disabled until the box is ticked");
await page.click(".consent-check input");
await clickButton(page, "Make the copies");
await waitH1(page, "Redacted copies", 600_000);
const results = await page.$$eval(".res", (els) => els.map((e) => ({ cls: e.className, text: (e.textContent ?? "").replace(/\s+/g, " ") })));
check(results.length === 7, "seven files were processed", String(results.length));
const failedChecks = await page.$$eval(".checks li.fail", (els) => els.map((e) => (e.textContent ?? "").trim()));
if (failedChecks.length) console.log("  failed checks: " + [...new Set(failedChecks)].join(" | "));
check(results.every((r) => r.cls.includes("done")), "every copy passed its checks", JSON.stringify(results.map((r) => r.text.slice(0, 160))));
await page.evaluate(() => document.querySelectorAll("details").forEach((d) => d.setAttribute("open", "")));
await page.evaluate(() => scrollTo(0, 0));
await page.screenshot({ path: join(shots, "5-results.png"), fullPage: true });
const checkLabels = await page.$$eval(".checks li", (els) => els.map((e) => e.textContent ?? ""));
check(checkLabels.some((t) => t.includes("Reading the finished pages")), "the deep check ran");
check(checkLabels.every((t) => t.trim().startsWith("✓")), "every listed check passed");

// ---- 6. download ----
const names = await page.$$eval(".res .dl", (els) => els.map((e) => e.getAttribute("data-name") ?? ""));
check(names.length === 7 && names.every((n) => n.endsWith("_REDACTED.pdf")), "copies are named _REDACTED.pdf", names.join(", "));
for (const n of names) {
  await page.evaluate((name: string) => (document.querySelector(`.res .dl[data-name="${name}"]`) as HTMLElement).click(), n);
  await sleep(400);
}
await clickButton(page, "Download all as a zip file");
for (let i = 0; i < 60 && !existsSync(join(downloads, "Solas-Redact-copies.zip")); i++) await sleep(500);
await sleep(500);
await clickButton(page, "Download the report");
for (let i = 0; i < 60 && !(existsSync(join(downloads, "Solas-Redact-copies.zip")) && existsSync(join(downloads, "Solas-Redact-report.txt"))); i++) await sleep(500);
await sleep(1000);
const got = readdirSync(downloads).filter((f) => !f.endsWith(".crdownload") && !f.endsWith(".part"));
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
  check((lib.getProducer() ?? "").startsWith("Solas Redact "), `${n}: producer is Solas Redact`, lib.getProducer() ?? "");
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

const zip = unzipSync(new Uint8Array(readFileSync(join(downloads, "Solas-Redact-copies.zip"))));
const zipNames = Object.keys(zip);
check(names.every((n) => zipNames.includes(n)) && zipNames.includes("Solas-Redact-report.txt") && zipNames.includes("Solas-Redact-report.json"), "zip holds the copies and both reports", zipNames.join(", "));
const reportTxt = strFromU8(zip["Solas-Redact-report.txt"]);
const reportJson = JSON.parse(strFromU8(zip["Solas-Redact-report.json"]));
check(forbidden.every((s) => !reportTxt.includes(s) && !JSON.stringify(reportJson).includes(s)), "the report holds no hidden text");
check(reportJson.files.length === 7 && reportJson.files.every((f: { verified: boolean; originalSha256: string }) => f.verified && f.originalSha256.length === 64), "the report lists seven verified files with fingerprints");
const c0 = reportJson.files.find((f: { original: string }) => f.original === "contract.pdf");
check(createHash("sha256").update(contractOut).digest("hex") === c0.outputSha256, "the report's fingerprint matches the downloaded file");
check(c0.originalSha256 === originalHashes[0], "the report's original fingerprint matches the original file");
check(readFileSync(join(downloads, "Solas-Redact-report.txt"), "utf8").includes("ALL PASSED"), "the plain text report says all checks passed");

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
const foreignCaches = await page.evaluate(async () => (await caches.keys()).filter((k: string) => !k.startsWith("solas-redact-")).length);
check(foreignCaches === 0, "only Solas Redact's own app caches exist");
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
await waitH1(off, "Redact a document");
let offlineTested = true;
await off.setOfflineMode(true).catch(() => {
  offlineTested = false;
});
if (offlineTested) {
  await off.reload();
  await waitH1(off, "Redact a document", 30_000).catch(() => undefined);
  check((await h1(off).catch(() => "")).includes("Redact a document"), "the app opens again with no connection");
  await (await fileInput(off, "file-input-manual")).uploadFile(fx.notes);
  await waitH1(off, "Redact by hand", 30_000).catch(() => undefined);
  check(!!(await off.$(".pv-canvas")), "a file can be opened with no connection");
} else console.log("SKIP  the browser driver cannot switch this browser offline");

// ---- 9b. by hand: straight to the page, draw, undo, full size ----
{
  const m = await newPage();
  const mDir = isFirefox ? downloads : join(out, "downloads-manual");
  if (!isFirefox) {
    mkdirSync(mDir);
    await downloadTo(m, mDir);
  } else rmSync(join(mDir, "contract_REDACTED.pdf"), { force: true });
  await m.setViewport({ width: 2560, height: 1440, deviceScaleFactor: 1 });
  await m.goto(`${base}/app/`);
  await waitH1(m, "Redact a document");
  await (await fileInput(m, "file-input-manual")).uploadFile(fx.contract);
  await waitH1(m, "Redact by hand", 60_000);
  check(true, "by hand goes straight to the page after a clean add");
  await waitFor(m, ".pv-canvas");
  await sleep(1200);
  check(!(await m.$(".matches")), "by hand shows no match list");
  const buttons = await m.$$eval(".bar-top button", (els) => els.length);
  check(buttons <= 8, `the workspace keeps few controls (${buttons})`);
  const fit = await m.evaluate(() => {
    const p = document.querySelector(".pv-page")!.getBoundingClientRect();
    const s = document.querySelector(".stage")!.getBoundingClientRect();
    return { pageH: p.height, stageH: s.height, stageW: s.width, top: document.querySelector(".top")!.getBoundingClientRect().width, scroll: document.documentElement.scrollWidth };
  });
  check(fit.stageW === 2560 && fit.top === 2560 && fit.scroll <= 2560, "the workspace fills the whole 2560 pixel width", JSON.stringify(fit));
  check(fit.pageH > fit.stageH - 60 && fit.pageH <= fit.stageH, "the page fills the height of the window with no scrolling", JSON.stringify(fit));
  await clickButton(m, "Fit width");
  await sleep(1200);
  const wide = await m.$eval(".pv-page", (e) => e.getBoundingClientRect().width);
  check(wide > 2400, `fit width uses the whole screen (${wide} pixels)`);
  await clickButton(m, "Fit page");
  await sleep(800);
  await m.screenshot({ path: join(shots, "6-by-hand.png") });
  const draw = async (fx0: number, fy0: number, fx1: number, fy1: number) => {
    const ob = (await (await m.$("[data-testid=overlay]"))!.boundingBox())!;
    await m.mouse.move(ob.x + ob.width * fx0, ob.y + ob.height * fy0);
    await m.mouse.down();
    await m.mouse.move(ob.x + ob.width * fx1, ob.y + ob.height * fy1, { steps: 5 });
    await m.mouse.up();
    await sleep(150);
  };
  const boxes = () => m.$$eval(".box.manual", (e) => e.length);
  await draw(0.1, 0.1, 0.5, 0.16);
  check((await boxes()) === 1, "drawing makes a box");
  await clickButton(m, "Undo");
  await sleep(150);
  check((await boxes()) === 0, "Undo takes the box away");
  await draw(0.1, 0.1, 0.5, 0.16);
  await m.keyboard.down("Control");
  await m.keyboard.press("z");
  await m.keyboard.up("Control");
  await sleep(150);
  check((await boxes()) === 0, "Ctrl+Z takes the box away");
  await draw(0.1, 0.2, 0.5, 0.26);
  await m.click(".box.manual");
  await sleep(150);
  check((await boxes()) === 0, "clicking a box removes it");
  await draw(0.1, 0.1, 0.9, 0.22);
  await m.keyboard.press("ArrowRight");
  await sleep(800);
  check((await m.$eval(".pg", (e) => (e as HTMLInputElement).value)) === "2", "the arrow key turns the page");
  check((await boxes()) === 0, "a box stays on its own page");
  await m.keyboard.press("ArrowLeft");
  await sleep(800);
  check((await boxes()) === 1, "the box is still there on going back");
  await clickButton(m, "Create redacted copy");
  await waitFor(m, ".modal");
  await m.click(".consent-check input");
  await clickButton(m, "Make the copies");
  await waitH1(m, "Redacted copies", 300_000);
  check(!!(await m.$(".res.done")), "a copy made by hand passes every check");
  await m.evaluate(() => (document.querySelector(".res .dl") as HTMLElement).click());
  for (let i = 0; i < 40 && !existsSync(join(mDir, "contract_REDACTED.pdf")); i++) await sleep(300);
  await sleep(800);
  const hand = join(mDir, "contract_REDACTED.pdf");
  if (existsSync(hand)) {
    const t = await textOf(readFileSync(hand));
    check(t.chars === 0 && t.pages === 3, "the copy made by hand has no text layer and all 3 pages", JSON.stringify(t));
    if (isFirefox) rmSync(hand, { force: true });
  } else check(false, "the copy made by hand was downloaded");
  await m.close();
}

// ---- 10. black and white copies: 1-bit pages, much smaller, same checks ----
{
  const bw = await newPage();
  const bwDir = isFirefox ? join(out, "downloads") : join(out, "downloads-bw");
  if (isFirefox) rmSync(join(bwDir, "contract_REDACTED.pdf"), { force: true });
  else {
    mkdirSync(bwDir);
    await downloadTo(bw, bwDir);
  }
  await bw.goto(`${base}/app/`);
  await waitH1(bw, "Redact a document");
  await (await fileInput(bw, "file-input-scan")).uploadFile(fx.contract);
  await waitH1(bw, "Scan for words", 60_000);
  await bw.type("#terms", SECRETS.name);
  await tickLabel(bw, "Email addresses");
  await clickButton(bw, "Scan documents");
  await waitH1(bw, "Review matches", 120_000);
  await clickButton(bw, "Create redacted copy");
  await waitFor(bw, ".modal");
  await bw.select(".modal select", "bw");
  await bw.evaluate(() => ([...document.querySelectorAll("label")].find((l) => l.textContent?.includes("Read the finished pages"))!.querySelector("input") as HTMLInputElement).click());
  await bw.click(".consent-check input");
  await clickButton(bw, "Make the copies");
  await waitH1(bw, "Redacted copies", 300_000);
  const done = await bw.$(".res.done");
  check(!!done, "a black and white copy passes every check");
  const size = await bw.$eval(".res .res-size", (e) => e.textContent ?? "");
  check(/KB/.test(size) && parseInt(size, 10) < 150, `the black and white copy is small (${size})`);
  await bw.evaluate(() => (document.querySelector(".res .dl") as HTMLElement).click());
  for (let i = 0; i < 40 && !existsSync(join(bwDir, "contract_REDACTED.pdf")); i++) await sleep(300);
  await sleep(800);
  const dup = existsSync(join(bwDir, "contract_REDACTED.pdf")) ? "contract_REDACTED.pdf" : undefined;
  if (dup) {
    const t = await textOf(readFileSync(join(bwDir, dup)));
    check(t.chars === 0, "the black and white copy has no text layer");
    const r = await coverage(fx.contract, join(bwDir, dup), [fx.geometry.x + (await helveticaWidth(fx.geometry.before, 12)) + 0.6, 700 - 2.52, fx.geometry.x + (await helveticaWidth(fx.geometry.before + fx.geometry.term, 12)) - 0.6, 700 + 8.64]);
    check(r.ink > 80 && r.uncovered === 0, `the name is covered in the black and white copy (${r.ink} pixels, ${r.uncovered} uncovered)`);
  } else check(false, "the black and white copy was downloaded");
}

const version = (await browser.version()).replace(/^[^/\s]*[/\s]/, "");
await browser.close();
server.close();
mkdirSync(join(root, "docs", "data"), { recursive: true });
const today = new Date().toISOString().slice(0, 10);
if (which === "chrome") {
  writeFileSync(join(root, "docs", "data", "e2e-results.json"), JSON.stringify({ date: today, chrome: `Chrome ${version}`, passed: checkNames.length - failures, failed: failures, checks: checkNames }, null, 2));
}
const browsersFile = join(root, "docs", "data", "e2e-browsers.json");
const browsers = existsSync(browsersFile) ? JSON.parse(readFileSync(browsersFile, "utf8")) : {};
browsers[which] = { name: LABEL[which] ?? which, version, date: today, passed: checkNames.length - failures, failed: failures };
writeFileSync(browsersFile, JSON.stringify(browsers, null, 2));
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
