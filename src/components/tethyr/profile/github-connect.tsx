import { useState } from "react";
import { Github, ExternalLink, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const sb = supabase as any;

type ConnectedAccount = {
  id: string;
  provider: string;
  username: string | null;
  created_at: string;
};

export function useConnectedAccounts() {
  return useQuery({
    queryKey: ["connected-accounts"],
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
      // Store the GitHub username as a connected account
      const { data, error } = await sb
        .from("connected_accounts")
        .upsert(
          {
            provider: "github",
            username: username.trim(),
            provider_id: username.trim(),
          },
          { onConflict: "user_id,provider" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connected-accounts"] });
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
      const { error } = await sb
        .from("connected_accounts")
        .delete()
        .eq("provider", "github");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connected-accounts"] });
      toast.success("GitHub account disconnected");
    },
  });
}

export function GitHubConnect() {
  const { data: accounts = [], isLoading } = useConnectedAccounts();
  const connectGitHub = useConnectGitHub();
  const disconnectGitHub = useDisconnectGitHub();
  const [username, setUsername] = useState("");
  const [editing, setEditing] = useState(false);

  const githubAccount = accounts.find((a) => a.provider === "github");

  if (isLoading) {
    return (
      <div className="rounded-xl border card-border bg-surface p-4 sm:p-5">
        <div className="h-16 animate-pulse rounded-lg bg-surface/60" />
      </div>
    );
  }

  if (githubAccount) {
    return (
      <div className="rounded-xl border card-border bg-surface p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#24292e] text-white">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">GitHub connected</h3>
              <p className="text-xs text-muted-foreground">
                <a
                  href={`https://github.com/${githubAccount.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                >
                  @{githubAccount.username}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => disconnectGitHub.mutate()}
            disabled={disconnectGitHub.isPending}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="rounded-xl border border-dashed border-border/40 bg-surface/30 p-4 sm:p-5">
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
    <div className="rounded-xl border card-border bg-surface p-4 sm:p-5">
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">GitHub username</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your-username"
            onKeyDown={(e) => {
              if (e.key === "Enter" && username.trim()) {
                connectGitHub.mutate(username, { onSuccess: () => setEditing(false) });
              }
            }}
          />
        </div>
        <Button
          size="sm"
          onClick={() => connectGitHub.mutate(username, { onSuccess: () => setEditing(false) })}
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
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
