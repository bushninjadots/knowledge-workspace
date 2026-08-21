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
  fetchRepoFile,
  fetchRepoMeta,
  fetchRepoReadme,
  fetchUserRepos,
  validateGitHubToken,
  type GithubCommitLite,
  type GithubRepoLite,
  type RepoFileResult,
  type RepoMeta,
  type RepoReadmeResult,
} from "./github";
import { parseGithubSource, type GithubSource } from "./github-source";

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
    return fetchUserRepos(data.username);
  });

/** Fetch a repo README on the server, using the stored token when present. */
export const fetchRepoReadmeServer = createServerFn({ method: "POST" })
  .validator((d: { fullName: string }) => ({ fullName: d.fullName.trim() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }): Promise<RepoReadmeResult> => {
    const token = await getStoredToken(context.userId);
    return fetchRepoReadme(data.fullName, token ?? undefined);
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

    const token = await getStoredToken(context.userId);
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
    const token = await getStoredToken(context.userId);
    return fetchRepoMeta(data.owner, data.repo, token ?? undefined);
  });

/** Fetch an arbitrary repo file on the server, using the stored token when present. */
export const fetchRepoFileServer = createServerFn({ method: "POST" })
  .validator((d: { fullName: string; path: string; ref?: string }) => ({
    fullName: d.fullName.trim(),
    path: d.path.replace(/^\/+/, "").trim(),
    ref: d.ref?.trim() || undefined,
  }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }): Promise<RepoFileResult> => {
    const token = await getStoredToken(context.userId);
    return fetchRepoFile(data.fullName, data.path, data.ref, token ?? undefined);
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

export type SyncResult =
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
    const { data: item } = await supabaseAdmin
      .from("library_items")
      .select("id, user_id, github_source")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item || item.user_id !== context.userId) return { ok: false, reason: "forbidden" };
    const source = parseGithubSource(item.github_source);
    if (!source) return { ok: false, reason: "not_linked" };

    const token = await getStoredToken(context.userId);
    const result = await fetchRepoFile(
      source.repo,
      source.path,
      source.branch ?? undefined,
      token ?? undefined,
    );
    if (result.unauthorized) return { ok: false, reason: "unauthorized" };
    if (result.rateLimited) return { ok: false, reason: "rate_limited" };
    if (result.notFound) return { ok: false, reason: "not_found" };
    if (!result.text) return { ok: false, reason: "binary" };
    if (source.sha && result.sha === source.sha) return { ok: true, updated: false, source };

    const synced: GithubSource = {
      ...source,
      synced_at: new Date().toISOString(),
      sha: result.sha,
    };
    const { error } = await supabaseAdmin
      .from("library_items")
      .update({ content: result.text, content_format: "markdown", github_source: synced })
      .eq("id", data.itemId);
    if (error) throw error;
    return { ok: true, updated: true, source: synced };
  });
