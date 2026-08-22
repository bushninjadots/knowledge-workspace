#!/usr/bin/env node
/**
 * Fails when a NEW unused export (component, hook, helper, or type) is
 * introduced. Existing unused exports are recorded in
 * `scripts/unused-exports-baseline.json`, so the check is actionable from day
 * one: the build only breaks on additions, and the baseline can be shrunk as
 * dead code gets removed.
 *
 * Usage:
 *   node scripts/check-unused-exports.mjs                  # check (CI)
 *   node scripts/check-unused-exports.mjs --update-baseline # re-record
 *
 * Deliberately simple (no TS program): it collects exported identifiers per
 * file and looks for any reference to that identifier from another file.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, "scripts", "unused-exports-baseline.json");
const UPDATE = process.argv.includes("--update-baseline");

/** Files whose exports are consumed by the framework / tooling, not by imports. */
const IGNORED_FILES = [
  /^src\/routes\//, // TanStack file routes (Route, loaders, head)
  /^src\/routeTree\.gen\.ts$/,
  /^src\/router\.tsx$/,
  /^src\/server\.ts$/,
  /^src\/start\.ts$/,
  /^src\/integrations\//, // generated Supabase client + types
  /^src\/components\/ui\//, // shadcn primitives keep their full public surface
  /\.test\.(ts|tsx)$/,
  /\.d\.ts$/,
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/");
const files = walk(path.join(ROOT, "src")).map(rel);
// Anything in the repo may reference an export (tests included).
const referenceFiles = [...files, ...walk(path.join(ROOT, "tests")).map(rel)];
const sources = new Map(referenceFiles.map((f) => [f, readFileSync(path.join(ROOT, f), "utf8")]));

const EXPORT_PATTERNS = [
  /export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g,
  /export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/g,
  /export\s+class\s+([A-Za-z0-9_$]+)/g,
  /export\s+(?:type|interface|enum)\s+([A-Za-z0-9_$]+)/g,
];

const unused = [];

for (const file of files) {
  if (IGNORED_FILES.some((re) => re.test(file))) continue;
  const source = sources.get(file) ?? "";
  const names = new Set();
  for (const pattern of EXPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) names.add(match[1]);
  }

  for (const name of names) {
    if (name === "default") continue;
    const usage = new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`);
    const usedElsewhere = referenceFiles.some(
      (other) => other !== file && usage.test(sources.get(other) ?? ""),
    );
    if (!usedElsewhere) unused.push(`${file} → ${name}`);
  }
}

unused.sort();

if (UPDATE) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(unused, null, 2)}\n`);
  console.log(`Baseline updated with ${unused.length} known unused exports.`);
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH)
  ? new Set(JSON.parse(readFileSync(BASELINE_PATH, "utf8")))
  : new Set();

const added = unused.filter((entry) => !baseline.has(entry));
const fixed = [...baseline].filter((entry) => !unused.includes(entry));

if (added.length > 0) {
  console.error(`New unused exports detected (${added.length}):\n`);
  for (const entry of added) console.error(`  ${entry}`);
  console.error(
    "\nUse them, delete them, or (only with a reason) re-record the baseline:\n" +
      "  npm run check:unused -- --update-baseline",
  );
  process.exit(1);
}

if (fixed.length > 0) {
  console.log(`${fixed.length} baseline entries are no longer unused — nice.`);
  console.log("Shrink the baseline with: npm run check:unused -- --update-baseline");
}

console.log(
  `No new unused exports across ${files.length} files (${baseline.size} known, tracked in the baseline).`,
);
