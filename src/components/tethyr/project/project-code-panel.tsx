import { useState } from "react";
import { Link2, Lock, Plus, RefreshCw, Settings2 } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { languageColor } from "@/lib/language-colors";
import { getRepoFullName } from "@/lib/github";
import { fetchProjectReadmeSource, readmeSourceMessage } from "@/lib/project-readme-source";
import { useUpdateProjectReadme } from "@/hooks/use-projects";
import { useRefreshRepoMetadata } from "@/hooks/use-project-repos";
import type { ProjectRepo } from "@/hooks/use-project-repos";

type ProjectCodePanelProps = {
  project: { id: string; readme?: string | null };
  repos: ProjectRepo[] | undefined;
  isOwner: boolean;
  className?: string;
  onLinkRepo?: () => void;
};

/**
 * Compact GitHub surface for the project page: primary repo, key stats, topics,
 * and a one-click "Sync from GitHub" for owners (README + cached stats in one
 * action). On desktop it lives in the sticky rail beside the README; on mobile
 * it renders as a full-width band below it.
 */
export function ProjectCodePanel({
  project,
  repos,
  isOwner,
  className,
  onLinkRepo,
}: ProjectCodePanelProps) {
  const updateReadme = useUpdateProjectReadme();
  const refreshMeta = useRefreshRepoMetadata();
  const [syncing, setSyncing] = useState(false);

  const primary = repos?.[0];
  const secondary = repos?.slice(1, 4) ?? [];

  // One click pulls both faces of the repo: the README (with relative links
  // absolutized against the real default branch) and the cached metadata
  // snapshot (stars, language, topics, pushed-at) the panel itself renders.
  // The metadata refresh merges over the last good snapshot, so a failed meta
  // fetch never wipes stats; the README only saves when it actually changed.
  const syncFromGithub = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      if (primary) {
        refreshMeta.mutate({
          id: primary.id,
          project_id: primary.project_id,
          url: primary.url,
          provider: primary.provider,
          metadata: primary.metadata,
        });
      }
      const result = await fetchProjectReadmeSource(primary);
      if (!result.ok) {
        toast.error(readmeSourceMessage(result.reason));
        return;
      }
      if (result.text === project.readme) {
        toast.success("Already up to date — README and stats refreshed from GitHub");
        return;
      }
      await updateReadme.mutateAsync({ projectId: project.id, readme: result.text });
      toast.success("Synced from GitHub — README and stats updated");
    } finally {
      setSyncing(false);
    }
  };

  const meta = primary?.metadata ?? {};
  const language = meta.language ?? null;
  const langDot = languageColor(language);
  const lastPush = meta.updated_at ? formatDistanceToNowStrict(new Date(meta.updated_at)) : null;

  return (
    <section aria-label="Code" className={cn("space-y-3", className)}>
      <h3 className="section-label flex items-center gap-1.5">
        <Link2 className="h-3 w-3 text-muted-foreground" />
        Code
      </h3>

      {!primary || !getRepoFullName(primary) ? (
        <div className="space-y-2.5">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {isOwner
              ? "Link a GitHub repository to show your code source and let visitors pull your README."
              : "The team hasn't linked a source repository yet."}
          </p>
          {isOwner && (
            <button
              type="button"
              onClick={onLinkRepo}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-[12px] font-medium text-foreground transition-lift hover:bg-surface-elevated"
            >
              <Plus className="h-3 w-3" />
              Link repository
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <a
              href={`https://github.com/${meta.full_name ?? getRepoFullName(primary)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 truncate font-mono text-[13px] font-medium text-foreground transition-colors hover:text-learning"
            >
              {meta.full_name ?? getRepoFullName(primary)}
            </a>
            {meta.private === true && (
              <Lock
                className="h-3 w-3 shrink-0 text-muted-foreground"
                aria-label="Private repository"
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            {language && (
              <span className="inline-flex items-center gap-1.5">
                {langDot && (
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ background: langDot }}
                  />
                )}
                {language}
              </span>
            )}
            {typeof meta.stargazers_count === "number" && (
              <span className="tabular-nums">{meta.stargazers_count.toLocaleString()} ★</span>
            )}
            {typeof meta.forks_count === "number" && (
              <span className="tabular-nums">{meta.forks_count} forks</span>
            )}
            {lastPush && <span>pushed {lastPush} ago</span>}
          </div>

          {meta.topics && meta.topics.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {meta.topics.slice(0, 5).map((topic) => (
                <li
                  key={topic}
                  className="rounded-full border border-border/60 bg-background/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                >
                  {topic}
                </li>
              ))}
            </ul>
          )}

          {secondary.length > 0 && (
            <ul className="space-y-1 border-t border-border/40 pt-2">
              {secondary.map((repo) => {
                const name = repo.metadata?.full_name ?? getRepoFullName(repo);
                if (!name) return null;
                return (
                  <li key={repo.id}>
                    <a
                      href={`https://github.com/${name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate font-mono text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {name}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}

          {isOwner && primary && (
            <>
              <button
                type="button"
                onClick={syncFromGithub}
                disabled={syncing}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-surface-elevated disabled:opacity-60"
              >
                <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
                {syncing ? "Syncing…" : "Sync from GitHub"}
              </button>
              {onLinkRepo && (
                <button
                  type="button"
                  onClick={onLinkRepo}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Settings2 className="h-3 w-3" />
                  Manage repositories
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
