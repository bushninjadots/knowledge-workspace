#!/usr/bin/env node
/**
 * Fails when a module exports a component, helper, hook, or type that nothing
 * else in the repo imports. Keeps dead UI code from accumulating: pair it with
 * `npm run typecheck` in CI so both "broken" and "unused" fail the build.
 *
 * Deliberately simple (no TS program): it collects exported identifiers per
 * file and looks for any reference to that identifier from another file.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src"];
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
/** Individual export names that are intentionally part of a public surface. */
const IGNORED_EXPORTS = new Set(["default"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = SCAN_DIRS.flatMap((dir) => walk(path.join(ROOT, dir))).map((f) =>
  path.relative(ROOT, f).split(path.sep).join("/"),
);
// Anything in the repo may reference an export (tests, scripts, docs of record).
const referenceFiles = [
  ...files,
  ...walk(path.join(ROOT, "tests")).map((f) => path.relative(ROOT, f).split(path.sep).join("/")),
];

const sources = new Map(referenceFiles.map((f) => [f, readFileSync(path.join(ROOT, f), "utf8")]));

const EXPORT_PATTERNS = [
  /export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g,
  /export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/g,
  /export\s+class\s+([A-Za-z0-9_$]+)/g,
  /export\s+(?:type|interface|enum)\s+([A-Za-z0-9_$]+)/g,
];

const findings = [];

for (const file of files) {
  if (IGNORED_FILES.some((re) => re.test(file))) continue;
  const source = sources.get(file) ?? "";
  const names = new Set();
  for (const pattern of EXPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) names.add(match[1]);
  }

  for (const name of names) {
    if (IGNORED_EXPORTS.has(name)) continue;
    const usage = new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`);
    const usedElsewhere = referenceFiles.some(
      (other) => other !== file && usage.test(sources.get(other) ?? ""),
    );
    if (!usedElsewhere) findings.push(`${file} → ${name}`);
  }
}

if (findings.length > 0) {
  console.error(`Unused exports detected (${findings.length}):\n`);
  for (const finding of findings) console.error(`  ${finding}`);
  console.error(
    "\nRemove them, use them, or add an intentional exception in scripts/check-unused-exports.mjs.",
  );
  process.exit(1);
}

console.log(`No unused exports found across ${files.length} files.`);
