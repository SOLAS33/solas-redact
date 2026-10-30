// Debug helper: open only rotated.pdf in the built app, search for the name, and save a screenshot. Run: node --import tsx tests/e2e/debug-rotated.ts
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";

const root = join(import.meta.dirname, "..", "..");
const dist = join(root, "dist");
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
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.evaluateOnNewDocument("window.__name = (f) => f;");
await page.setViewport({ width: 1400, height: 1000 });
page.on("console", (m) => console.log("console:", m.text()));
await page.goto(`${base}/app/`);
await (await page.$("input[type=file]"))!.uploadFile(join(root, "tests", "e2e", "out", "files", "rotated.pdf"));
await page.waitForSelector(".file.ready");
await page.evaluate(() => ([...document.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Choose what")) as HTMLElement).click());
await page.waitForSelector("#terms");
await page.type("#terms", "Declan Doyle");
await page.evaluate(() => ([...document.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Find matches")) as HTMLElement).click());
await page.waitForSelector(".pv-canvas", { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));
mkdirSync(join(root, "tests", "e2e", "out", "shots"), { recursive: true });
await page.screenshot({ path: join(root, "tests", "e2e", "out", "shots", "rotated.png") });
console.log(await page.$$eval(".matches li", (e) => e.map((x) => x.textContent)));
console.log(await page.$$eval(".box", (e) => e.map((x) => (x as HTMLElement).getAttribute("style"))));
await browser.close();
server.close();
