// Draws the app icons with Chrome (no image library needed). Run: node tools/make-icons.mjs
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const chrome = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
if (!chrome) throw new Error("No Chrome found. Set CHROME_PATH.");

const svg = (maskable) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" ${maskable ? "" : 'rx="104"'} fill="#15161a"/>
  <g transform="${maskable ? "translate(51 51) scale(0.8)" : ""}">
    <rect x="100" y="134" width="312" height="44" rx="10" fill="#f1efe8"/>
    <rect x="100" y="234" width="312" height="56" rx="10" fill="#f2c200"/>
    <rect x="100" y="346" width="200" height="44" rx="10" fill="#f1efe8"/>
  </g>
</svg>`;

const jobs = [
  ["favicon.png", 64, false],
  ["apple-touch-icon.png", 180, false],
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
];
mkdirSync("public/icons", { recursive: true });
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
for (const [name, size, maskable] of jobs) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0;background:transparent">${svg(maskable).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body>`);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(`public/icons/${name}`, buf);
  console.log("wrote", name);
}
writeFileSync("public/icons/solas-redact.svg", svg(false));
await browser.close();
