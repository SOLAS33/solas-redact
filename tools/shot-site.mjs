// Saves screenshots of built site pages into tests/e2e/out/site/ for a visual check. Usage: node tools/shot-site.mjs /docs/licence/ /
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";
const dist = "dist";
const types = { ".html": "text/html", ".css": "text/css", ".png": "image/png", ".txt": "text/plain", ".woff2": "font/woff2", ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".webmanifest": "application/json" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = join(dist, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) return void res.writeHead(404).end("nf");
  res.writeHead(200, { "Content-Type": types[extname(f)] ?? "application/octet-stream" }).end(readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: Number(process.env.SHOT_W ?? 1920), height: Number(process.env.SHOT_H ?? 1080) });
mkdirSync("tests/e2e/out/site", { recursive: true });
for (const path of process.argv.slice(2)) {
  await pg.goto(base + path, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 2500));
  const name = path.replace(/\W+/g, "_") || "home";
  await pg.screenshot({ path: `tests/e2e/out/site/${name}.png`, fullPage: !process.env.SHOT_FOLD });
  console.log("saved", name, await pg.evaluate(() => document.title));
}
await b.close();
server.close();
