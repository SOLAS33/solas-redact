// Makes the product-page screenshots (webp at 640, 960 and 1600 wide, 16:10) from a PNG. Usage: node tools/make-webp.mjs in.png outPrefix
import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync } from "node:fs";
const [, , input, prefix] = process.argv;
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
const p = await b.newPage();
const dataUrl = "data:image/png;base64," + readFileSync(input).toString("base64");
for (const w of [640, 960, 1600]) {
  const url = await p.evaluate(async (src, w) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement("canvas"); c.width = w; c.height = Math.round(w * 0.625);
    const x = c.getContext("2d"); x.fillStyle = "#f7f6f2"; x.fillRect(0, 0, c.width, c.height);
    const k = c.height / img.height; const dw = img.width * k;
    x.imageSmoothingQuality = "high"; x.drawImage(img, (c.width - dw) / 2, 0, dw, c.height);
    return c.toDataURL("image/webp", 0.85);
  }, dataUrl, w);
  writeFileSync(`${prefix}-${w}.webp`, Buffer.from(url.split(",")[1], "base64"));
  console.log("wrote", `${prefix}-${w}.webp`);
}
await b.close();
