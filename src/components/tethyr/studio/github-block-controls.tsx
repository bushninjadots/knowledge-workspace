// The GitHub block's own section in the Studio inspector: which account it
// reads, when it last synced (with Sync now), and — for "Choose them myself"
// — a picker over the account's public repos. The rest of the block's
// settings (repo source, count, which parts show) are ordinary block fields.
import { Link } from "@tanstack/react-router";
import { Check, Github, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConnectedAccounts } from "@/hooks/use-github";
import { useGithubProfile, useSyncGithubProfile } from "@/hooks/use-github-profile";
import type { BlockConfig } from "@/lib/page-blocks";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

const MAX_CHOSEN = 8;

const SYNC_MESSAGE: Record<string, string> = {
  synced: "GitHub synced",
  not_connected: "Connect GitHub in Settings first",
  not_found: "GitHub couldn't find that account — check the username in Settings",
  rate_limited: "GitHub is limiting requests — try again in a few minutes",
  failed: "Couldn't reach GitHub — try again shortly",
};

export function GitHubBlockControls({
  userId,
  config,
  onChange,
}: {
  userId: string;
  config: BlockConfig;
  onChange: (config: BlockConfig) => void;
}) {
  const { data: accounts } = useConnectedAccounts();
  const account = (accounts ?? []).find((a) => a.provider === "github");
  const { data: row } = useGithubProfile(userId);
  const sync = useSyncGithubProfile();
  const chosen = Array.isArray(config.repos) ? (config.repos as string[]) : [];
  const choosing = config.repoSource === "chosen";

  function toggleRepo(name: string) {
    const next = chosen.includes(name)
      ? chosen.filter((n) => n !== name)
      : [...chosen, name].slice(0, MAX_CHOSEN);
    onChange({ ...config, repos: next });
  }

  return (
    <section className="border-b border-border py-3">
      <h3 className="t-label mb-2.5">GitHub account</h3>
      {account ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Github className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-xs font-medium">@{account.username}</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-2xs"
              busy={sync.isPending}
              onClick={() =>
                sync.mutate(undefined, {
                  onSuccess: (result) =>
                    result === "synced"
                      ? toast.success(SYNC_MESSAGE.synced)
                      : toast.error(SYNC_MESSAGE[result] ?? SYNC_MESSAGE.failed),
                  onError: () => toast.error(SYNC_MESSAGE.failed),
                })
              }
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              Sync now
            </Button>
          </div>
          <p className="text-2xs text-muted-foreground">
            {row ? `Synced ${timeAgo(row.synced_at)}` : "Not synced yet"} · public data only ·{" "}
            {row?.snapshot.contributions
              ? "with your contribution graph"
              : "add a token in Settings for your contribution graph and pinned repos"}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Not connected.{" "}
          <Link to="/settings" hash="github" className="font-medium text-foreground underline">
            Connect GitHub
          </Link>{" "}
          to fill this block.
        </p>
      )}

      {choosing && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-foreground">
            Repos to show{" "}
            <span className="font-normal text-muted-foreground">
              ({chosen.length}/{MAX_CHOSEN}, in the order you pick)
            </span>
          </p>
          {row?.snapshot.repos.length ? (
            <ul className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
              {row.snapshot.repos.map((repo) => {
                const on = chosen.includes(repo.full_name);
                return (
                  <li key={repo.full_name}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      disabled={!on && chosen.length >= MAX_CHOSEN}
                      onClick={() => toggleRepo(repo.full_name)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-xs outline-none hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] disabled:opacity-40",
                        on && "font-medium",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border",
                          on
                            ? "border-transparent bg-[var(--user-accent,var(--primary))] text-[var(--user-accent-foreground,var(--primary-foreground))]"
                            : "border-border",
                        )}
                        aria-hidden
                      >
                        {on && <Check className="h-2.5 w-2.5" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{repo.name}</span>
                      {on && (
                        <span className="text-2xs tabular-nums text-muted-foreground">
                          {chosen.indexOf(repo.full_name) + 1}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-2xs text-muted-foreground">
              No public repos yet — sync once your account has some.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
