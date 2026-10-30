// Runs the unit tests and records how many passed in docs/data/unit-results.json, which the website reads.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

mkdirSync("docs/data", { recursive: true });
const r = spawnSync("npx", ["vitest", "run", "--reporter=json", "--outputFile=docs/data/unit-raw.json"], { stdio: "inherit", shell: true });
const raw = JSON.parse(readFileSync("docs/data/unit-raw.json", "utf8"));
rmSync("docs/data/unit-raw.json");
writeFileSync("docs/data/unit-results.json", JSON.stringify({ date: new Date().toISOString().slice(0, 10), tests: raw.numPassedTests, failed: raw.numFailedTests }, null, 2));
console.log(`unit tests: ${raw.numPassedTests} passed, ${raw.numFailedTests} failed`);
process.exit(r.status ?? 1);
