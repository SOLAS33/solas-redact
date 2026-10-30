import { type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

/** After the build, list the app's own files in the service worker so the tool opens offline. Big optional files (text recognition, fonts) are cached the first time they are used instead. */
function precacheList(): Plugin {
  let outDir = "dist";
  return {
    name: "ebon-precache",
    apply: "build",
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (d: string) => {
        for (const n of readdirSync(d)) {
          const p = join(d, n);
          if (statSync(p).isDirectory()) walk(p);
          else files.push("/" + relative(outDir, p).replaceAll("\\", "/"));
        }
      };
      walk(join(outDir, "assets"));
      const shell = ["/app/", "/app/manifest.webmanifest", "/icons/favicon.png", "/icons/icon-192.png", ...files];
      const swPath = join(outDir, "app", "sw.js");
      const version = String(shell.reduce((h, f) => (h * 31 + f.length + (statSync(join(outDir, f.endsWith("/") ? f + "index.html" : f)).size)) >>> 0, 7));
      writeFileSync(swPath, readFileSync(swPath, "utf8").replace("/*PRECACHE*/[]", JSON.stringify(shell)).replace("__VERSION__", version));
    },
  };
}

export default defineConfig({
  plugins: [react(), precacheList()],
  build: { target: "es2022", sourcemap: false, rollupOptions: { input: { app: "app/index.html" } }, chunkSizeWarningLimit: 1500 },
  test: { include: ["tests/**/*.test.ts"], testTimeout: 60_000 },
});
