// Server-side GitHub token management + proxied GitHub fetches.
//
// The token lives in `user_github_tokens` (no client RLS access) and only ever
// touches GitHub from this server — it is never sent to the browser. Client
// components import these server functions directly; TanStack Start generates
// the RPC boundary.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  fetchRepoCommits,
  fetchRepoCommitActivity,
  fetchRepoMeta,
  fetchRepoReadme,
  absolutizeRelativeLinks,
  fetchUserRepos,
  validateGitHubToken,
  type GithubCommitLite,
  type GithubRepoLite,
  type RepoMeta,
  type RepoReadmeResult,
  type CommitActivityResult,
} from "./github";
import type { GithubSource } from "./github-source";
import { publicGithubToken, type RefreshSummary } from "./github-refresh";

async function getStoredToken(userId: string): Promise<string | null> {
  // Dynamic import keeps the service-role client out of the client bundle.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_github_tokens")
    .select("token")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.token ?? null;
}

const publicToken = publicGithubToken;

/** The token for a request about a named repo: the member's own, else the
 *  public one, else none. */
async function repoToken(userId: string): Promise<string | undefined> {
  return (await getStoredToken(userId)) ?? publicToken();
}

/** Validate the token against GitHub, then store it for the signed-in user. */
export const saveGithubToken = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => ({ token: d.token.trim() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    if (!data.token) return { ok: false as const, reason: "empty" as const };
    const validation = await validateGitHubToken(data.token);
    if (!validation.ok) return validation;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_github_tokens")
      .upsert(
        { user_id: context.userId, token: data.token, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) return { ok: false as const, reason: "storage" as const };
    return { ok: true as const, username: validation.username };
  });

export const removeGithubToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_github_tokens")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true as const };
  });

/** Whether the signed-in user has a stored token. */
export const hasGithubToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_github_tokens")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    return !!data;
  });

/**
 * The signed-in user's connected GitHub username, if any.
 */
export const getConnectedGithubUsername = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("connected_accounts")
      .select("username")
      .eq("user_id", context.userId)
      .eq("provider", "github")
      .maybeSingle();
    return (data?.username as string) ?? null;
  });

/**
 * List repos the signed-in user can link to a project. Uses the stored token
 * when present (includes private repos); otherwise falls back to the public
 * repo list for their connected username.
 */
export const listGithubRepos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GithubRepoLite[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = await getStoredToken(context.userId);
    if (token) return fetchUserRepos("", token);
    const { data } = await supabaseAdmin
      .from("connected_accounts")
      .select("username")
      .eq("user_id", context.userId)
      .eq("provider", "github")
      .maybeSingle();
    if (!data?.username) return [];
    return fetchUserRepos(data.username, undefined, publicToken());
  });

/** Fetch a repo README on the server, using the stored token when present. */
export const fetchRepoReadmeServer = createServerFn({ method: "POST" })
  .validator((d: { fullName: string }) => ({ fullName: d.fullName.trim() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }): Promise<RepoReadmeResult> => {
    return fetchRepoReadme(data.fullName, await repoToken(context.userId));
  });

/**
 * Pull recent GitHub commits into the project's public evidence timeline.
 * This is owner-authenticated, idempotent by commit SHA, and never exposes
 * the stored token to the client. A commit is evidence of repository activity,
 * not a replacement for a human-written project update.
 */
export const syncGithubProjectActivity = createServerFn({ method: "POST" })
  .validator((d: { projectId: string }) => ({ projectId: d.projectId.trim() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, profile_id, title")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project || project.profile_id !== context.userId) {
      throw new Error("Only the project owner can sync GitHub activity");
    }

    const { data: repos } = await supabaseAdmin
      .from("project_repositories")
      .select("id, url, provider, metadata")
      .eq("project_id", data.projectId)
      .eq("provider", "github")
      .limit(5);
    if (!repos?.length) return { added: 0, checked: 0 };

    const token = await repoToken(context.userId);
    let checked = 0;
    let added = 0;
    for (const repo of repos) {
      const fullName =
        (repo.metadata as { full_name?: string } | null)?.full_name ??
        repo.url
          .replace(/^https?:\/\/(www\.)?github\.com\//, "")
          .replace(/\/$/, "")
          .replace(/\.git$/, "");
      const commits: GithubCommitLite[] = await fetchRepoCommits(fullName, token ?? undefined);
      checked += commits.length;
      const { data: existing } = await supabaseAdmin
        .from("project_activity")
        .select("metadata")
        .eq("project_id", data.projectId)
        .eq("kind", "github_commit")
        .limit(100);
      const existingShas = new Set(
        (existing ?? [])
          .map((row) => (row.metadata as { external_id?: string } | null)?.external_id)
          .filter((sha): sha is string => !!sha),
      );
      const fresh = commits.filter((commit) => !existingShas.has(commit.sha));
      if (!fresh.length) continue;
      const { error } = await supabaseAdmin.from("project_activity").insert(
        fresh.map((commit) => ({
          project_id: data.projectId,
          // The commit may belong to a GitHub contributor who has not linked
          // that identity to Tethyr. Keep the event unattributed locally and
          // render the external author from metadata instead of crediting the
          // project owner by accident.
          actor_id: null,
          kind: "github_commit",
          title: commit.message,
          body: `Commit ${commit.sha.slice(0, 7)} by ${commit.author_login ?? commit.author_name ?? "a repository contributor"}.`,
          metadata: {
            external_id: commit.sha,
            provider: "github",
            repository: fullName,
            url: commit.html_url,
            author_login: commit.author_login,
            author_name: commit.author_name,
          },
          created_at: commit.committed_at,
        })),
      );
      if (!error) added += fresh.length;
    }
    return { added, checked };
  });

/** Fetch repo metadata on the server, using the stored token when present. */
export const fetchRepoMetaServer = createServerFn({ method: "POST" })
  .validator((d: { owner: string; repo: string }) => ({
    owner: d.owner.trim(),
    repo: d.repo.trim(),
  }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }): Promise<RepoMeta | null> => {
    return fetchRepoMeta(data.owner, data.repo, await repoToken(context.userId));
  });

/**
 * Fetch a repo's 52-week commit activity (contribution graph data) on the
 * server, using the stored token when present. Pending (202) responses are
 * surfaced so the client can keep its cached weeks rather than store empty
 * ones while GitHub computes the stats.
 */
export const fetchRepoCommitActivityServer = createServerFn({ method: "POST" })
  .validator((d: { fullName: string }) => ({ fullName: d.fullName.trim() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }): Promise<CommitActivityResult> => {
    return fetchRepoCommitActivity(data.fullName, await repoToken(context.userId));
  });

/** Attach (or replace) a GitHub file link on a library item. Owner-only. */
export const linkLibraryItemGithub = createServerFn({ method: "POST" })
  .validator((d: { itemId: string; repo: string; path: string; branch?: string }) => ({
    itemId: d.itemId.trim(),
    repo: d.repo.trim(),
    path: d.path.replace(/^\/+/, "").trim(),
    branch: d.branch?.trim() || null,
  }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item } = await supabaseAdmin
      .from("library_items")
      .select("id, user_id")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item || item.user_id !== context.userId)
      return { ok: false as const, reason: "forbidden" as const };

    const source: GithubSource = {
      repo: data.repo,
      path: data.path,
      branch: data.branch,
      synced_at: null,
      sha: null,
    };
    const { error } = await supabaseAdmin
      .from("library_items")
      .update({ github_source: source })
      .eq("id", data.itemId);
    if (error) throw error;
    return { ok: true as const, source };
  });

/** Remove a GitHub file link without touching the item's content. Owner-only. */
export const unlinkLibraryItemGithub = createServerFn({ method: "POST" })
  .validator((d: { itemId: string }) => ({ itemId: d.itemId.trim() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item } = await supabaseAdmin
      .from("library_items")
      .select("id, user_id")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item || item.user_id !== context.userId)
      return { ok: false as const, reason: "forbidden" as const };

    const { error } = await supabaseAdmin
      .from("library_items")
      .update({ github_source: null })
      .eq("id", data.itemId);
    if (error) throw error;
    return { ok: true as const };
  });

type SyncResult =
  | { ok: true; updated: boolean; source: GithubSource }
  | {
      ok: false;
      reason:
        | "not_linked"
        | "forbidden"
        | "not_found"
        | "rate_limited"
        | "unauthorized"
        | "binary"
        | "network";
    };

/**
 * Pull the linked GitHub file into a library item. Owner-only, manual, and
 * idempotent by blob SHA: syncing an unchanged file leaves content untouched.
 * Pulled content is Markdown by definition of the source format.
 */
export const syncLibraryItemFromGithub = createServerFn({ method: "POST" })
  .validator((d: { itemId: string }) => ({ itemId: d.itemId.trim() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }): Promise<SyncResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncLibraryItem } = await import("./github-refresh");
    return syncLibraryItem(
      supabaseAdmin,
      data.itemId,
      context.userId,
      await repoToken(context.userId),
    );
  });

export type SyncEverythingResult = {
  repos: Omit<RefreshSummary, "teams">;
  notes: { checked: number; updated: number; failed: number };
  teams: { checked: number; refreshed: number };
  /** The profile README against its GitHub source, if it has one. */
  readme: "none" | "up_to_date" | "has_updates" | "unavailable";
};

/**
 * "Sync everything" in Settings → GitHub, for the signed-in member: fresh
 * stats and commit graphs for their projects' repos, their library notes
 * brought up to date with the files they're linked to, and the GitHub repos
 * of crews they lead. Their README is only checked — it's never replaced
 * without them seeing the new version first.
 */
export const syncAllGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SyncEverythingResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { refreshRepoSnapshots, refreshTeamSnapshot, syncLibraryItem } =
      await import("./github-refresh");
    const userId = context.userId;
    const token = await repoToken(userId);

    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("profile_id", userId);
    const repos = await refreshRepoSnapshots(supabaseAdmin, {
      projectIds: (projects ?? []).map((p: { id: string }) => p.id),
      max: 40,
    });

    const notes = { checked: 0, updated: 0, failed: 0 };
    if (!repos.rateLimited) {
      const { data: items } = await supabaseAdmin
        .from("library_items")
        .select("id")
        .eq("user_id", userId)
        .not("github_source", "is", null)
        .limit(40);
      for (const item of (items ?? []) as Array<{ id: string }>) {
        notes.checked += 1;
        const result = await syncLibraryItem(supabaseAdmin, item.id, userId, token);
        if (!result.ok) notes.failed += 1;
        else if (result.updated) notes.updated += 1;
      }
    }

    const teams = { checked: 0, refreshed: 0 };
    const { data: leads } = await supabaseAdmin
      .from("team_members")
      .select("team_id, teams(id, social_links)")
      .eq("profile_id", userId)
      .eq("role", "lead");
    for (const row of (leads ?? []) as unknown as Array<{
      teams: { id: string; social_links: Record<string, string> | null } | null;
    }>) {
      if (!row.teams?.social_links?.github) continue;
      teams.checked += 1;
      if (await refreshTeamSnapshot(supabaseAdmin, row.teams)) teams.refreshed += 1;
    }

    let readme: SyncEverythingResult["readme"] = "none";
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("readme, readme_source")
      .eq("id", userId)
      .maybeSingle();
    const profile = profileRow as unknown as {
      readme: string | null;
      readme_source: { repo?: string } | null;
    } | null;
    const repo = profile?.readme_source?.repo;
    if (repo) {
      const fetched = await fetchRepoReadme(repo, token);
      if (!fetched.text) readme = "unavailable";
      else {
        const text = absolutizeRelativeLinks(fetched.text, repo, "HEAD").trim();
        readme = text === (profile?.readme ?? "").trim() ? "up_to_date" : "has_updates";
      }
    }
    return { repos, notes, teams, readme };
  });

/** Refresh a crew's GitHub repos now (crew leads, after changing the link). */
export const refreshTeamGithub = createServerFn({ method: "POST" })
  .validator((d: { teamId: string }) => ({ teamId: d.teamId.trim() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: membership } = await supabaseAdmin
      .from("team_members")
      .select("role")
      .eq("team_id", data.teamId)
      .eq("profile_id", context.userId)
      .maybeSingle();
    if (membership?.role !== "lead") return { ok: false as const, reason: "forbidden" as const };
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id, social_links")
      .eq("id", data.teamId)
      .maybeSingle();
    if (!team) return { ok: false as const, reason: "forbidden" as const };
    const { refreshTeamSnapshot } = await import("./github-refresh");
    const ok = await refreshTeamSnapshot(
      supabaseAdmin,
      team as unknown as { id: string; social_links: Record<string, string> | null },
    );
    return ok ? { ok: true as const } : { ok: false as const, reason: "unavailable" as const };
  });
