// ── GitHub Block ──────────────────────────────────────────────────────────────
// A member's GitHub work on their Studio, in one block with a choice of view:
// the year of commits across their projects' repositories, the languages
// they build in, and their top repositories — or all three.
//
// Everything comes from the cached snapshot written when a repo is linked or
// synced (project_repositories_safe, via useProfileRepoSnapshot), for the
// projects their work evidence shows — so a profile view never calls GitHub,
// and visitors only ever see repos on projects they can see. Repos link to
// their Tethyr project first: work before metadata.

import { useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Github, Star } from "lucide-react";
import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { CommitGraph } from "@/components/tethyr/project/commit-graph";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileWork } from "@/hooks/use-profile-work";
import { useProfileRepoSnapshot } from "@/hooks/use-profile-repo-snapshot";
import { useProfileReadme } from "@/hooks/use-profile-readme";
import { extractGithubUsername } from "@/components/tethyr/blocks/readme-markdown";
import { languageColor } from "@/lib/language-colors";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type View = "overview" | "activity" | "languages" | "repos";

/** Primary languages across repos, most used first, as shares of 100. */
export function languageShares(languages: Array<string | null>) {
  const counts = new Map<string, number>();
  for (const language of languages) {
    if (language) counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((n, c) => n + c, 0);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([language, count]) => ({
      language,
      count,
      share: total ? Math.round((count / total) * 100) : 0,
    }));
}

function ProfileGitHubBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : null;
  const view = (["overview", "activity", "languages", "repos"] as const).includes(
    config.view as View,
  )
    ? (config.view as View)
    : "overview";
  const limit = Math.max(1, Math.min(8, Number(config.repoCount) || 4));

  const work = useProfileWork(profileId);
  const projects = useMemo(() => (work.data?.hasWork ? work.data.projects : []), [work.data]);
  const snapshot = useProfileRepoSnapshot(projects.length ? projects.map((p) => p.id) : null);
  const { data: profile } = useProfileReadme(profileId);
  const handle = extractGithubUsername(profile?.social_links?.github);

  const repos = useMemo(() => {
    const byProject = snapshot.data?.byProject;
    if (!byProject) return [];
    return projects
      .map((project) => ({ project, repo: byProject.get(project.id) }))
      .filter((r): r is { project: (typeof projects)[number]; repo: NonNullable<typeof r.repo> } =>
        Boolean(r.repo?.fullName),
      )
      .sort((a, b) => (b.repo.stargazersCount ?? 0) - (a.repo.stargazersCount ?? 0));
  }, [snapshot.data, projects]);
  const weeks = snapshot.data?.aggregateWeeks ?? [];
  const languages = useMemo(() => languageShares(repos.map((r) => r.repo.language)), [repos]);

  const isLoading = work.isLoading || (projects.length > 0 && snapshot.isLoading);
  const shows = {
    activity: (view === "overview" || view === "activity") && weeks.length > 0,
    languages: (view === "overview" || view === "languages") && languages.length > 0,
    repos: (view === "overview" || view === "repos") && repos.length > 0,
  };
  const isEmpty = !shows.activity && !shows.languages && !shows.repos;

  useEffect(() => {
    if (isLoading || !blockId) return;
    onBlockEmptyChange?.(blockId, isEmpty);
  }, [blockId, isEmpty, isEditing, isLoading, onBlockEmptyChange]);

  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;
  if (isEmpty) {
    return isEditing ? (
      <BlockEmptyState
        label="GitHub"
        detail="link a GitHub repository to one of your projects (its Code panel) and your activity, languages and repos show here"
        nextHref="/settings#github"
        nextLabel="GitHub settings"
      />
    ) : null;
  }

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="GitHub">
      <BlockTitle
        config={config}
        icon={<Github aria-hidden />}
        action={
          handle ? (
            <a
              href={`https://github.com/${handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              @{handle}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : undefined
        }
      >
        GitHub
      </BlockTitle>

      {shows.activity && (
        <CommitGraph
          weeks={weeks}
          ariaLabel={`Commits in the last year across ${snapshot.data?.reposWithHistory ?? 0} repositories`}
        />
      )}

      {shows.languages && (
        <div className="space-y-2">
          <div
            className="flex h-2 overflow-hidden rounded-full bg-surface-sunken"
            role="img"
            aria-label={`Languages: ${languages.map((l) => `${l.language} ${l.share}%`).join(", ")}`}
          >
            {languages.map((l) => (
              <span
                key={l.language}
                style={{
                  width: `${l.share}%`,
                  backgroundColor: languageColor(l.language) ?? "var(--muted-foreground)",
                }}
              />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {languages.slice(0, 6).map((l) => (
              <li key={l.language} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: languageColor(l.language) ?? "var(--muted-foreground)",
                  }}
                  aria-hidden
                />
                <span className="text-foreground">{l.language}</span>
                <span className="tabular-nums">{l.share}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {shows.repos && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {repos.slice(0, limit).map(({ project, repo }) => (
            <li
              key={project.id}
              className="flex min-w-0 flex-col gap-1 rounded-md border border-border/60 px-3 py-2.5"
            >
              <Link
                to="/projects/$id"
                params={{ id: project.id }}
                className="truncate text-sm font-medium text-foreground hover:underline"
              >
                {project.title}
              </Link>
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                <a
                  href={`https://github.com/${repo.fullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 truncate font-mono hover:text-foreground"
                >
                  {repo.fullName}
                </a>
                {repo.language && (
                  <span className="inline-flex shrink-0 items-center gap-1">
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
                {(repo.stargazersCount ?? 0) > 0 && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 tabular-nums">
                    <Star className="h-3 w-3" aria-hidden />
                    {repo.stargazersCount?.toLocaleString()}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

registerBlock({
  type: "profile-github",
  category: "work",
  label: "GitHub",
  title: "GitHub",
  description:
    "Your year of commits, the languages you build in and your top repositories — from the repos linked to your projects.",
  icon: "Github",
  contentSource: "data",
  defaults: { view: "overview", repoCount: "4" },
  fields: [
    {
      key: "view",
      label: "Show",
      type: "select",
      options: [
        { label: "Everything", value: "overview" },
        { label: "Commit activity", value: "activity" },
        { label: "Languages", value: "languages" },
        { label: "Top repositories", value: "repos" },
      ],
    },
    {
      key: "repoCount",
      label: "Repositories to show",
      type: "select",
      options: [
        { label: "2", value: "2" },
        { label: "4", value: "4" },
        { label: "6", value: "6" },
      ],
    },
  ],
  component: ProfileGitHubBlock,
});

export { ProfileGitHubBlock };
