// ── GitHub connection ─────────────────────────────────────────────────────────
// One place for "is this member connected to GitHub, and as whom". Every
// GitHub surface (Settings → GitHub, the status chip on Edit profile, the
// project dialog's inline connect, README import, the GitHub block) reads it
// from here so they always agree.
//
// The connection is a `connected_accounts` row (provider "github") holding the
// public username. An optional personal token lives server-side only
// (user_github_tokens, see github-server.ts) and never reaches the browser.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/use-current-user";
import { friendlyError } from "@/lib/error-message";
import { hasGithubToken } from "@/lib/github-server";

export type ConnectedAccount = {
  id: string;
  provider: string;
  username: string | null;
  created_at: string;
};

/** Where GitHub is managed: Settings → GitHub. */
export const GITHUB_SETTINGS = { to: "/settings", hash: "github" } as const;

/**
 * Normalize whatever the member pasted (a bare handle, `@handle`,
 * `https://github.com/handle`, or `owner/repo`) down to just the handle, so
 * the stored value and the rendered link never double-prefix `github.com/`.
 */
export function githubHandleFrom(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withoutProtocol = trimmed.replace(/^https?:\/\/github\.com\//i, "");
  const firstSegment = withoutProtocol.split("/")[0];
  return firstSegment.replace(/^@/, "").replace(/[\s]+/g, "");
}

export function useConnectedAccounts() {
  const { data: user } = useAuthUser();
  return useQuery({
    queryKey: ["connected-accounts"],
    // `connected_accounts` is auth-only (RLS `TO authenticated`). Gate on the
    // signed-in user so the query never fires anonymously during SSR or before
    // the session is loaded — otherwise PostgREST returns 403.
    enabled: !!user,
    queryFn: async (): Promise<ConnectedAccount[]> => {
      const { data, error } = await supabase
        .from("connected_accounts")
        .select("id, provider, username, created_at");
      if (error) throw error;
      return (data ?? []) as ConnectedAccount[];
    },
  });
}

/** Whether the signed-in member has stored a personal GitHub token. */
export function useGithubTokenStatus() {
  const { data: user } = useAuthUser();
  return useQuery({
    queryKey: ["github-token-status"],
    queryFn: () => hasGithubToken(),
    enabled: !!user,
    staleTime: 60_000,
  });
}

/** The member's GitHub connection in one read. */
export function useGithubConnection() {
  const accounts = useConnectedAccounts();
  const token = useGithubTokenStatus();
  const account = (accounts.data ?? []).find((a) => a.provider === "github");
  const username = account?.username ? githubHandleFrom(account.username) : null;
  return {
    username,
    connected: !!username,
    tokenSet: token.data === true,
    isLoading: accounts.isLoading,
  };
}

/**
 * Remember whether GitHub may be connected automatically from a GitHub
 * sign-in (user metadata, so it follows the member across devices). Turned
 * off by Disconnect, so a GitHub sign-in never reconnects someone who chose
 * not to be. Best-effort: a failure only means the default applies.
 */
async function rememberAutoConnect(allowed: boolean) {
  try {
    await supabase.auth.updateUser({ data: { github_autoconnect: allowed } });
  } catch {
    /* not critical */
  }
}

export function useConnectGitHub({ silent = false }: { silent?: boolean } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (username: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const handle = githubHandleFrom(username);
      if (!handle) throw new Error("Enter a GitHub username");
      const { data, error } = await supabase
        .from("connected_accounts")
        .upsert(
          {
            user_id: user.id,
            provider: "github",
            username: handle,
            provider_id: handle,
          },
          { onConflict: "user_id,provider" },
        )
        // connected_accounts contains server-only access_token/metadata columns;
        // request only the safe representation after the upsert.
        .select("id, provider, username, created_at")
        .single();
      if (error) throw error;

      // Mirror the GitHub link into the profile's social links so the "Links"
      // card and the public profile show it without a separate edit.
      const { data: profile } = await supabase
        .from("profiles")
        .select("social_links")
        .eq("id", user.id)
        .maybeSingle();
      const social = (profile?.social_links as Record<string, string> | null) ?? {};
      social.github = `https://github.com/${handle}`;
      await supabase.from("profiles").update({ social_links: social }).eq("id", user.id);
      if (!silent && user.user_metadata?.github_autoconnect === false) {
        await rememberAutoConnect(true);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connected-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      if (!silent) toast.success("GitHub account connected");
    },
    onError: (error: Error) => {
      if (!silent) toast.error(friendlyError(error));
    },
  });
}

export function useDisconnectGitHub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("connected_accounts").delete().eq("provider", "github");
      if (error) throw error;
      if (user) {
        // Remove the mirrored GitHub link from the profile's social links.
        const { data: profile } = await supabase
          .from("profiles")
          .select("social_links")
          .eq("id", user.id)
          .maybeSingle();
        const social = (profile?.social_links as Record<string, string> | null) ?? {};
        if (social.github) {
          delete social.github;
          await supabase.from("profiles").update({ social_links: social }).eq("id", user.id);
        }
        await rememberAutoConnect(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connected-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("GitHub account disconnected");
    },
  });
}

/** The GitHub username from a GitHub sign-in or linked identity, if any. */
export function githubIdentityHandle(
  user: {
    identities?: Array<{ provider: string; identity_data?: Record<string, unknown> }> | null;
  } | null,
): string | null {
  const identity = user?.identities?.find((i) => i.provider === "github");
  const data = identity?.identity_data ?? {};
  const handle = data.user_name ?? data.preferred_username;
  return typeof handle === "string" && handle.trim() ? githubHandleFrom(handle) : null;
}
