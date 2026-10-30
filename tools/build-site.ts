// Builds the public website (landing page and documentation) from docs/*.md into dist/.
//   node --import tsx tools/build-site.ts        (run after vite build; npm run build does both)
// Every page is plain static HTML with one stylesheet and no script. Numbers on the pages come from files written by the
// tools and tests (docs/data/*.json), not from typing.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import { PATTERNS } from "../src/engine/patterns";
import { QUALITY } from "../src/engine/types";
import { REPO_URL, VERSION } from "../src/version";

const root = join(import.meta.dirname, "..");
const dist = join(root, "dist");
const SITE = process.env.SITE_URL ?? "https://ebon.solas33.com";
const BUILT = new Date().toISOString().slice(0, 10);

const read = (p: string) => readFileSync(join(root, p), "utf8");
const json = <T,>(p: string, fallback: T): T => (existsSync(join(root, p)) ? (JSON.parse(read(p)) as T) : fallback);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface Doc {
  slug: string;
  title: string;
  description: string;
  order: number;
  body: string;
}

function frontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: raw.slice(m[0].length) };
}

const slugify = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      return `<h${depth} id="${slugify(text)}">${text}</h${depth}>\n`;
    },
  },
});

// ---- data used by placeholders ----
interface Pkg { name: string; version: string; licence: string; homepage: string; hasLicenceFile: boolean }
interface Vendor { name: string; from: string; licence: string; file: string }
const third = json<{ packages: Pkg[]; vendor: Vendor[] }>("docs/data/third-party.json", { packages: [], vendor: [] });
const e2e = json<{ date: string; chrome: string; passed: number; failed: number; checks: string[] }>("docs/data/e2e-results.json", { date: "", chrome: "", passed: 0, failed: 0, checks: [] });
const unit = json<{ date: string; tests: number }>("docs/data/unit-results.json", { date: "", tests: 0 });

function thirdPartyTable(): string {
  const rows = third.packages.map((p) => `| ${p.name} | ${p.version} | ${p.licence} | ${p.hasLicenceFile ? "yes" : "no"} |`);
  return ["| Package | Version | Licence | Licence file shipped with the package |", "|---|---|---|---|", ...rows].join("\n");
}
function vendorTable(): string {
  return ["| Support file | Supplied with | Licence |", "|---|---|---|", ...third.vendor.map((v) => `| ${v.name} | ${v.from} | ${v.licence} |`)].join("\n");
}
function licenceCounts(): string {
  const c: Record<string, number> = {};
  for (const p of third.packages) c[p.licence] = (c[p.licence] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} under ${k}`).join(", ");
}
function patternsTable(): string {
  return ["| Kind | Example | What it checks |", "|---|---|---|", ...PATTERNS.map((p) => `| ${p.label} | ${p.example} | ${p.note} |`)].join("\n");
}
function qualityTable(): string {
  return ["| Setting | Resolution | Page picture |", "|---|---|---|", ...QUALITY.map((q) => `| ${q.label.replace(/ \(.*/, "")} | ${q.dpi} dpi | ${q.bw ? "1-bit black and white, lossless" : `JPEG, quality ${Math.round(q.jpeg * 100)}`} |`)].join("\n");
}
function testList(): string {
  return e2e.checks.map((c) => `- ${c}`).join("\n");
}

const PLACEHOLDERS: Record<string, () => string> = {
  "third-party-table": thirdPartyTable,
  "vendor-table": vendorTable,
  "licence-counts": licenceCounts,
  "patterns-table": patternsTable,
  "quality-table": qualityTable,
  "e2e-list": testList,
  "e2e-passed": () => String(e2e.passed),
  "e2e-failed": () => String(e2e.failed),
  "e2e-date": () => e2e.date,
  "e2e-chrome": () => e2e.chrome,
  "unit-tests": () => String(unit.tests),
  version: () => VERSION,
  repo: () => REPO_URL,
  built: () => BUILT,
  package_count: () => String(third.packages.length),
};
const fill = (s: string) => s.replace(/\{\{([a-z0-9_-]+)\}\}/g, (m, k: string) => (PLACEHOLDERS[k] ? PLACEHOLDERS[k]() : m));

// ---- pages ----
const docs: Doc[] = readdirSync(join(root, "docs"))
  .filter((f) => f.endsWith(".md") && !/^(STATUS|architecture)/i.test(f) && f !== "README.md")
  .map((f) => {
    const { meta, body } = frontMatter(read(`docs/${f}`));
    return { slug: f.replace(/\.md$/, ""), title: meta.title ?? f, description: meta.description ?? "", order: Number(meta.order ?? 99), body };
  })
  .sort((a, b) => a.order - b.order);

const NAV = [
  ["/app/", "Open Ebon"],
  ["/docs/guide/", "Guide"],
  ["/docs/privacy/", "Privacy"],
  ["/docs/licence/", "Licence"],
  ["/docs/", "All documentation"],
];

function shell(opts: { title: string; description: string; path: string; body: string; docs?: boolean }): string {
  const nav = NAV.map(([href, label]) => `<a href="${href}"${opts.path === href ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  const side = opts.docs
    ? `<aside aria-label="Documentation"><nav>${docs.map((d) => `<a href="/docs/${d.slug}/"${opts.path === `/docs/${d.slug}/` ? ' aria-current="page"' : ""}>${esc(d.title)}</a>`).join("")}</nav></aside>`
    : "";
  const main = opts.docs ? `<div class="docs">${side}<article>${opts.body}</article></div>` : opts.body;
  return `<!doctype html>
<html lang="en-IE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<meta name="theme-color" content="#15161a">
<link rel="canonical" href="${SITE}${opts.path}">
<link rel="icon" href="/icons/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="stylesheet" href="/site.css">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}${opts.path}">
</head>
<body>
<a class="skip" href="#main">Skip to the content</a>
<header class="site"><div class="wrap"><a class="brand" href="/"><img src="/icons/icon-192.png" alt="" width="30" height="30">Ebon</a><nav aria-label="Main">${nav}</nav></div></header>
<main id="main"><div class="wrap">${main}</div></main>
<footer class="site"><div class="wrap">
<span>Ebon ${VERSION}. Free and open source under the MIT licence.</span>
<a href="${REPO_URL}">Source code</a>
<a href="/docs/changelog/">Changelog</a>
<a href="/docs/research/#how-to-cite-ebon">How to cite</a>
<a href="/third-party-notices.txt">Third-party notices</a>
<a href="${REPO_URL}/issues">Report a problem</a>
</div></footer>
</body>
</html>
`;
}

function write(path: string, html: string) {
  const dir = join(dist, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
}

mkdirSync(dist, { recursive: true });
copyFileSync(join(root, "site", "site.css"), join(dist, "site.css"));
const img = join(root, "docs", "img");
if (existsSync(img)) {
  mkdirSync(join(dist, "docs", "img"), { recursive: true });
  for (const f of readdirSync(img)) copyFileSync(join(img, f), join(dist, "docs", "img", f));
}

// landing page
{
  const { meta, body } = frontMatter(read("site/home.md"));
  const html = marked.parse(fill(body), { async: false }) as string;
  const hero = `<section class="hero">
<h1>${esc(meta.headline)}</h1>
<p class="lede">${esc(meta.lede)}</p>
<p class="cta"><a class="btn primary" href="/app/">Open Ebon</a><a class="btn" href="/docs/guide/">Read the guide</a><a class="btn" href="${REPO_URL}">Get the source code</a></p>
</section>`;
  writeFileSync(join(dist, "index.html"), shell({ title: meta.title, description: meta.description, path: "/", body: hero + html }));
}

// documentation
for (const d of docs) {
  const html = marked.parse(fill(d.body), { async: false }) as string;
  const body = `<h1>${esc(d.title)}</h1><p class="meta">Version ${VERSION}. Page built ${BUILT}.</p>${html}`;
  write(`docs/${d.slug}`, shell({ title: `${d.title} | Ebon`, description: d.description, path: `/docs/${d.slug}/`, body, docs: true }));
}
{
  const list = docs.map((d) => `<li><a href="/docs/${d.slug}/">${esc(d.title)}</a>. ${esc(d.description)}</li>`).join("\n");
  const body = `<h1>Documentation</h1><p>How Ebon works, what it checks, what it cannot do, and the licence terms. Written for the people who use it and for those who need to rely on it.</p><ul>${list}</ul>`;
  write("docs", shell({ title: "Documentation | Ebon", description: "Guide, method, privacy, licence, limits and test results for Ebon.", path: "/docs/", body, docs: true }));
}

writeFileSync(join(dist, "404.html"), shell({ title: "Page not found | Ebon", description: "This page does not exist.", path: "/404", body: `<section class="hero"><h1>Page not found</h1><p class="lede">Try the <a href="/docs/">documentation</a> or <a href="/app/">open Ebon</a>.</p></section>` }));
const urls = ["/", "/app/", "/docs/", ...docs.map((d) => `/docs/${d.slug}/`)];
writeFileSync(join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${SITE}${u}</loc><lastmod>${BUILT}</lastmod></url>`).join("\n")}\n</urlset>\n`);
writeFileSync(join(dist, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`site built: ${docs.length} documentation pages`);
