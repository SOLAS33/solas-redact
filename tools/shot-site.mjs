// Saves screenshots of built site pages into tests/e2e/out/site/ for a visual check. Usage: node tools/shot-site.mjs /docs/licence/ /
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";
const dist = "dist";
const types = { ".html": "text/html", ".css": "text/css", ".png": "image/png", ".txt": "text/plain" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = join(dist, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) return void res.writeHead(404).end("nf");
  res.writeHead(200, { "Content-Type": types[extname(f)] ?? "application/octet-stream" }).end(readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
const pg = await b.newPage();
await pg.setViewport({ width: 1200, height: 900 });
mkdirSync("tests/e2e/out/site", { recursive: true });
for (const path of process.argv.slice(2)) {
  await pg.goto(base + path);
  const name = path.replace(/\W+/g, "_") || "home";
  await pg.screenshot({ path: `tests/e2e/out/site/${name}.png`, fullPage: true });
  console.log("saved", name, await pg.evaluate(() => document.title));
}
await b.close();
server.close();
