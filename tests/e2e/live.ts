import { homedir } from "node:os";
/**
 * Smoke test against the live site: one text file through the whole flow, with the real Cloudflare headers.
 *   node --import tsx tests/e2e/live.ts [https://redact.solas33.com]
 * Needs tests/e2e/out/files from a previous npm run test:e2e.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { join } from "node:path";
import type { ElementHandle } from "puppeteer-core";
import puppeteer from "puppeteer-core";
import { VERSION } from "../../src/version";

const base = process.argv[2] ?? "https://redact.solas33.com";
const root = join(import.meta.dirname, "..", "..");
const file = join(root, "tests", "e2e", "out", "files", "notes.txt");
const dl = join(root, "tests", "e2e", "out", "live-dl");
mkdirSync(dl, { recursive: true });
const chrome = process.env.CHROME_PATH || join(homedir(), "AppData/Local/Google/Chrome/Application/chrome.exe");
const b = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
const p = await b.newPage();
await p.evaluateOnNewDocument("window.__name = (f) => f;");
await p.setViewport({ width: 1400, height: 1000 });
await (await p.createCDPSession()).send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dl });
const problems: string[] = [];
const hosts = new Set<string>();
p.on("request", (r) => hosts.add(new URL(r.url()).host));
p.on("console", (m) => { if (m.type() === "error" || /Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text()); });
p.on("pageerror", (e) => problems.push(String(e)));
let fails = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) fails++; };
const click = (t: string) => p.evaluate((x: string) => ([...document.querySelectorAll("button")].find((e) => e.textContent?.trim().startsWith(x) && !(e as HTMLButtonElement).disabled) as HTMLElement).click(), t);
const h1 = (t: string, ms = 180000) => p.waitForFunction((x: string) => document.querySelector("h1")?.textContent?.includes(x), { timeout: ms }, t);

await p.goto(`${base}/app/`);
await h1("Redact a document");
check((await p.title()).startsWith("Solas Redact"), `live page title is "${await p.title()}"`);
await ((await p.$("[data-testid=file-input-scan]")) as ElementHandle<HTMLInputElement>).uploadFile(file);
await h1("Scan for words", 60000);
await p.type("#terms", "Seán Murphy");
await p.evaluate(() => ([...document.querySelectorAll("label")].find((l) => l.textContent?.includes("Irish PPS numbers"))!.querySelector("input") as HTMLInputElement).click());
await click("Scan documents");
await h1("Review matches");
await click("Create redacted copy");
await p.waitForSelector(".modal");
await p.click(".consent-check input");
await click("Make the copies");
await h1("Redacted copies", 240000);
check(!!(await p.$(".res.done")), "the copy passes every check on the live site");
await p.evaluate(() => (document.querySelector(".res .dl") as HTMLElement).click());
for (let i = 0; i < 30 && !existsSync(join(dl, "notes_REDACTED.pdf")); i++) await new Promise((r) => setTimeout(r, 400));
const out = existsSync(join(dl, "notes_REDACTED.pdf")) ? readFileSync(join(dl, "notes_REDACTED.pdf")).toString("latin1") : "";
const producer = out ? (await PDFDocument.load(readFileSync(join(dl, "notes_REDACTED.pdf")), { updateMetadata: false })).getProducer() : "";
check(out.startsWith("%PDF") && producer === `Solas Redact ${VERSION}`, `the downloaded file is a PDF produced by "${producer}"`);
check(!out.toLowerCase().includes("murphy") && !out.includes("1234567TA"), "the hidden name and PPS number are not in the file");
const own = new URL(base).host;
check([...hosts].every((h) => h === own || h === ""), `every request went to ${own} (${[...hosts].join(", ")})`);
check(problems.length === 0, `no console errors or policy violations ${problems.slice(0, 2).join(" | ")}`);
await b.close();
console.log(fails ? `${fails} FAILED` : "Live smoke test passed");
process.exit(fails ? 1 : 0);
