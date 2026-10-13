// ── GitHub Block ──────────────────────────────────────────────────────────────
// A member's GitHub on their Studio: who they are there, their year of
// contributions, the languages they build in, the repos they choose to show
// (pinned, most starred, most recent, or hand-picked) and what they've been
// doing lately. Each part can be switched off in the block's settings.
//
// Two sources, both cached so a profile view never calls GitHub:
//   • profile_github — the connected account's public snapshot (useGithubProfile),
//     refreshed when the owner opens their Studio and daily;
//   • repos linked to their Tethyr projects (project_repositories_safe), which
//     still give a commit graph without a connected account, and let a repo
//     card link to its Tethyr project first: work before metadata.

import { useEffect, useMemo, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  ExternalLink,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  Github,
  Globe,
  MapPin,
  Package,
  Pin,
  Plus,
  Star,
  CircleDot,
} from "lucide-react";
import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { CommitGraph } from "@/components/tethyr/project/commit-graph";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileWork } from "@/hooks/use-profile-work";
import { useProfileRepoSnapshot } from "@/hooks/use-profile-repo-snapshot";
import { useConnectedAccounts } from "@/hooks/use-github";
import {
  isGithubProfileStale,
  useGithubProfile,
  useSyncGithubProfile,
} from "@/hooks/use-github-profile";
import { pickRepos, type GithubRecentEvent } from "@/lib/github-profile";
import { languageColor } from "@/lib/language-colors";
import { registerBlock } from "@/lib/block-registry";
import { timeAgo } from "@/lib/time";
import { safeHref } from "@/lib/validators";
import type { BlockConfig, BlockProps } from "@/lib/page-blocks";

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

type Parts = {
  profile: boolean;
  activity: boolean;
  languages: boolean;
  repos: boolean;
  recent: boolean;
};

/**
 * Which parts to show. Blocks saved before the toggles existed have a single
 * `view` ("overview" | "activity" | "languages" | "repos"); it still works.
 */
export function githubBlockParts(config: BlockConfig): Parts {
  const view = typeof config.view === "string" ? config.view : "overview";
  const only = view !== "overview" ? view : null;
  const on = (key: string, part: keyof Parts) => (only ? only === part : config[key] !== false);
  return {
    profile: on("showProfile", "profile"),
    activity: on("showActivity", "activity"),
    languages: on("showLanguages", "languages"),
    repos: on("showRepos", "repos"),
    recent: on("showRecent", "recent"),
  };
}

const RECENT_ICON: Record<GithubRecentEvent["kind"], typeof Github> = {
  push: GitCommitHorizontal,
  pr_opened: GitPullRequest,
  pr_merged: GitMerge,
  release: Package,
  repo_created: Plus,
  issue: CircleDot,
  review: GitPullRequest,
};

function recentDetail(event: GithubRecentEvent) {
  if (event.kind !== "push") return event.repo;
  const commits = event.count ? `${event.count} commit${event.count === 1 ? "" : "s"}` : null;
  const pushes = (event.pushes ?? 1) > 1 ? `${event.pushes} pushes` : null;
  return [commits ?? pushes, event.repo].filter(Boolean).join(" · ");
}

function LanguageBar({ languages }: { languages: { language: string; share: number }[] }) {
  return (
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
              style={{ backgroundColor: languageColor(l.language) ?? "var(--muted-foreground)" }}
              aria-hidden
            />
            <span className="text-foreground">{l.language}</span>
            <span className="tabular-nums">{l.share}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProfileGitHubBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : null;
  const parts = githubBlockParts(config);
  const limit = Math.max(1, Math.min(8, Number(config.repoCount) || 4));
  const repoMode = typeof config.repoSource === "string" ? config.repoSource : "pinned";
  const chosen = Array.isArray(config.repos) ? (config.repos as string[]) : [];
  const showDescriptions = config.showDescriptions !== false;

  const account = useGithubProfile(profileId);
  const snapshot = account.data?.snapshot ?? null;

  // Tethyr projects with linked repos: a commit graph without a connected
  // account, and "On Tethyr" links on repo cards.
  const work = useProfileWork(profileId);
  const projects = useMemo(() => (work.data?.hasWork ? work.data.projects : []), [work.data]);
  const linked = useProfileRepoSnapshot(projects.length ? projects.map((p) => p.id) : null);
  const projectByRepo = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    const byProject = linked.data?.byProject;
    if (!byProject) return map;
    for (const p of projects) {
      const name = byProject.get(p.id)?.fullName;
      if (name) map.set(name.toLowerCase(), { id: p.id, title: p.title });
    }
    return map;
  }, [linked.data, projects]);

  // The owner keeps their own snapshot fresh just by looking at it.
  const { data: accounts } = useConnectedAccounts();
  const connected = (accounts ?? []).some((a) => a.provider === "github");
  const sync = useSyncGithubProfile();
  const tried = useRef(false);
  const isOwnView = !!context.isOwner || !!isEditing;
  useEffect(() => {
    if (!isOwnView || !connected || account.isLoading || tried.current) return;
    if (!isGithubProfileStale(account.data)) return;
    tried.current = true;
    sync.mutate();
  }, [isOwnView, connected, account.isLoading, account.data, sync]);

  const linkedRepos = useMemo(() => {
    const byProject = linked.data?.byProject;
    if (!byProject) return [];
    return projects
      .map((p) => byProject.get(p.id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r?.fullName));
  }, [linked.data, projects]);

  const weeks = snapshot?.contributions?.weeks?.length
    ? snapshot.contributions.weeks
    : (linked.data?.aggregateWeeks ?? []);
  const languages = snapshot?.languages?.length
    ? snapshot.languages
    : languageShares(linkedRepos.map((r) => r.language));
  const repos = snapshot ? pickRepos(snapshot, repoMode, chosen, limit) : [];

  const shows = {
    profile: parts.profile && !!snapshot,
    activity: parts.activity && weeks.length > 0,
    languages: parts.languages && languages.length > 0,
    repos: parts.repos && (repos.length > 0 || (!snapshot && linkedRepos.length > 0)),
    recent: parts.recent && (snapshot?.recent.length ?? 0) > 0,
  };
  const isEmpty = !Object.values(shows).some(Boolean);
  const isLoading =
    account.isLoading || work.isLoading || (projects.length > 0 && linked.isLoading);

  useEffect(() => {
    if (isLoading || !blockId) return;
    onBlockEmptyChange?.(blockId, isEmpty);
  }, [blockId, isEmpty, isEditing, isLoading, onBlockEmptyChange]);

  if (isLoading || (isEmpty && sync.isPending)) {
    return <Skeleton className="h-32 w-full rounded-xl" />;
  }
  if (isEmpty) {
    if (!isEditing) return null;
    return connected ? (
      <BlockEmptyState
        label="GitHub"
        detail={
          sync.data === "rate_limited"
            ? "GitHub is limiting requests right now — try Sync now in this block's settings in a few minutes"
            : "nothing public to show yet — once your GitHub account has public repos or activity it appears here"
        }
        nextHref="/settings#github"
        nextLabel="GitHub settings"
      />
    ) : (
      <BlockEmptyState
        label="GitHub"
        detail="connect your GitHub account and your contributions, languages, repos and recent activity show here"
        nextHref="/settings#github"
        nextLabel="Connect GitHub"
      />
    );
  }

  const login = snapshot?.login ?? account.data?.username;
  const blog = snapshot?.blog
    ? safeHref(/^https?:\/\//.test(snapshot.blog) ? snapshot.blog : `https://${snapshot.blog}`)
    : null;
  const stats = snapshot
    ? [
        snapshot.contributions &&
          !shows.activity && {
            label: "contributions this year",
            value: snapshot.contributions.total,
          },
        { label: snapshot.public_repos === 1 ? "repo" : "repos", value: snapshot.public_repos },
        snapshot.total_stars > 0 && { label: "stars", value: snapshot.total_stars },
        { label: snapshot.followers === 1 ? "follower" : "followers", value: snapshot.followers },
      ].filter((s): s is { label: string; value: number } => !!s)
    : [];

  return (
    <section className="flex min-w-0 flex-col gap-5" aria-label="GitHub">
      <BlockTitle
        config={config}
        icon={<Github aria-hidden />}
        action={
          login ? (
            <a
              href={`https://github.com/${login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              @{login}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : undefined
        }
      >
        GitHub
      </BlockTitle>

      {shows.profile && snapshot && (
        <div className="flex min-w-0 flex-wrap items-start gap-4">
          {snapshot.avatar_url && (
            <img
              src={snapshot.avatar_url}
              alt=""
              width={48}
              height={48}
              loading="lazy"
              decoding="async"
              className="h-12 w-12 shrink-0 rounded-full border border-border/60"
            />
          )}
          <div className="min-w-[12rem] flex-1 space-y-1">
            <p className="text-sm font-medium">
              {snapshot.name ?? snapshot.login}
              {snapshot.name && (
                <span className="ml-1.5 font-normal text-muted-foreground">@{snapshot.login}</span>
              )}
            </p>
            {snapshot.bio && <p className="text-sm text-muted-foreground">{snapshot.bio}</p>}
            {(snapshot.company || snapshot.location || blog) && (
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {snapshot.company && (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3" aria-hidden />
                    {snapshot.company}
                  </span>
                )}
                {snapshot.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" aria-hidden />
                    {snapshot.location}
                  </span>
                )}
                {blog && (
                  <a
                    href={blog}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <Globe className="h-3 w-3" aria-hidden />
                    {blog.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                )}
              </p>
            )}
          </div>
          {stats.length > 0 && (
            <dl className="flex w-full flex-wrap gap-x-5 gap-y-2 text-xs">
              {stats.map((s) => (
                <div key={s.label} className="flex items-baseline gap-1">
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    {s.value.toLocaleString()}
                  </dd>
                  <dt className="text-muted-foreground">{s.label}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {shows.activity && (
        <CommitGraph
          weeks={weeks}
          unit={snapshot?.contributions ? "contribution" : "commit"}
          ariaLabel={
            snapshot?.contributions
              ? `${snapshot.contributions.total} GitHub contributions in the last year`
              : `Commits in the last year across ${linked.data?.reposWithHistory ?? 0} repositories`
          }
        />
      )}

      {shows.languages && <LanguageBar languages={languages} />}

      {shows.repos && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {(snapshot
            ? repos
            : linkedRepos.slice(0, limit).map((r) => ({
                full_name: r.fullName as string,
                name: (r.fullName as string).split("/")[1] ?? (r.fullName as string),
                description: null,
                language: r.language,
                stars: r.stargazersCount ?? 0,
                forks: 0,
                topics: [],
                homepage: null,
                pushed_at: null,
                archived: false,
              }))
          ).map((repo) => {
            const project = projectByRepo.get(repo.full_name.toLowerCase());
            const pinned = snapshot?.pinned?.includes(repo.full_name);
            return (
              <li
                key={repo.full_name}
                className="flex min-w-0 flex-col gap-1 rounded-md border border-border/60 px-3 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {pinned && repoMode === "pinned" && (
                    <Pin className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Pinned" />
                  )}
                  <a
                    href={`https://github.com/${repo.full_name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm font-medium text-foreground hover:underline"
                  >
                    {repo.name}
                  </a>
                  {repo.archived && (
                    <span className="shrink-0 rounded-full border border-border/60 px-1.5 text-[10px] text-muted-foreground">
                      Archived
                    </span>
                  )}
                </span>
                {showDescriptions && repo.description && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{repo.description}</p>
                )}
                <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {repo.language && (
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            languageColor(repo.language) ?? "var(--muted-foreground)",
                        }}
                        aria-hidden
                      />
                      {repo.language}
                    </span>
                  )}
                  {repo.stars > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 tabular-nums">
                      <Star className="h-3 w-3" aria-hidden />
                      {repo.stars.toLocaleString()}
                    </span>
                  )}
                  {repo.pushed_at && <span>Updated {timeAgo(repo.pushed_at)}</span>}
                  {project && (
                    <Link
                      to="/projects/$id"
                      params={{ id: project.id }}
                      className="font-medium text-foreground hover:underline"
                    >
                      On Tethyr: {project.title}
                    </Link>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {shows.recent && snapshot && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Lately
            {snapshot.activity.active_repos > 0 &&
              ` · active in ${snapshot.activity.active_repos} repo${snapshot.activity.active_repos === 1 ? "" : "s"} over 90 days`}
          </p>
          <ul className="space-y-1.5">
            {snapshot.recent.slice(0, Math.max(3, limit)).map((event) => {
              const Icon = RECENT_ICON[event.kind] ?? Github;
              return (
                <li
                  key={`${event.kind}-${event.repo}-${event.created_at}`}
                  className="flex min-w-0 items-start gap-2 text-sm"
                >
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <a
                      href={safeHref(event.url) ?? `https://github.com/${event.repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-1 hover:underline"
                    >
                      {event.title}
                    </a>
                    <span className="block truncate text-xs text-muted-foreground">
                      {recentDetail(event)} · {timeAgo(event.created_at)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
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
    "Your GitHub at a glance: profile, a year of contributions, languages, the repos you choose and what you've shipped lately.",
  icon: "Github",
  contentSource: "data",
  defaults: {
    view: "overview",
    repoSource: "pinned",
    repoCount: "4",
    showProfile: true,
    showActivity: true,
    showLanguages: true,
    showRepos: true,
    showRecent: true,
    showDescriptions: true,
  },
  fields: [
    {
      key: "repoSource",
      label: "Repositories",
      help: "Pinned uses the repos pinned on your GitHub profile (falls back to most starred).",
      type: "select",
      options: [
        { label: "Pinned on GitHub", value: "pinned" },
        { label: "Most starred", value: "top" },
        { label: "Recently updated", value: "recent" },
        { label: "Choose them myself", value: "chosen" },
      ],
    },
    {
      key: "repoCount",
      label: "How many",
      type: "select",
      options: [
        { label: "2", value: "2" },
        { label: "4", value: "4" },
        { label: "6", value: "6" },
        { label: "8", value: "8" },
      ],
    },
    { key: "showProfile", label: "Profile & stats", type: "toggle" },
    { key: "showActivity", label: "Contribution graph", type: "toggle" },
    { key: "showLanguages", label: "Languages", type: "toggle" },
    { key: "showRepos", label: "Repositories", type: "toggle" },
    { key: "showDescriptions", label: "Repo descriptions", type: "toggle" },
    { key: "showRecent", label: "Recent activity", type: "toggle" },
  ],
  component: ProfileGitHubBlock,
});

export { ProfileGitHubBlock };
