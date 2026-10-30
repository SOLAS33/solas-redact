---
title: Run your own copy
description: How to build Ebon from source, run it on your own computer or server, and host it for free.
order: 9
---

Ebon is a set of static files. Anyone can build them and put them on any web server, or run them on their own computer. You do not need our permission, and nothing in the copy depends on our site.

## Build it

You need [Node.js](https://nodejs.org/) 22 or later and git.

```bash
git clone {{repo}}.git
cd ebon
npm ci
npm run build
```

`npm run build` copies the PDF and text recognition support files out of the installed packages, checks the types, builds the app, and builds the website pages into `dist/`. Nothing is fetched from the internet during the build apart from the packages that `npm ci` installs.

## Run it on your computer

```bash
npm run preview
```

Open the address it prints, then add `/app/`. Browsers do not run the tool when `index.html` is opened straight from disk, because it relies on web workers. Use the preview server, or any static file server pointed at `dist/`.

After the first load, Ebon works with no connection. In Chrome you can choose Install in the address bar to get a desktop shortcut.

## Host it for free

The `dist/` folder is static. Any static host works.

- **Cloudflare (what we use).** `wrangler.jsonc` in the repository serves `dist/` as static assets. Requests to static assets are free and unlimited on Cloudflare, and the Free plan allows 20,000 files and 25 MiB per file, far above what Ebon needs. See [licence](/docs/licence/) for the sources.
- **GitHub Pages, Netlify and others.** Copy `dist/`. Then add the security headers from `public/_headers` if the host lets you. Without them the tool still works, but the policy that stops the page from connecting elsewhere is not enforced.

Set `SITE_URL` before building if the site will live at another address, so that the pages and the site map name the right address.

## Keep the licence files

Whoever serves Ebon should leave `LICENSE` and `/third-party-notices.txt` in place. See [licence](/docs/licence/) for the short list of things to do.

## Check your copy

`npm test` runs the unit tests. `npm run test:e2e` starts Chrome, serves `dist/` with the real headers, and runs the full browser test. Set `CHROME_PATH` if Chrome is not in a standard place. The [test results](/docs/testing/) describe each check.

## Change it

The code is in `src/`. The search, conversion, flattening and checking code is under `src/engine/` and does not depend on the interface. The [architecture notes]({{repo}}/blob/main/docs/architecture.md) describe how the pieces fit. Please run the browser test before you share a change, and keep the rule that a copy which fails a check is never offered for download.
