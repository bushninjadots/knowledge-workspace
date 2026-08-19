import { useState } from "react";
import { Github, ExternalLink, Check, Loader2, KeyRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { hasGithubToken, saveGithubToken, removeGithubToken } from "@/lib/github-server";
import { githubTokenErrorMessage } from "@/lib/github";

const sb = supabase;

type ConnectedAccount = {
  id: string;
  provider: string;
  username: string | null;
  created_at: string;
};

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
      const { data, error } = await sb
        .from("connected_accounts")
        .select("id, provider, username, created_at");
      if (error) throw error;
      return (data ?? []) as ConnectedAccount[];
    },
  });
}

export function useConnectGitHub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (username: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const handle = githubHandleFrom(username);
      if (!handle) throw new Error("Enter a GitHub username");
      // Store the GitHub username as a connected account
      const { data, error } = await sb
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
        .select()
        .single();
      if (error) throw error;

      // Mirror the GitHub link into the profile's social links so the "Links"
      // card and the public profile show it without a separate edit.
      const { data: profile } = await sb
        .from("profiles")
        .select("social_links")
        .eq("id", user.id)
        .maybeSingle();
      const social = (profile?.social_links as Record<string, string> | null) ?? {};
      social.github = `https://github.com/${handle}`;
      await sb.from("profiles").update({ social_links: social }).eq("id", user.id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connected-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("GitHub account connected");
    },
    onError: (error: Error) => {
      toast.error(error.message);
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
      const { error } = await sb.from("connected_accounts").delete().eq("provider", "github");
      if (error) throw error;
      if (user) {
        // Remove the mirrored GitHub link from the profile's social links.
        const { data: profile } = await sb
          .from("profiles")
          .select("social_links")
          .eq("id", user.id)
          .maybeSingle();
        const social = (profile?.social_links as Record<string, string> | null) ?? {};
        if (social.github) {
          delete social.github;
          await sb.from("profiles").update({ social_links: social }).eq("id", user.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connected-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("GitHub account disconnected");
    },
  });
}

/** Where to create a fine-grained, read-only token on GitHub. */
const GITHUB_TOKEN_URL = "https://github.com/settings/personal-access-tokens/new";

/** One shared explainer so every entry point says the same thing. */
function TokenHelper() {
  return (
    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
      Create one at{" "}
      <a
        href={GITHUB_TOKEN_URL}
        target="_blank"
        rel="noreferrer"
        className="text-primary hover:underline"
      >
        github.com/settings/personal-access-tokens/new
      </a>{" "}
      — pick <strong>Fine-grained</strong>, choose <strong>read-only</strong> access to the repos
      you use here (Contents + Metadata), then paste it above. Stored securely on Tethyr&apos;s
      server — it never reaches your browser, and one entry covers your profile plus every
      project&apos;s repo &amp; README flows.
    </p>
  );
}

export function GitHubConnect({ autoOpenToken = false }: { autoOpenToken?: boolean }) {
  const queryClient = useQueryClient();
  const { data: accounts = [], isLoading } = useConnectedAccounts();
  const connectGitHub = useConnectGitHub();
  const disconnectGitHub = useDisconnectGitHub();
  const [username, setUsername] = useState("");
  const [editing, setEditing] = useState(false);
  const [tokenDraft, setTokenDraft] = useState("");
  const [tokenEditing, setTokenEditing] = useState(autoOpenToken);
  const [savingToken, setSavingToken] = useState(false);

  const { data: tokenSet = false } = useQuery({
    queryKey: ["github-token-status"],
    queryFn: () => hasGithubToken(),
    staleTime: 60_000,
  });

  const githubAccount = accounts.find((a) => a.provider === "github");

  const saveToken = async () => {
    if (!tokenDraft.trim()) {
      toast.error("Enter a GitHub token to save it");
      return;
    }
    setSavingToken(true);
    try {
      const res = await saveGithubToken({ data: { token: tokenDraft } });
      if (res.ok) {
        setTokenDraft("");
        setTokenEditing(false);
        queryClient.invalidateQueries({ queryKey: ["github-token-status"] });
        toast.success(`GitHub token saved — authenticated as @${res.username}`);
      } else {
        toast.error(githubTokenErrorMessage(res.reason));
      }
    } catch (err) {
      toast.error((err as Error)?.message ?? "Couldn't save the token — try again");
    } finally {
      setSavingToken(false);
    }
  };

  const removeToken = () => {
    removeGithubToken()
      .then(() => {
        setTokenDraft("");
        setTokenEditing(false);
        queryClient.invalidateQueries({ queryKey: ["github-token-status"] });
        toast.success("GitHub token removed");
      })
      .catch(() => toast.error("Couldn't remove the token — try again"));
  };

  const handleConnect = async (usernameToConnect: string) => {
    // Validate + store the token first so we never connect the account with a
    // broken token (the token stays server-side, never touches the browser).
    if (tokenDraft.trim()) {
      const res = await saveGithubToken({ data: { token: tokenDraft } });
      if (!res.ok) {
        toast.error(githubTokenErrorMessage(res.reason));
        return;
      }
      setTokenDraft("");
    }
    connectGitHub.mutate(usernameToConnect, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["github-token-status"] });
        setEditing(false);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
        <div className="h-16 animate-pulse rounded-lg bg-surface/60" />
      </div>
    );
  }

  if (githubAccount) {
    return (
      <div id="github-integration" className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#24292e] text-white">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">GitHub connected</h3>
              <p className="text-xs text-muted-foreground">
                <a
                  href={`https://github.com/${githubHandleFrom(githubAccount.username ?? "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                >
                  @{githubHandleFrom(githubAccount.username ?? "")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              disconnectGitHub.mutate(undefined, {
                onSuccess: () => {
                  removeGithubToken()
                    .then(() => {
                      queryClient.invalidateQueries({ queryKey: ["github-token-status"] });
                      setTokenEditing(false);
                    })
                    .catch(() => {
                      /* token cleanup is best-effort on disconnect */
                    });
                },
              })
            }
            disabled={disconnectGitHub.isPending}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Disconnect
          </Button>
        </div>

        {/* Shared token row — one entry covers profile + all project repo/README flows */}
        <div className="mt-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-medium">GitHub token</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {tokenSet
                    ? "Set — powers private repos & README pulls on your projects"
                    : "Optional — enables private repos and lifts rate limits"}
                </p>
              </div>
            </div>
            {!tokenEditing &&
              (tokenSet ? (
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={() => setTokenEditing(true)}
                    className="text-xs text-muted-foreground transition hover:text-primary"
                  >
                    Update
                  </button>
                  <button
                    onClick={removeToken}
                    className="text-xs text-muted-foreground transition hover:text-destructive"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setTokenEditing(true)}
                  className="shrink-0 text-xs font-medium text-primary transition hover:opacity-80"
                >
                  Add token
                </button>
              ))}
          </div>
          {tokenEditing && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  value={tokenDraft}
                  onChange={(e) => setTokenDraft(e.target.value)}
                  placeholder="ghp_…"
                  autoComplete="off"
                  className="h-8 flex-1 border-border/60 text-xs"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={saveToken}
                  disabled={savingToken}
                >
                  {savingToken ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-3 w-3" />
                  )}
                  Save
                </Button>
                <button
                  onClick={() => {
                    setTokenEditing(false);
                    setTokenDraft("");
                  }}
                  className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
                  aria-label="Cancel token edit"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>{" "}
              <TokenHelper />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!editing) {
    return (
      <div
        id="github-integration"
        className="rounded-xl border border-dashed border-border/40 bg-surface/30 p-4 sm:p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-elevated">
              <Github className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Connect GitHub</h3>
              <p className="text-xs text-muted-foreground">
                Show your repositories on projects and pull live stats.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Connect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div id="github-integration" className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">GitHub username</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your-username"
            onKeyDown={(e) => {
              if (e.key === "Enter" && username.trim()) handleConnect(username);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            GitHub token <span className="font-normal text-muted-foreground/60">(optional)</span>
          </label>
          <Input
            type="password"
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            placeholder="ghp_… — enables private repos & README pulls"
            autoComplete="off"
          />{" "}
          <TokenHelper />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => handleConnect(username)}
            disabled={!username.trim() || connectGitHub.isPending}
          >
            {connectGitHub.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="mr-1 h-3.5 w-3.5" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
