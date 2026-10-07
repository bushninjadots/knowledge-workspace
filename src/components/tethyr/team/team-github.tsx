// ── A crew on GitHub ──────────────────────────────────────────────────────────
// The crew's GitHub organisation (from its GitHub link), shown from the
// snapshot cached on the crew (teams.github_snapshot) — refreshed daily, when
// a lead changes the link, or from "Sync from GitHub" — so visiting a crew
// never calls GitHub. Repos link to GitHub by name only.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Github, Star } from "lucide-react";
import { toast } from "sonner";
import { GitHubSyncButton, syncedAgo } from "@/components/tethyr/github/github-sync-button";
import type { TeamRow } from "@/hooks/use-teams";
import { refreshTeamGithub } from "@/lib/github-server";
import { languageColor } from "@/lib/language-colors";

const SAFE_NAME = /^[\w.-]+\/[\w.-]+$/;

/** Refresh a crew's GitHub repos now; resolves whether it worked. */
export async function refreshCrewGithub(teamId: string): Promise<boolean> {
  try {
    const result = await refreshTeamGithub({ data: { teamId } });
    return result.ok;
  } catch {
    return false;
  }
}

export function TeamGitHub({ team, isLead }: { team: TeamRow; isLead: boolean }) {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const snapshot = team.github_snapshot;
  const repos = (snapshot?.repos ?? []).filter((repo) => SAFE_NAME.test(repo.full_name));
  const hasLink = !!team.social_links?.github;

  if (!hasLink || (repos.length === 0 && !isLead)) return null;

  const sync = async () => {
    setSyncing(true);
    const ok = await refreshCrewGithub(team.id);
    setSyncing(false);
    await queryClient.invalidateQueries({ queryKey: ["team"] });
    if (ok) toast.success("Crew repositories synced from GitHub");
    else toast.error("Couldn't read that GitHub organisation — check the crew's GitHub link");
  };

  return (
    <section aria-labelledby="crew-github" className="mb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="crew-github"
          className="flex items-center gap-2 text-sm font-semibold text-foreground/80"
        >
          <Github className="h-4 w-4 text-muted-foreground" aria-hidden />
          On GitHub
          {snapshot?.org && (
            <a
              href={`https://github.com/${snapshot.org}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-normal text-muted-foreground hover:text-foreground"
            >
              @{snapshot.org}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </h2>
        {isLead && (
          <GitHubSyncButton
            synced={!!snapshot}
            syncedAt={snapshot?.synced_at}
            busy={syncing}
            onClick={sync}
            className="h-7 text-xs"
          />
        )}
      </div>
      {repos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {snapshot
            ? "No public repositories in this organisation yet."
            : "Bring in the crew's public repositories from its GitHub link."}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <li
              key={repo.full_name}
              className="flex min-w-0 flex-col gap-1.5 rounded-xl bg-surface-elevated/30 p-4"
            >
              <a
                href={`https://github.com/${repo.full_name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-mono text-sm font-medium text-foreground hover:underline"
              >
                {repo.full_name.split("/")[1]}
              </a>
              {repo.description && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{repo.description}</p>
              )}
              <span className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
                {repo.language && (
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: languageColor(repo.language) ?? "var(--muted-foreground)",
                      }}
                      aria-hidden
                    />
                    {repo.language}
                  </span>
                )}
                {repo.stargazers_count > 0 && (
                  <span className="inline-flex items-center gap-0.5 tabular-nums">
                    <Star className="h-3 w-3" aria-hidden />
                    {repo.stargazers_count.toLocaleString()}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {isLead && snapshot && (
        <p className="mt-2 text-2xs text-muted-foreground">
          Refreshed daily
          {syncedAgo(snapshot.synced_at) ? ` · ${syncedAgo(snapshot.synced_at)}` : ""}.
        </p>
      )}
    </section>
  );
}
