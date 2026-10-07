// ── Keeping GitHub data fresh (server only) ───────────────────────────────────
// The cached snapshots Tethyr shows — a project's repo stats and commit graph,
// a crew's GitHub organisation repos — and library notes linked to a file
// are refreshed here, so pages never call GitHub themselves. Used by:
//   • "Sync everything" in Settings → GitHub (one member's projects, notes
//     and crews; see syncAllGithub in github-server.ts)
//   • the daily job (POST /api/cron/github-refresh, scheduled by pg_cron;
//     see src/server.ts) for everything.
//
// Only imported dynamically from server code: it uses the service-role
// client and members' stored tokens, which never reach the browser.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchRepoCommitActivity,
  fetchRepoFile,
  fetchRepoMeta,
  fetchUserRepos,
  getRepoFullName,
  type RepoMeta,
} from "./github";
import { parseGithubSource, type GithubSource } from "./github-source";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any>;

/**
 * Tethyr's own read-only token for PUBLIC GitHub data (env GITHUB_PUBLIC_TOKEN),
 * used when a member hasn't stored one. It only lifts the anonymous limit
 * (60 requests an hour, shared by the whole server) to 5,000. It must be a
 * fine-grained token with "Public repositories (read-only)" access, and it is
 * only ever sent with requests for a named repo or user — never /user/* — so
 * it can't widen what anyone sees.
 */
export function publicGithubToken(): string | undefined {
  const token = typeof process !== "undefined" ? process.env?.GITHUB_PUBLIC_TOKEN : undefined;
  return token?.trim() || undefined;
}

/** Members' stored tokens, by user id (each falls back to the public one). */
async function tokensFor(admin: Admin, userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data } = await admin
    .from("user_github_tokens")
    .select("user_id, token")
    .in("user_id", [...new Set(userIds)]);
  return new Map(
    ((data ?? []) as Array<{ user_id: string; token: string }>).map((row) => [
      row.user_id,
      row.token,
    ]),
  );
}

export type RefreshSummary = {
  /** Repositories looked at, and how many got fresh data. */
  repos: number;
  refreshed: number;
  /** Crews whose GitHub organisation was refreshed. */
  teams: number;
  /** Stopped before the end because GitHub rate-limited us. */
  rateLimited: boolean;
};

type RepoRow = {
  id: string;
  project_id: string;
  url: string;
  metadata: (RepoMeta & Record<string, unknown>) | null;
};

/**
 * Refresh the cached snapshot (stats, topics, commit graph) of GitHub repos
 * linked to projects — all of them, or those of `projectIds`. Merges over the
 * last good snapshot, so a failed or still-computing fetch never wipes what
 * was there; only a repo that's gone clears its commit graph. Oldest first,
 * and capped, so a big run spreads across days instead of hitting limits.
 */
export async function refreshRepoSnapshots(
  admin: Admin,
  { projectIds, max = 150 }: { projectIds?: string[]; max?: number } = {},
): Promise<Omit<RefreshSummary, "teams">> {
  if (projectIds && projectIds.length === 0) return { repos: 0, refreshed: 0, rateLimited: false };
  let query = admin
    .from("project_repositories")
    .select("id, project_id, url, metadata")
    .eq("provider", "github")
    .order("updated_at", { ascending: true })
    .limit(max);
  if (projectIds) query = query.in("project_id", projectIds);
  const { data } = await query;
  const repos = (data ?? []) as RepoRow[];
  if (repos.length === 0) return { repos: 0, refreshed: 0, rateLimited: false };

  // Each repo is read with its project owner's token when they stored one.
  const { data: projects } = await admin
    .from("projects")
    .select("id, profile_id")
    .in("id", [...new Set(repos.map((r) => r.project_id))]);
  const ownerOf = new Map(
    ((projects ?? []) as Array<{ id: string; profile_id: string }>).map((p) => [
      p.id,
      p.profile_id,
    ]),
  );
  const tokens = await tokensFor(admin, [...ownerOf.values()]);
  const fallback = publicGithubToken();

  let refreshed = 0;
  for (const repo of repos) {
    const fullName = getRepoFullName(repo);
    const [owner, name] = fullName.split("/");
    if (!owner || !name) continue;
    const token = tokens.get(ownerOf.get(repo.project_id) ?? "") ?? fallback;
    const [meta, activity] = await Promise.all([
      fetchRepoMeta(owner, name, token),
      fetchRepoCommitActivity(fullName, token),
    ]);
    if (activity.rateLimited) return { repos: repos.length, refreshed, rateLimited: true };

    const metadata: Record<string, unknown> = { ...(repo.metadata ?? {}), ...(meta ?? {}) };
    if (activity.weeks && activity.weeks.length > 0) metadata.commit_activity = activity.weeks;
    if (activity.notFound) delete metadata.commit_activity;
    const { error } = await admin
      .from("project_repositories")
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq("id", repo.id);
    if (!error && (meta || activity.weeks)) refreshed += 1;
  }
  return { repos: repos.length, refreshed, rateLimited: false };
}

/** A crew's GitHub organisation (or user), from its github link. */
export function githubOrgFrom(link: string | null | undefined): string | null {
  if (!link) return null;
  const handle = link
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0];
  return /^[A-Za-z0-9-]{1,39}$/.test(handle) ? handle : null;
}

export type TeamGithubSnapshot = {
  org: string;
  repos: Array<{
    full_name: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
  }>;
  synced_at: string;
};

/**
 * Cache a crew's public GitHub repositories (most-starred first) on the crew,
 * from its github link — or clear the cache when the link is gone. Returns
 * false when GitHub couldn't be read (the old snapshot is kept).
 */
export async function refreshTeamSnapshot(
  admin: Admin,
  team: { id: string; social_links: Record<string, string> | null },
): Promise<boolean> {
  const org = githubOrgFrom(team.social_links?.github);
  if (!org) {
    await admin.from("teams").update({ github_snapshot: null }).eq("id", team.id);
    return true;
  }
  const repos = await fetchUserRepos(org, undefined, publicGithubToken());
  if (repos.length === 0) return false;
  const snapshot: TeamGithubSnapshot = {
    org,
    repos: repos
      .filter((repo) => !repo.private)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 6)
      .map(({ full_name, description, language, stargazers_count }) => ({
        full_name,
        description,
        language,
        stargazers_count,
      })),
    synced_at: new Date().toISOString(),
  };
  const { error } = await admin
    .from("teams")
    .update({ github_snapshot: snapshot })
    .eq("id", team.id);
  return !error;
}

export type LibrarySyncResult =
  | { ok: true; updated: boolean; source: GithubSource }
  | {
      ok: false;
      reason: "forbidden" | "not_linked" | "unauthorized" | "rate_limited" | "not_found" | "binary";
    };

/** Bring a library note up to date with the file it's linked to. */
export async function syncLibraryItem(
  admin: Admin,
  itemId: string,
  userId: string,
  token: string | undefined,
): Promise<LibrarySyncResult> {
  const { data: item } = await admin
    .from("library_items")
    .select("id, user_id, github_source")
    .eq("id", itemId)
    .maybeSingle();
  if (!item || item.user_id !== userId) return { ok: false, reason: "forbidden" };
  const source = parseGithubSource(item.github_source);
  if (!source) return { ok: false, reason: "not_linked" };

  const result = await fetchRepoFile(source.repo, source.path, source.branch ?? undefined, token);
  if (result.unauthorized) return { ok: false, reason: "unauthorized" };
  if (result.rateLimited) return { ok: false, reason: "rate_limited" };
  if (result.notFound) return { ok: false, reason: "not_found" };
  if (!result.text) return { ok: false, reason: "binary" };
  if (source.sha && result.sha === source.sha) return { ok: true, updated: false, source };

  const synced: GithubSource = { ...source, synced_at: new Date().toISOString(), sha: result.sha };
  const { error } = await admin
    .from("library_items")
    .update({ content: result.text, content_format: "markdown", github_source: synced })
    .eq("id", itemId);
  if (error) throw error;
  return { ok: true, updated: true, source: synced };
}

/** The daily job: every linked repo (oldest first, capped) and every crew. */
export async function refreshAllGithub(admin: Admin): Promise<RefreshSummary> {
  const repos = await refreshRepoSnapshots(admin, { max: 200 });
  let teams = 0;
  if (!repos.rateLimited) {
    const { data } = await admin
      .from("teams")
      .select("id, social_links")
      .not("social_links->>github", "is", null);
    for (const team of (data ?? []) as Array<{
      id: string;
      social_links: Record<string, string> | null;
    }>) {
      if (await refreshTeamSnapshot(admin, team)) teams += 1;
    }
  }
  return { ...repos, teams };
}
