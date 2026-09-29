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
  ["long-content", "qa-long-content.mjs"],
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
const runOne = ([name, file]) => {
  console.log(`\n━━━ ${name} (${file}) → ${BASE}`);
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(root, "scripts", file)], {
      stdio: "inherit",
      env,
    });
    child.on("exit", (c) =>
      resolve({ name, code: c ?? 1, secs: Math.round((Date.now() - started) / 1000) }),
    );
    child.on("error", () =>
      resolve({ name, code: 1, secs: Math.round((Date.now() - started) / 1000) }),
    );
  });
};

// Two kinds of harness must stay strictly serial: the source-importing
// workflow checks, and the loop harnesses that MUTATE shared seeded state
// (reputation, follow counts) — run concurrently they race each other's
// deltas and both flake.
const SERIAL = new Set(["workflows", "project-loop", "challenge-loop"]);
// Everything else COULD pool, but the dev server is a single Vite process
// with on-demand transforms: two full browser harnesses at once starve each
// other and a different one flakes every run. So the default pool is 1
// (sequential, stable); opt into more with QA_E2E_POOL=2+ on a faster stack.
const POOL = Math.max(1, Math.min(Number(process.env.QA_E2E_POOL) || 1, 4));
// The long-content harness needs SUPABASE_SERVICE_ROLE_KEY (it seeds extreme
// content straight to the DB). Skip it with a note when the key is absent.
const NEEDS_SERVICE_KEY = new Set(["long-content"]);
const results = [];
const jobs = suite.filter(
  ([n]) => !SERIAL.has(n) && !(NEEDS_SERVICE_KEY.has(n) && !env.SUPABASE_SERVICE_ROLE_KEY),
);
const serialJobs = suite.filter(([n]) => SERIAL.has(n));

const queue = [...jobs];
const worker = async () => {
  for (;;) {
    const job = queue.shift();
    if (!job) return;
    const r = await runOne(job);
    results.push(r);
    console.log(`━━━ ${r.name}: ${r.code === 0 ? "pass" : "FAIL"} (${r.secs}s)`);
  }
};
await Promise.all(Array.from({ length: POOL }, worker));
for (const job of serialJobs) {
  const r = await runOne(job);
  results.push(r);
  console.log(`━━━ ${r.name}: ${r.code === 0 ? "pass" : "FAIL"} (${r.secs}s)`);
}

const byName = new Map(suite.map(([n]) => [n, []]));
for (const r of results) byName.get(r.name)?.push(r);

console.log("\n═══ e2e summary ═══");
for (const [name] of suite) {
  const runs = byName.get(name) ?? [];
  const r = runs[0];
  if (!r) console.log(` ? ${name} (skipped — needs SUPABASE_SERVICE_ROLE_KEY)`);
  else console.log(` ${r.code === 0 ? "✓" : "✗"} ${name} (${r.secs}s)`);
}
const failed = results.filter((r) => r.code !== 0);
console.log(
  failed.length
    ? `\n${failed.length} of ${results.length} harnesses failed`
    : `\nall ${results.length} harnesses passed`,
);
process.exit(failed.length ? 1 : 0);
