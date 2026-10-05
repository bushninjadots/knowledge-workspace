// Bundle-size tripwire.
//
// Walks the Vite/Nitro build output (.output) for JS/MJS chunks, reports the
// largest, and fails CI if any single chunk exceeds the budget. This catches
// gross regressions like re-importing lowlight's full `common` bundle or
// letting the Tiptap editor leak back into a route's initial chunk.
//
// Client (.output/public) and server chunks have separate budgets, each
// configurable via env so CI (or a local override) can tune them:
//   BUNDLE_CLIENT_MAX_RAW / BUNDLE_CLIENT_MAX_GZIP  (default 650000 / 200000)
//   BUNDLE_SERVER_MAX_RAW / BUNDLE_SERVER_MAX_GZIP  (default 800000 / 210000)
//
// Run after `npm run build`. Exits 1 on any over-budget chunk.

import { readdir, stat, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { gzipSync } from "node:zlib";

const OUT_DIR = ".output";
const CLIENT_MAX_RAW = Number(process.env.BUNDLE_CLIENT_MAX_RAW ?? 650_000);
const CLIENT_MAX_GZIP = Number(process.env.BUNDLE_CLIENT_MAX_GZIP ?? 200_000);
const SERVER_MAX_RAW = Number(process.env.BUNDLE_SERVER_MAX_RAW ?? 800_000);
const SERVER_MAX_GZIP = Number(process.env.BUNDLE_SERVER_MAX_GZIP ?? 210_000);
const EXTS = new Set([".js", ".mjs"]);

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (EXTS.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const files = await walk(OUT_DIR);
if (files.length === 0) {
  console.error(`No JS/MJS chunks found under ${OUT_DIR} — run \`npm run build\` first.`);
  process.exit(1);
}

const sizes = await Promise.all(
  files.map(async (path) => {
    const raw = (await stat(path)).size;
    const gzip = gzipSync(await readFile(path)).length;
    return { path, raw, gzip };
  }),
);
sizes.sort((a, b) => b.gzip - a.gzip);

const isClient = (path) => path.includes(".output/public/");
const budgetFor = (path) =>
  isClient(path)
    ? { raw: CLIENT_MAX_RAW, gzip: CLIENT_MAX_GZIP }
    : { raw: SERVER_MAX_RAW, gzip: SERVER_MAX_GZIP };

const kB = (n) => `${(n / 1000).toFixed(1)} kB`;
const fmt = (n) => n.toLocaleString("en-US");

console.log("Bundle-size report (top 12 by gzip):");
for (const { path, raw, gzip } of sizes.slice(0, 12)) {
  const budget = budgetFor(path);
  const flags = [
    raw > budget.raw ? `raw ${fmt(raw)} > ${fmt(budget.raw)}` : null,
    gzip > budget.gzip ? `gzip ${fmt(gzip)} > ${fmt(budget.gzip)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  console.log(
    `  ${path.padEnd(70)} ${kB(raw).padStart(9)}  gzip ${kB(gzip).padStart(9)}${flags ? `  ⚠ ${flags}` : ""}`,
  );
}

const failures = sizes.filter((s) => {
  const budget = budgetFor(s.path);
  return s.raw > budget.raw || s.gzip > budget.gzip;
});
if (failures.length > 0) {
  console.error(`\n${failures.length} chunk(s) exceed their bundle budget.`);
  for (const { path, raw, gzip } of failures) {
    const budget = budgetFor(path);
    console.error(
      `  ${path}: raw ${fmt(raw)} / ${fmt(budget.raw)}, gzip ${fmt(gzip)} / ${fmt(budget.gzip)}`,
    );
  }
  process.exit(1);
}

console.log(`\n✓ All ${sizes.length} chunks within their client/server budgets.`);
