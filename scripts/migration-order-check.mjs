#!/usr/bin/env node
// scripts/migration-order-check.mjs
//
// Verifies that all migration filenames have strictly monotonically
// increasing timestamps. A new migration whose timestamp is ≤ an existing
// one can never apply in order on a database that has already passed that
// point — exactly the root cause of the 20260705022445 / 20260706100000
// drift (drift audit §"Root cause"). The failure recurred twice
// (KNOWN_ISSUES.md §3) and caused objects to be recorded as applied while
// never landing.
//
// Exits non-zero if any timestamp is out of order.

import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "supabase", "migrations");

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const timestamps = files
  .map((f) => {
    const match = f.match(/^(\d{14})/);
    return match ? { file: f, ts: match[1] } : null;
  })
  .filter(Boolean);

let failures = 0;
let prev = null;

for (const { file, ts } of timestamps) {
  if (prev && ts <= prev.ts) {
    console.error(
      `✗ ${file} (timestamp ${ts}) ≤ ${prev.file} (timestamp ${prev.ts})`,
    );
    failures++;
  }
  prev = { file, ts };
}

if (failures > 0) {
  console.error(
    `\n✗ Migration order check FAILED: ${failures} out-of-order migration(s)`,
  );
  console.error(
    "  A migration with a timestamp ≤ an earlier file can never apply in order",
  );
  console.error(
    "  on a database that has already passed that point. Use a timestamp",
  );
  console.error("  later than the newest existing migration.");
  process.exit(1);
} else {
  console.log(
    `✓ Migration order check passed (${timestamps.length} migrations, all monotonically increasing)`,
  );
  process.exit(0);
}
