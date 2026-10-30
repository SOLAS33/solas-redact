/**
 * Speed and memory on a large document. Not part of the normal test run.
 *   npm run build && node --import tsx tests/e2e/stress.ts [pages]
 * Makes a PDF of N text pages, adds it, finds one name and one email on every page, makes the copy with the quick check,
 * and prints how long each stage took and how much memory the page used.
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, rmSync } from "node:fs";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";
import { PDFDocument, StandardFonts } from "pdf-lib";

const pages = Number(process.argv[2] ?? 120);
const deep = process.argv.includes("--deep");
const bw = process.argv.includes("--bw");
const root = join(import.meta.dirname, "..", "..");
const dist = join(root, "dist");
const out = join(import.meta.dirname, "out-stress");
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "dl"), { recursive: true });

const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".wasm": "application/wasm" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url!, "http://x").pathname);
  let file = join(dist, p);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.TimesRoman);
const lorem = "The committee considered the matter at length and agreed that further information would be needed before any decision could be taken.";
for (let i = 0; i < pages; i++) {
  const p = doc.addPage([595, 842]);
  for (let l = 0; l < 44; l++) p.drawText(l === 7 ? `Applicant Mary O'Sullivan wrote from mary${i}@example.ie about case ${i}.` : lorem.slice(0, 95), { x: 50, y: 800 - l * 17, size: 10, font });
}
const pdfPath = join(out, "big.pdf");
writeFileSync(pdfPath, await doc.save());
console.log(`made ${pages}-page PDF, ${(statSync(pdfPath).size / 1e6).toFixed(2)} MB`);

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument("window.__name = (f) => f;");
await page.setViewport({ width: 1400, height: 1000 });
const cdp = await page.createCDPSession();
await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: join(out, "dl") });
const btn = (t: string) => page.evaluate((x: string) => ([...document.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(x)) as HTMLElement).click(), t);
const t0 = Date.now();
const lap = (what: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)} s  ${what}`);
const heap = async () => ((await page.metrics()).JSHeapUsedSize! / 1e6).toFixed(0) + " MB";

await page.goto(`${base}/app/`);
await (await page.$("input[type=file]"))!.uploadFile(pdfPath);
await page.waitForSelector(".file.ready", { timeout: 120000 });
lap("file opened");
await btn("Choose what to hide");
await page.waitForSelector("#terms");
await page.type("#terms", "Mary O'Sullivan");
await page.evaluate(() => [...document.querySelectorAll("label")].find((l) => l.textContent?.includes("Email addresses"))!.querySelector("input")!.click());
if (!deep) await page.evaluate(() => [...document.querySelectorAll("label")].find((l) => l.textContent?.includes("Read the finished pages"))!.querySelector("input")!.click());
await page.evaluate(() => [...document.querySelectorAll("label")].find((l) => l.textContent?.includes("Read scanned pages"))!.querySelector("input")!.click());
if (bw) await page.select("select", "bw");
await btn("Find matches");
await page.waitForFunction(() => document.querySelector("h1")?.textContent?.includes("Review"), { timeout: 900000 });
lap(`searched all pages, memory ${await heap()}`);
const found = await page.$eval(".r-head strong", (e) => e.textContent);
console.log("   ", found);
await btn("Mark all files as checked");
await btn("Create 1 redacted copy");
await page.waitForSelector(".modal");
await page.click(".modal input[type=checkbox]");
await btn("Make the copies");
let peak = 0;
const timer = setInterval(async () => {
  try {
    peak = Math.max(peak, (await page.metrics()).JSHeapUsedSize! / 1e6);
  } catch {
    /* page busy */
  }
}, 2000);
await page.waitForFunction(() => document.querySelector("h1")?.textContent?.includes("Redacted copies"), { timeout: 1800000 });
clearInterval(timer);
lap(`copy made and checked, peak memory about ${peak.toFixed(0)} MB`);
const status = await page.$eval(".res .pill", (e) => e.textContent);
const size = await page.$eval(".res .actions .muted", (e) => e.textContent);
console.log("   status:", status, " output size:", size);
await browser.close();
server.close();
