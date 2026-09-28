#!/usr/bin/env node
/**
 * Single entry point for the browser/HTTP QA harnesses (`scripts/qa-*.mjs`).
 *
 * Usage:
 *   npm run e2e                                 # everything, against the local stack
 *   npm run e2e -- --base http://127.0.0.1:8790 # e.g. the production bundle server
 *   npm run e2e -- --only studio,studio-view    # a subset, by name
 *
 * Requires the stack from `bash scripts/base44-start.sh` to be up on the base
 * URL. The production-only checks (enforced CSP nonce, bundle shape) are NOT
 * part of this suite — serve the prod bundle with `npm run serve:prod` and run
 * `qa-csp.mjs --require-enforced` / `qa-audit.mjs` against it explicitly.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
};
const BASE = arg("base", process.env.QA_BASE || "http://localhost:3000");

// Ordered: cheap HTTP checks first, interactive flows after (they own browsers
// for minutes). qa-workflows imports two app source modules by URL, which only
// resolves against the dev server — hence the note at the top.
const SUITE = [
  ["csp", "qa-csp.mjs"],
  ["audit", "qa-audit.mjs"],
  ["workflows", "qa-workflows.mjs"],
  ["studio-parity", "qa-studio-parity.mjs"],
  ["studio-builder", "qa-studio.mjs"],
  ["studio-view", "qa-studio-view.mjs"],
  ["studio-blindspots", "qa-studio-blindspots.mjs"],
  ["avatar-shape", "qa-avatar-shape.mjs"],
  ["explore-overlay", "qa-explore-overlay.mjs"],
  ["project-loop", "qa-project-loop.mjs"],
  ["challenge-loop", "qa-challenge-loop.mjs"],
];

const onlyArg = arg("only", "");
const wanted = onlyArg ? onlyArg.split(",").map((s) => s.trim()) : null;
const suite = wanted ? SUITE.filter(([name]) => wanted.includes(name)) : SUITE;
if (suite.length === 0) {
  console.error(`no harness matched --only ${onlyArg}; names: ${SUITE.map(([n]) => n).join(", ")}`);
  process.exit(2);
}

const env = { ...process.env, QA_BASE: BASE };
const results = [];
for (const [name, file] of suite) {
  console.log(`\n━━━ ${name} (${file}) → ${BASE}`);
  const started = Date.now();
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(root, "scripts", file)], {
      stdio: "inherit",
      env,
    });
    child.on("exit", (c) => resolve(c ?? 1));
    child.on("error", () => resolve(1));
  });
  const secs = Math.round((Date.now() - started) / 1000);
  results.push({ name, code, secs });
  console.log(`━━━ ${name}: ${code === 0 ? "pass" : "FAIL"} (${secs}s)`);
}

console.log("\n═══ e2e summary ═══");
for (const r of results) console.log(` ${r.code === 0 ? "✓" : "✗"} ${r.name} (${r.secs}s)`);
const failed = results.filter((r) => r.code !== 0);
console.log(
  failed.length
    ? `\n${failed.length} of ${results.length} harnesses failed`
    : `\nall ${results.length} harnesses passed`,
);
process.exit(failed.length ? 1 : 0);
