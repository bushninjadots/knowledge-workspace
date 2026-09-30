// Backfill cached repo metadata for existing project_repositories rows.
//
// Written for the 2026-09-30 metadata work: the safe view only started
// exposing `metadata` again after 20260930120000, and rows linked/imported
// before that carry a { full_name, default_branch: "HEAD" } stub or nothing
// at all — so project pages render no stats until someone hits refresh.
//
// What it does per github row:
//   * fetches fresh metadata from the GitHub REST API (repo snapshot)
//   * on 404 (fictional seed repos like atlas-travel/atlas) leaves the row
//     untouched — empty metadata keeps rendering exactly as before
//   * merges over the previous snapshot so nothing regresses
//   * updates updated_at (the cards show "Updated …" from cached updated_at)
//
// Env (defaults fit the local Base44 stack): SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY (loaded from .env.supabase-runtime when not set),
// GITHUB_TOKEN (optional; raises the rate limit and covers private repos —
// but only for repos the token's owner can see).
//
// Usage: node scripts/backfill-repo-metadata.mjs [--dry-run] [--only <uuid>]
import { readFileSync } from "node:fs";

// ── env ──────────────────────────────────────────────────────────────────────
function loadEnv() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const raw = readFileSync(new URL("../.env.supabase-runtime", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!(key in process.env)) process.env[key] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    /* fall through to the explicit error below */
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or keep .env.supabase-runtime).");
  process.exit(1);
}

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

// ── GitHub ───────────────────────────────────────────────────────────────────
const GH_TOKEN = process.env.GITHUB_TOKEN ?? null;

function ghHeaders() {
  const h = { Accept: "application/vnd.github.v3+json" };
  if (GH_TOKEN) h.Authorization = `Bearer ${GH_TOKEN}`;
  return h;
}

function repoFullNameFromUrl(url) {
  return (url ?? "")
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/\/$/, "")
    .replace(/\.git$/, "");
}

async function fetchRepoMeta(fullName) {
  const res = await fetch(`https://api.github.com/repos/${fullName}`, { headers: ghHeaders() });
  if (res.status === 404) return { notFound: true };
  if (res.status === 401) throw new Error("GitHub rejected the token (401)");
  if (res.status === 403 || res.status === 429) throw new Error("GitHub rate-limited (403/429)");
  if (!res.ok) return { meta: null };
  const json = await res.json();
  return {
    meta: {
      full_name: json.full_name,
      description: json.description,
      language: json.language,
      stargazers_count: json.stargazers_count,
      forks_count: json.forks_count,
      updated_at: json.updated_at,
      topics: json.topics,
      private: json.private,
      default_branch: json.default_branch,
    },
  };
}

async function fetchCommitActivity(fullName) {
  try {
    const res = await fetch(`https://api.github.com/repos/${fullName}/stats/commit_activity`, {
      headers: ghHeaders(),
    });
    if (res.status === 202) return { pending: true, weeks: null, notFound: false };
    if (res.status === 404) return { pending: false, weeks: null, notFound: true };
    if (!res.ok) return { pending: false, weeks: null, notFound: false };
    const json = await res.json();
    if (!Array.isArray(json)) return { pending: false, weeks: null, notFound: false };
    const weeks = json
      .filter((w) => typeof w.week === "number" && Array.isArray(w.days))
      .map((w) => ({ week: w.week, total: w.total ?? 0, days: (w.days ?? []).slice(0, 7) }));
    return { pending: false, weeks: weeks.slice(-52), notFound: false };
  } catch {
    return { pending: false, weeks: null, notFound: false };
  }
}

// ── Supabase (service role — RLS does not apply) ─────────────────────────────
async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`REST ${res.status} on ${path}: ${body.slice(0, 300)}`);
  }
  return res;
}

async function listRepos() {
  const qs = new URLSearchParams({
    provider: "eq.github",
    select: "id,url,metadata",
    order: "created_at.asc",
  });
  if (ONLY) qs.set("id", `eq.${ONLY}`);
  const res = await rest(`project_repositories?${qs}`);
  return res.json();
}

async function updateMetadata(id, metadata) {
  const qs = new URLSearchParams({ id: `eq.${id}` });
  await rest(`project_repositories?${qs}`, {
    method: "PATCH",
    body: JSON.stringify({ metadata, updated_at: new Date().toISOString() }),
  });
}

// ── main ─────────────────────────────────────────────────────────────────────
const rows = await listRepos();
console.log(
  `Found ${rows.length} github repo row(s)${ONLY ? ` (id=${ONLY})` : ""}${DRY_RUN ? " — dry run" : ""}\n`,
);

let updated = 0;
let skipped404 = 0;
let failed = 0;

for (const row of rows) {
  const fullName = row.metadata?.full_name ?? repoFullNameFromUrl(row.url);
  if (!fullName || !fullName.includes("/")) {
    console.log(`· skip  ${row.id} — cannot derive owner/repo from ${row.url}`);
    skipped404++;
    continue;
  }

  let result;
  try {
    result = await fetchRepoMeta(fullName);
  } catch (err) {
    console.error(`× fail  ${fullName} — ${err.message}`);
    failed++;
    continue;
  }

  if (result.notFound) {
    console.log(`· skip  ${fullName} — not found on GitHub (seed repo), row untouched`);
    skipped404++;
    continue;
  }

  if (!result.meta) {
    console.log(`· skip  ${fullName} — GitHub returned an unexpected response, row untouched`);
    failed++;
    continue;
  }

  const prevActivity = Array.isArray(row.metadata?.commit_activity)
    ? row.metadata.commit_activity
    : null;
  const metadata = { ...result.meta };

  // Contribution graph: fresh weeks when GitHub has them, previous cache when
  // it's still computing (202), nothing on a hard 404.
  if (result.meta && !DRY_RUN) {
    const activity = await fetchCommitActivity(fullName);
    if (activity.weeks) metadata.commit_activity = activity.weeks;
    else if (prevActivity && !activity.notFound) metadata.commit_activity = prevActivity;
  } else if (result.meta && prevActivity) {
    metadata.commit_activity = prevActivity; // dry run keeps it in the report only
  }

  if (DRY_RUN) {
    const graph = metadata.commit_activity
      ? ` · graph (${metadata.commit_activity.reduce((n, w) => n + w.total, 0)} commits/yr)`
      : "";
    console.log(
      `→ would update ${fullName} — ★${result.meta.stargazers_count} · ${result.meta.language ?? "?"} · branch ${result.meta.default_branch}${result.meta.private ? " · private" : ""}${graph}`,
    );
    updated++;
    continue;
  }

  try {
    await updateMetadata(row.id, metadata);
    const graph = metadata.commit_activity
      ? ` · graph (${metadata.commit_activity.reduce((n, w) => n + w.total, 0)} commits/yr)`
      : "";
    console.log(
      `✓ backfilled ${fullName} — ★${metadata.stargazers_count} · ${metadata.language ?? "?"} · branch ${metadata.default_branch}${metadata.private ? " · private" : ""}${graph}`,
    );
    updated++;
  } catch (err) {
    console.error(`× fail  ${fullName} — ${err.message}`);
    failed++;
  }

  // Tiny pause: friendly to GitHub whether or not a token is attached.
  await new Promise((r) => setTimeout(r, 300));
}

console.log(`\nDone — ${updated} updated, ${skipped404} skipped, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
