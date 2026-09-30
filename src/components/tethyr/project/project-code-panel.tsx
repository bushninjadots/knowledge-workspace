import { useState } from "react";
import {
  CalendarClock,
  Link2,
  Lock,
  Plus,
  RefreshCw,
  Scale,
  Settings2,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { languageColor } from "@/lib/language-colors";
import { getRepoFullName, githubDisplayShows } from "@/lib/github";
import type { CommitActivityWeek, GithubDisplay } from "@/lib/github";
import { CommitGraph } from "./commit-graph";
import { fetchProjectReadmeSource, readmeSourceMessage } from "@/lib/project-readme-source";
import { safeHref } from "@/lib/validators";
import { useUpdateGithubDisplay, useUpdateProjectReadme } from "@/hooks/use-projects";
import { useRefreshRepoMetadata } from "@/hooks/use-project-repos";
import type { ProjectRepo } from "@/hooks/use-project-repos";

type ProjectCodePanelProps = {
  project: { id: string; readme?: string | null; github_display?: GithubDisplay | null };
  repos: ProjectRepo[] | undefined;
  isOwner: boolean;
  className?: string;
  onLinkRepo?: () => void;
};

const DISPLAY_OPTIONS: { key: keyof GithubDisplay; label: string }[] = [
  { key: "show_stats", label: "Stars, forks & issues" },
  { key: "show_topics", label: "Topics" },
  { key: "show_graph", label: "Contribution graph" },
  { key: "show_details", label: "License & details" },
];

/**
 * Compact GitHub surface for the project page: primary repo, key stats,
 * topics, the 52-week contribution graph, and a one-click "Sync from GitHub"
 * for owners (README + cached stats in one action). Owners choose which
 * sections show via the per-project display preferences. On desktop it lives
 * in the sticky rail beside the README; on mobile it renders as a full-width
 * band below it.
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
  const updateDisplay = useUpdateGithubDisplay();
  const [syncing, setSyncing] = useState(false);
  const [customizing, setCustomizing] = useState(false);

  const primary = repos?.[0];
  const secondary = repos?.slice(1, 4) ?? [];

  // One click pulls both faces of the repo: the README (with relative links
  // absolutized against the real default branch) and the cached metadata
  // snapshot (stars, language, topics, contribution graph) the panel renders.
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

  const toggleDisplay = (key: keyof GithubDisplay) => {
    const current = project.github_display ?? {};
    updateDisplay.mutate(
      { projectId: project.id, display: { ...current, [key]: !githubDisplayShows(current, key) } },
      {
        onSuccess: () => {
          toast.success(
            githubDisplayShows(current, key)
              ? "Hidden from the project page"
              : "Visible on the project page",
          );
        },
      },
    );
  };

  const meta = primary?.metadata ?? {};
  const cachedWeeks = Array.isArray(meta.commit_activity)
    ? (meta.commit_activity as CommitActivityWeek[])
    : null;
  const hasGraph =
    githubDisplayShows(project.github_display, "show_graph") &&
    !!cachedWeeks &&
    cachedWeeks.length > 0;
  const language = meta.language ?? null;
  const langDot = languageColor(language);
  const lastPush = meta.updated_at ? formatDistanceToNowStrict(new Date(meta.updated_at)) : null;
  const createdAgo = meta.created_at ? formatDistanceToNowStrict(new Date(meta.created_at)) : null;
  const showStats = githubDisplayShows(project.github_display, "show_stats");
  const showTopics = githubDisplayShows(project.github_display, "show_topics");
  const showDetails = githubDisplayShows(project.github_display, "show_details");

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

          {showStats && (
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
              {typeof meta.open_issues_count === "number" && meta.open_issues_count > 0 && (
                <span className="tabular-nums">{meta.open_issues_count} open issues</span>
              )}
              {lastPush && <span>pushed {lastPush} ago</span>}
            </div>
          )}

          {showTopics && meta.topics && meta.topics.length > 0 && (
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

          {showDetails && (meta.license || meta.homepage || createdAgo) && (
            <ul className="space-y-1 text-[12px] text-muted-foreground">
              {meta.license && (
                <li className="flex items-center gap-1.5">
                  <Scale className="h-3 w-3 shrink-0" />
                  {meta.license} license
                </li>
              )}
              {meta.homepage && safeHref(meta.homepage) && (
                <li className="flex items-center gap-1.5">
                  <Link2 className="h-3 w-3 shrink-0" />
                  <a
                    href={safeHref(meta.homepage) as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 truncate hover:text-foreground hover:underline"
                  >
                    {meta.homepage.replace(/^https?:\/\//, "")}
                  </a>
                </li>
              )}
              {createdAgo && (
                <li className="flex items-center gap-1.5">
                  <CalendarClock className="h-3 w-3 shrink-0" />
                  started {createdAgo} ago
                </li>
              )}
            </ul>
          )}

          {hasGraph && cachedWeeks && (
            <CommitGraph
              weeks={cachedWeeks}
              ariaLabel={`Contribution graph: ${cachedWeeks.reduce((n, w) => n + w.total, 0)} commits over the last 52 weeks`}
            />
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
              <div>
                <button
                  type="button"
                  onClick={() => setCustomizing((v) => !v)}
                  aria-expanded={customizing}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Sparkles className="h-3 w-3" />
                  Customize
                </button>
                {customizing && (
                  <div className="mt-1 space-y-0.5 rounded-lg border border-border/60 bg-background/40 p-2">
                    {DISPLAY_OPTIONS.map(({ key, label }) => {
                      const on = githubDisplayShows(project.github_display, key);
                      return (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-1.5 py-1 text-xs text-foreground hover:bg-surface-elevated"
                        >
                          <span>{label}</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={on}
                            aria-label={label}
                            onClick={() => toggleDisplay(key)}
                            className={cn(
                              "relative h-4.5 w-8 shrink-0 rounded-full transition-lift",
                              on ? "bg-primary" : "bg-border",
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-background transition-spatial",
                                on ? "left-4" : "left-0.5",
                              )}
                            />
                          </button>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
