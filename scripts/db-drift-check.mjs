#!/usr/bin/env node
// scripts/db-drift-check.mjs
//
// Compares triggers, policies, function grants, and table grants between the
// local and hosted Supabase databases. Also checks the expected-objects
// manifest against both. Exits non-zero on any divergence.
//
// This closes the blind spot the 2026-09-11 drift audit named but left open:
// trigger drift (the audit's dump-based method emitted zero CREATE TRIGGER
// for either database, so F2 was ratified by proxy). It also makes the entire
// drift check repeatable instead of a manual ritual of two dumps + a hand
// diff.
//
// Usage:
//   DB_HOSTED_URL=postgresql://... npm run check:db-drift
//
// Environment:
//   DB_LOCAL_URL  — local Postgres connection string
//                   (default: postgresql://postgres:postgres@localhost:54321/postgres)
//   DB_HOSTED_URL — hosted Postgres connection string (required for hosted
//                   comparison; if unset, only the expected-object check runs
//                   against local)
//
// Requires psql on PATH. In CI, install via `apt-get install -y postgresql-client`.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const DB_LOCAL_URL =
  process.env.DB_LOCAL_URL ||
  "postgresql://postgres:postgres@localhost:54321/postgres";
const DB_HOSTED_URL = process.env.DB_HOSTED_URL;

// ---------------------------------------------------------------------------
// Config files
// ---------------------------------------------------------------------------

const platformGrants = JSON.parse(
  readFileSync(join(repoRoot, ".audit", "platform-managed-grants.json"), "utf8"),
);
const expectedObjects = JSON.parse(
  readFileSync(join(repoRoot, ".audit", "expected-objects.json"), "utf8"),
);

// ---------------------------------------------------------------------------
// SQL queries
// ---------------------------------------------------------------------------

// Non-internal triggers in public + storage, with their table and function.
// This is the query from the drift audit that pg_dump could not answer.
const TRIGGER_QUERY = `
  SELECT t.tgname, c.relname, p.proname
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_proc  p ON p.oid = t.tgfoid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal AND n.nspname IN ('public','storage')
  ORDER BY c.relname, t.tgname
`;

// All RLS policies in public + storage, with role names resolved from OIDs
// (OIDs differ between databases, so we must resolve to names for a stable
// diff).
const POLICY_QUERY = `
  SELECT c.relname, p.polname, p.polcmd,
         pg_get_expr(p.polqual, p.polrelid),
         pg_get_expr(p.polwithcheck, p.polrelid),
         COALESCE(
           (SELECT string_agg(r.rolname, ',' ORDER BY r.rolname)
            FROM pg_roles r WHERE r.oid = ANY(p.polroles)),
           'PUBLIC'
         )
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public','storage')
  ORDER BY c.relname, p.polname
`;

// Table-level grants, excluding platform-managed roles (see allowlist).
// anon and authenticated are KEPT — they are the security boundary.
const GRANT_QUERY = `
  SELECT table_schema, table_name, grantee, privilege_type
  FROM information_schema.table_privileges
  WHERE table_schema IN ('public','storage')
    AND grantee NOT IN (${platformGrants.ignored_grantees
      .map((r) => `'${r}'`)
      .join(", ")})
  ORDER BY table_schema, table_name, grantee, privilege_type
`;

// Function execute grants in public (catches F3: anon holding EXECUTE on a
// function that should be authenticated-only).
const FUNCTION_GRANT_QUERY = `
  SELECT p.proname,
         COALESCE(
           (SELECT string_agg(r.rolname, ',' ORDER BY r.rolname)
            FROM pg_roles r WHERE r.oid = ANY(p.proacl)),
           'PUBLIC'
         )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proacl IS NOT NULL
  ORDER BY p.proname
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runQuery(connectionString, sql) {
  try {
    return execFileSync(
      "psql",
      [connectionString, "-qAt", "-F", "\t", "-c", sql],
      { encoding: "utf8", timeout: 30_000 },
    ).trim();
  } catch (e) {
    console.error(`  Query failed: ${e.message.split("\n")[0]}`);
    return "";
  }
}

function normalizeLines(output) {
  return output
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .sort()
    .join("\n");
}

function diff(label, local, hosted) {
  if (local === hosted) {
    console.log(`  ✓ ${label}: no divergence`);
    return 0;
  }
  console.error(`  ✗ ${label}: DIVERGENCE DETECTED`);
  const localLines = new Set(local.split("\n"));
  const hostedLines = new Set(hosted.split("\n"));
  const onlyLocal = [...localLines].filter((l) => !hostedLines.has(l));
  const onlyHosted = [...hostedLines].filter((l) => !localLines.has(l));
  if (onlyLocal.length) {
    console.error(`    Only in local (${onlyLocal.length}):`);
    onlyLocal.slice(0, 20).forEach((l) => console.error(`      + ${l}`));
    if (onlyLocal.length > 20)
      console.error(`      ... and ${onlyLocal.length - 20} more`);
  }
  if (onlyHosted.length) {
    console.error(`    Only in hosted (${onlyHosted.length}):`);
    onlyHosted.slice(0, 20).forEach((l) => console.error(`      - ${l}`));
    if (onlyHosted.length > 20)
      console.error(`      ... and ${onlyHosted.length - 20} more`);
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Expected-object manifest check
// ---------------------------------------------------------------------------

function checkExpectedObjects(connectionString, label) {
  let failures = 0;

  for (const fn of expectedObjects.functions || []) {
    const result = runQuery(
      connectionString,
      `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.proname = '${fn.name}' AND n.nspname = '${fn.schema}'`,
    );
    if (!result.includes("1")) {
      console.error(`  ✗ ${label}: missing function ${fn.schema}.${fn.name}`);
      failures++;
    } else {
      console.log(`  ✓ ${label}: function ${fn.schema}.${fn.name} exists`);
    }
  }

  for (const tr of expectedObjects.triggers || []) {
    const result = runQuery(
      connectionString,
      `SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE t.tgname = '${tr.name}' AND c.relname = '${tr.table}' AND NOT t.tgisinternal`,
    );
    if (!result.includes("1")) {
      console.error(`  ✗ ${label}: missing trigger ${tr.name} on ${tr.table}`);
      failures++;
    } else {
      console.log(`  ✓ ${label}: trigger ${tr.name} on ${tr.table} exists`);
    }
  }

  for (const pol of expectedObjects.policies || []) {
    const result = runQuery(
      connectionString,
      `SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE p.polname = '${pol.name.replace(/'/g, "''")}' AND c.relname = '${pol.table}' AND n.nspname = '${pol.schema}'`,
    );
    if (!result.includes("1")) {
      console.error(
        `  ✗ ${label}: missing policy "${pol.name}" on ${pol.schema}.${pol.table}`,
      );
      failures++;
    } else {
      console.log(
        `  ✓ ${label}: policy "${pol.name}" on ${pol.schema}.${pol.table} exists`,
      );
    }
  }

  for (const idx of expectedObjects.indexes || []) {
    const result = runQuery(
      connectionString,
      `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = '${idx.name}' AND n.nspname = '${idx.schema}' AND c.relkind = 'i'`,
    );
    if (!result.includes("1")) {
      console.error(`  ✗ ${label}: missing index ${idx.schema}.${idx.name}`);
      failures++;
    } else {
      console.log(`  ✓ ${label}: index ${idx.schema}.${idx.name} exists`);
    }
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let exitCode = 0;

console.log("=== Expected object checks (local) ===");
exitCode += checkExpectedObjects(DB_LOCAL_URL, "local");

if (DB_HOSTED_URL) {
  console.log("\n=== Expected object checks (hosted) ===");
  exitCode += checkExpectedObjects(DB_HOSTED_URL, "hosted");

  console.log("\n=== Trigger diff ===");
  exitCode += diff(
    "triggers",
    normalizeLines(runQuery(DB_LOCAL_URL, TRIGGER_QUERY)),
    normalizeLines(runQuery(DB_HOSTED_URL, TRIGGER_QUERY)),
  );

  console.log("\n=== Policy diff ===");
  exitCode += diff(
    "policies",
    normalizeLines(runQuery(DB_LOCAL_URL, POLICY_QUERY)),
    normalizeLines(runQuery(DB_HOSTED_URL, POLICY_QUERY)),
  );

  console.log("\n=== Table grant diff (platform-managed excluded) ===");
  exitCode += diff(
    "table grants",
    normalizeLines(runQuery(DB_LOCAL_URL, GRANT_QUERY)),
    normalizeLines(runQuery(DB_HOSTED_URL, GRANT_QUERY)),
  );

  console.log("\n=== Function grant diff ===");
  exitCode += diff(
    "function grants",
    normalizeLines(runQuery(DB_LOCAL_URL, FUNCTION_GRANT_QUERY)),
    normalizeLines(runQuery(DB_HOSTED_URL, FUNCTION_GRANT_QUERY)),
  );
} else {
  console.log(
    "\n(DB_HOSTED_URL not set — skipping hosted comparison. Set it to run the full drift check.)",
  );
}

if (exitCode > 0) {
  console.error(`\n✗ Drift check FAILED with ${exitCode} issue(s)`);
  process.exit(1);
} else {
  console.log("\n✓ Drift check passed");
  process.exit(0);
}
