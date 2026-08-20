import {
  Share2,
  UserPlus,
  PenSquare,
  Star,
  GitBranch,
  Trophy,
  MessageCircle,
  CalendarDays,
  Link as LinkIcon,
  Lock,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import type { ProjectDetail } from "@/hooks/use-projects";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_STYLE,
  PROJECT_LINK_KEYS,
} from "@/components/tethyr/profile-sections";
import { safeHref } from "@/lib/validators";
import { ProfileLink } from "@/components/tethyr/profile-link";
import type { Contributor } from "./project-main-content";

const LANGUAGE_COLORS: Record<string, string> = {
  javascript: "#f1e05a",
  typescript: "#3178c6",
  python: "#3572A5",
  rust: "#dea584",
  go: "#00ADD8",
  java: "#b07219",
  kotlin: "#A97BFF",
  swift: "#F05138",
  ruby: "#701516",
  c: "#555555",
  "c++": "#f34b7d",
  "c#": "#178600",
  php: "#4F5D95",
  html: "#e34c26",
  css: "#563d7c",
  shell: "#89e051",
  lua: "#000080",
  dart: "#00B4AB",
  elixir: "#6e4a7e",
  haskell: "#5e5086",
  scala: "#c22d40",
  vue: "#41b883",
  svelte: "#ff3e00",
  solidity: "#AA6746",
};

function Avatar({
  name,
  src,
  size = "h-8 w-8",
  ring = "",
}: {
  name?: string | null;
  src?: string;
  size?: string;
  ring?: string;
}) {
  const initial = (name ?? "?").charAt(0).toUpperCase();
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-full bg-gradient-brand ${size} ${ring}`}
      title={name ?? undefined}
    >
      {src ? (
        <img
          src={src}
          alt=""
          width="40"
          height="40"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-background">
          {initial}
        </div>
      )}
    </div>
  );
}

export function ProjectHeader({
  project,
  coverSigned,
  creator,
  contributors,
  avatarSigned,
  links,
  repoStats,
  communityPostCount,
  openNeedCount,
  onJoin,
  onSignIn,
  onPostUpdate,
  onOpenDiscussions,
  onOpenNeeds,
}: {
  project: ProjectDetail;
  coverSigned: string | null;
  creator?: Contributor;
  contributors: Contributor[];
  avatarSigned: Record<string, string>;
  links: [string, string][];
  /** Cached GitHub stats from the first linked repository. */
  repoStats?: { language?: string | null; stars?: number; forks?: number };
  communityPostCount: number;
  openNeedCount: number;
  onJoin?: () => void;
  onSignIn?: () => void;
  onPostUpdate?: () => void;
  onOpenDiscussions?: () => void;
  onOpenNeeds?: () => void;
}) {
  const others = contributors.filter((c) => c.role !== "creator");
  const timeSinceStart = project.started_at
    ? formatDistanceToNowStrict(new Date(project.started_at), { addSuffix: true })
    : null;
  const langColor = repoStats?.language
    ? (LANGUAGE_COLORS[repoStats.language.toLowerCase()] ?? "var(--muted-foreground)")
    : null;

  const copyLink = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    }
  };

  return (
    <section className="border-b border-border/60">
      {/* Slim cover band */}
      <div className="relative h-44 overflow-hidden bg-[linear-gradient(120deg,oklch(0.65_0.26_305)_0%,oklch(0.92_0.23_142)_100%)] opacity-90 sm:h-52">
        {coverSigned && (
          <img
            src={coverSigned}
            alt={`${project.title} cover`}
            width="1600"
            height="208"
            className="h-full w-full object-cover"
            decoding="async"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-5 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4 pt-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-title text-2xl font-semibold tracking-tight sm:text-3xl">
                {project.title}
              </h1>
              <span
                className={`shrink-0 rounded-full border px-3 py-1 text-xs ${PROJECT_STATUS_STYLE[project.status]}`}
              >
                {PROJECT_STATUS_LABEL[project.status]}
              </span>
              {project.visibility === "private" && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                  title="Only the owner and contributors can view this project"
                >
                  <Lock className="h-3 w-3" />
                  Private
                </span>
              )}
              {project.is_featured && (
                <Trophy className="h-4 w-4 shrink-0 text-primary" aria-label="Featured" />
              )}
              <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {project.stage ?? "planning"}
              </span>
            </div>

            {/* Owner + collaborators */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              {creator?.profile && (
                <ProfileLink
                  handle={creator.profile.handle}
                  className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-foreground"
                  title={creator.profile.display_name || creator.profile.handle || undefined}
                >
                  <Avatar
                    name={creator.profile.display_name ?? creator.profile.handle}
                    src={avatarSigned[creator.profile_id]}
                    size="h-6 w-6"
                  />
                  <span className="font-medium">
                    {creator.profile.display_name || creator.profile.handle}
                  </span>
                </ProfileLink>
              )}
              {others.length > 0 && (
                <>
                  <span className="text-muted-foreground/40" aria-hidden>
                    ·
                  </span>
                  <div className="flex items-center">
                    <div className="flex -space-x-2">
                      {others.slice(0, 4).map((c) => (
                        <Avatar
                          key={c.profile_id}
                          name={c.profile?.display_name ?? c.profile?.handle}
                          src={avatarSigned[c.profile_id]}
                          size="h-6 w-6"
                          ring="ring-2 ring-background"
                        />
                      ))}
                    </div>
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {others.length} collaborator{others.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </>
              )}
              {timeSinceStart && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" /> Started {timeSinceStart}
                </span>
              )}
            </div>

            {/* Goal line */}
            {project.goal && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {project.goal}
              </p>
            )}

            {/* Tags + links + repo stats */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {project.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border/60 bg-background/40 px-2.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
              {repoStats?.language && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: langColor ?? undefined }}
                  />
                  {repoStats.language}
                </span>
              )}
              {repoStats?.stars != null && repoStats.stars > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                  <Star className="h-3 w-3" /> {repoStats.stars.toLocaleString()}
                </span>
              )}
              {repoStats?.forks != null && repoStats.forks > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                  <GitBranch className="h-3 w-3" /> {repoStats.forks.toLocaleString()}
                </span>
              )}
              {links.map(([key, url]) => {
                const meta = PROJECT_LINK_KEYS.find((l) => l.key === key);
                const Icon = meta?.icon ?? LinkIcon;
                return (
                  <a
                    key={key}
                    href={safeHref(url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2.5 py-0.5 text-[11px] text-muted-foreground transition hover:text-foreground"
                  >
                    <Icon className="h-3 w-3" />
                    {meta?.label ?? key}
                  </a>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            {openNeedCount > 0 && (
              <button
                onClick={onOpenNeeds}
                className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive transition hover:bg-destructive/10"
              >
                <Zap className="h-3.5 w-3.5" />
                {openNeedCount} need{openNeedCount !== 1 ? "s" : ""}
              </button>
            )}
            {communityPostCount > 0 && (
              <button
                onClick={onOpenDiscussions}
                className="inline-flex items-center gap-1.5 rounded-xl border border-learning/40 bg-learning/10 px-3 py-2 text-xs font-medium text-learning transition hover:bg-learning/20"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {communityPostCount} post{communityPostCount !== 1 ? "s" : ""}
              </button>
            )}
            <button
              onClick={copyLink}
              className="inline-flex items-center justify-center rounded-xl border border-border/60 bg-surface px-3 py-2 text-muted-foreground transition hover:text-foreground"
              aria-label="Copy link"
              title="Copy link"
            >
              <Share2 className="h-4 w-4" />
            </button>
            {onJoin ? (
              <button
                onClick={onJoin}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--user-accent,var(--trust))] px-4 py-2 text-sm font-semibold text-[var(--user-accent-foreground,var(--background))] transition hover:opacity-90"
              >
                <UserPlus className="h-4 w-4" />
                Join Project
              </button>
            ) : onPostUpdate ? (
              <button
                onClick={onPostUpdate}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--user-accent,var(--trust))] px-4 py-2 text-sm font-semibold text-[var(--user-accent-foreground,var(--background))] transition hover:opacity-90"
              >
                <PenSquare className="h-4 w-4" />
                Post update
              </button>
            ) : onSignIn ? (
              <button
                onClick={onSignIn}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--user-accent,var(--trust))] px-4 py-2 text-sm font-semibold text-[var(--user-accent-foreground,var(--background))] transition hover:opacity-90"
              >
                <UserPlus className="h-4 w-4" />
                Sign in to join
              </button>
            ) : null}
          </div>
        </div>

        {/* Progress strip */}
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated">
            <div
              className="h-full rounded-full bg-gradient-brand transition-all"
              style={{ width: `${project.progress_percent}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {project.progress_percent}% complete
          </span>
        </div>
      </div>
    </section>
  );
}
