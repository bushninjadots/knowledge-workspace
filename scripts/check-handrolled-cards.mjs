#!/usr/bin/env node
/**
 * Fails when a NEW hand-rolled card recipe is introduced. The Card primitive
 * (`@/components/ui/card`) is the canonical surface; markup that re-types
 * `rounded-xl border card-border bg-surface` by hand bypasses it and drifts
 * (radius, border color, hover). Existing occurrences are recorded in
 * `scripts/handrolled-cards-baseline.json`, so the check is actionable from
 * day one: the build only breaks on additions, and the baseline shrinks as
 * surfaces migrate onto Card.
 *
 * Usage:
 *   node scripts/check-handrolled-cards.mjs                  # check (CI)
 *   node scripts/check-handrolled-cards.mjs --update-baseline # re-record
 *
 * Deliberately simple (text scan, no TS program): it looks at className
 * values in TSX and flags values carrying the card recipe markers. Known
 * intentional non-card users of the same tokens (SegmentedControl tracks,
 * translucent rows on tinted backgrounds, skeletons) stay in the baseline and
 * shrink as they are converted.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, "scripts", "handrolled-cards-baseline.json");
const UPDATE = process.argv.includes("--update-baseline");

/** className values carrying all three markers are the hand-rolled card recipe. */
function isHandRolledCard(className) {
  return (
    className.includes("rounded-xl") &&
    className.includes("card-border") &&
    className.includes("bg-surface")
  );
}

function collectTsxFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectTsxFiles(full, out);
    } else if (entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

function classNamesIn(source) {
  const out = [];
  // className="..."
  for (const m of source.matchAll(/className="([^"]*)"/g)) out.push(m[1]);
  // className='...'  and  className={`...`} (no nested backticks / braces)
  for (const m of source.matchAll(/className=\{`([^`]*)`\}/g)) out.push(m[1]);
  for (const m of source.matchAll(/className='([^']*)'/g)) out.push(m[1]);
  return out;
}

const files = collectTsxFiles(path.join(ROOT, "src"));
const counts = {};
const offenders = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  let hits = 0;
  for (const cn of classNamesIn(source)) {
    if (isHandRolledCard(cn)) hits += 1;
  }
  if (hits > 0) {
    counts[rel] = hits;
    offenders.push([rel, hits]);
  }
}

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
  : {};

if (UPDATE) {
  writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + "\n");
  console.log(
    `Updated baseline: ${Object.keys(counts).length} files, ${Object.values(counts).reduce(
      (a, b) => a + b,
      0,
    )} hand-rolled card occurrences.`,
  );
  process.exit(0);
}

const growth = [];
for (const [rel, count] of offenders) {
  const allowed = baseline[rel] ?? 0;
  if (count > allowed) growth.push(`${rel}: ${allowed} → ${count}`);
}
// Files removed from the baseline also count as progress, not failures.

if (growth.length > 0) {
  console.error("Hand-rolled card recipes grew beyond the baseline. Migrate to <Card> instead:");
  for (const line of growth) console.error(`  ${line}`);
  console.error("\nRe-record the baseline with: npm run check:cards -- --update-baseline");
  process.exit(1);
}

console.log(
  `No new hand-rolled card recipes (${Object.values(counts).reduce((a, b) => a + b, 0)} total, ` +
    `${Object.keys(counts).length} files — shrink the baseline as surfaces migrate).`,
);
