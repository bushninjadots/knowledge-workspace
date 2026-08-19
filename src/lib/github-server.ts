// Server-side GitHub token management + proxied GitHub fetches.
//
// The token lives in `user_github_tokens` (no client RLS access) and only ever
// touches GitHub from this server — it is never sent to the browser. Client
// components import these server functions directly; TanStack Start generates
// the RPC boundary.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  fetchRepoMeta,
  fetchRepoReadme,
  fetchUserRepos,
  validateGitHubToken,
  type GithubRepoLite,
  type RepoMeta,
  type RepoReadmeResult,
} from "./github";

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
