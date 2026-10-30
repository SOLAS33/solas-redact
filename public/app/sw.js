/*
 * Solas Redact service worker.
 *  - Keeps the app itself (the files listed below) so it opens with no connection.
 *  - Keeps the optional big files (PDF fonts, text recognition engine and English data) the first time they are used.
 *  - Never sees, stores or sends your documents: it only handles GET requests for the app's own files.
 */
const VERSION = "__VERSION__";
const SHELL_CACHE = "solas-redact-shell-" + VERSION;
const VENDOR_CACHE = "solas-redact-vendor-1";
const SHELL = /*PRECACHE*/[];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("solas-redact-shell-") && k !== SHELL_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate" && url.pathname.startsWith("/app/")) {
    // network first so a new version is picked up; fall back to the kept copy when offline
    event.respondWith(fetch(req).catch(() => caches.match("/app/")));
    return;
  }
  if (url.pathname.startsWith("/vendor/")) {
    event.respondWith(
      caches.open(VENDOR_CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      })
    );
    return;
  }
  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
