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
  Globe2,
  Zap,
  Github,
  Check,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ProjectDetail } from "@/hooks/use-projects";
import { PROJECT_STATUS_STYLE, PROJECT_LINK_KEYS } from "@/components/tethyr/profile-sections";
import { safeHref } from "@/lib/validators";
import { ProfileLink } from "@/components/tethyr/profile-link";
import { PersonPill } from "@/components/tethyr/person-pill";
import { contributionRoleNoun } from "@/lib/contribution-role";
import { Button } from "@/components/ui/button";
import { LANGUAGE_COLORS } from "@/lib/language-colors";
import { canonicalProjectStatus, isLiveStatus, statusDotClass } from "@/lib/project-status";
import type { Contributor } from "@/hooks/use-projects";
import { AiIndicator } from "@/components/tethyr/project/ai-indicator";

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
      className={`shrink-0 overflow-hidden rounded-full bg-foreground text-background ${size} ${ring}`}
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
  forkedFrom,
  forkCount,
  canFork,
  onFork,
  onJoin,
  onSignIn,
  onPostUpdate,
  onOpenDiscussions,
  onOpenNeeds,
  onOpenPeople,
  aiTagCount,
  aiUserTagged,
  canAiTag,
}: {
  project: ProjectDetail;
  coverSigned: string | null;
  creator?: Contributor;
  contributors: Contributor[];
  avatarSigned: Record<string, string>;
  links: [string, string][];
  /** Cached GitHub stats from the first linked repository. */
  repoStats?: {
    language?: string | null;
    stars?: number;
    forks?: number;
    /** Original GitHub URL of the primary repo, when one is linked. */
    url?: string | null;
    name?: string | null;
  };
  communityPostCount: number;
  openNeedCount: number;
  /** The original project when this one is a fork, for lineage attribution. */
  forkedFrom?: { id: string; title: string; handle: string | null } | null;
  /** How many times this project has been forked. */
  forkCount?: number;
  /** Whether the signed-in viewer may fork this project. */
  canFork?: boolean;
  onFork?: () => void;
  onJoin?: () => void;
  onSignIn?: () => void;
  onPostUpdate?: () => void;
  onOpenDiscussions?: () => void;
  onOpenNeeds?: () => void;
  onOpenPeople?: () => void;
  /** Community AI-tag count for this project. */
  aiTagCount?: number;
  /** Whether the current user has already tagged this project as AI-assisted. */
  aiUserTagged?: boolean;
  /** Whether the signed-in viewer can community-tag (signed in, not owner). */
  canAiTag?: boolean;
}) {
  const others = contributors.filter((c) => c.role !== "creator");
  const canonicalWord = canonicalProjectStatus(project.status, project.stage);
  const timeSinceStart = project.started_at
    ? formatDistanceToNowStrict(new Date(project.started_at), { addSuffix: true })
    : null;
  const langColor = repoStats?.language
    ? (LANGUAGE_COLORS[repoStats.language.toLowerCase()] ?? "var(--muted-foreground)")
    : null;
  const repoHref = repoStats?.url ? safeHref(repoStats.url) : null;
  const repoChipClass =
    "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2.5 py-0.5 text-[11px] text-muted-foreground transition-lift hover:text-foreground";
  const [copied, setCopied] = useState(false);

  // A refused or missing clipboard used to do nothing at all (and threw);
  // say so, like the Library's copy buttons.
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy the link — copy it from the address bar instead.");
    }
  };

  return (
    <section className="border-b border-border/60">
      {/* Cover band only when there's a cover: a placeholder here spent about
          320px above the fold on a folder icon before the title and stage. */}
      {coverSigned && (
        <div className="relative h-56 overflow-hidden bg-surface-sunken sm:h-72 lg:h-80">
          <img
            src={coverSigned}
            alt={`${project.title} cover`}
            width="1600"
            height="208"
            className="h-full w-full object-cover"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 pb-7 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4 pt-6 sm:pt-7">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                {project.title}
              </h1>
              {canonicalWord && (
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${PROJECT_STATUS_STYLE[project.status]}`}
                  title="Where the project is in its life — set by the builder"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      statusDotClass(project.status),
                      isLiveStatus(project.status, project.stage) && "animate-status-breathe",
                    )}
                  />
                  {canonicalWord}
                </span>
              )}
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                title={
                  project.visibility === "private"
                    ? "Only the owner and contributors can view this project"
                    : "Anyone can discover this project"
                }
              >
                {project.visibility === "private" ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  <Globe2 className="h-3 w-3" />
                )}
                {project.visibility === "private" ? "Private" : "Public"}
              </span>
              {project.is_featured && (
                <span title="Featured project" className="inline-flex">
                  <Trophy
                    className="h-4 w-4 shrink-0 text-primary"
                    role="img"
                    aria-label="Featured project"
                  />
                </span>
              )}
              <AiIndicator
                projectId={project.id}
                ownerAssisted={!!project.ai_assisted}
                aiTagCount={aiTagCount ?? 0}
                aiUserTagged={!!aiUserTagged}
                canTag={!!canAiTag}
              />
            </div>

            {/* Fork lineage — a fork is always attributed to the project it
                came from, so no one mistakes it for original work. */}
            {forkedFrom && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <GitBranch className="h-3.5 w-3.5" aria-hidden />
                <span>Forked from</span>
                <Link
                  to="/projects/$id"
                  params={{ id: forkedFrom.id }}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {forkedFrom.title}
                </Link>
                {forkedFrom.handle && <span>by @{forkedFrom.handle}</span>}
              </div>
            )}

            {/* Owner + collaborators */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              {creator?.profile && (
                <PersonPill
                  handle={creator.profile.handle}
                  name={creator.profile.display_name ?? creator.profile.handle}
                  role="creator"
                  avatarSrc={avatarSigned[creator.profile_id]}
                  size="sm"
                  alwaysShowName
                  className="text-muted-foreground hover:text-foreground"
                />
              )}
              {others.length > 0 && (
                <>
                  <span className="text-muted-foreground/40" aria-hidden>
                    ·
                  </span>
                  <div className="flex items-center">
                    <div className="flex -space-x-2">
                      {others.slice(0, 4).map((c) => (
                        <ProfileLink
                          key={c.profile_id}
                          handle={c.profile?.handle}
                          title={`${c.profile?.display_name ?? c.profile?.handle ?? "Anonymous"} · ${contributionRoleNoun(c.role)}`}
                          className="transition-lift inline-flex rounded-full p-0.5 -m-0.5"
                        >
                          <Avatar
                            name={c.profile?.display_name ?? c.profile?.handle}
                            src={avatarSigned[c.profile_id]}
                            size="h-6 w-6"
                            ring="ring-2 ring-background"
                          />
                        </ProfileLink>
                      ))}
                    </div>
                    {onOpenPeople ? (
                      <button
                        type="button"
                        onClick={onOpenPeople}
                        className="ml-1.5 inline-flex min-h-6 items-center rounded-md text-left text-xs text-muted-foreground underline-offset-4 pointer-coarse:min-h-10 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--trust))]"
                        aria-label={`View ${others.length} collaborator${others.length !== 1 ? "s" : ""}`}
                      >
                        {others.length} collaborator{others.length !== 1 ? "s" : ""}
                      </button>
                    ) : (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {others.length} collaborator{others.length !== 1 ? "s" : ""}
                      </span>
                    )}
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
              {repoStats?.name && (
                <a
                  href={repoHref ?? undefined}
                  target={repoHref ? "_blank" : undefined}
                  rel="noreferrer"
                  className={cn(
                    repoChipClass,
                    "font-mono",
                    repoHref && "hover:border-[var(--user-accent-border,var(--border-strong))]",
                  )}
                  aria-label={
                    repoHref ? `Open source repository ${repoStats.name} on GitHub` : undefined
                  }
                >
                  <Github className="h-3 w-3 text-muted-foreground" />
                  {repoStats.name}
                </a>
              )}
              {repoStats?.language && (
                <a
                  href={repoHref ?? undefined}
                  target={repoHref ? "_blank" : undefined}
                  rel="noreferrer"
                  className={cn(
                    repoChipClass,
                    repoHref && "hover:border-[var(--user-accent-border,var(--border-strong))]",
                  )}
                  aria-label={
                    repoHref
                      ? `Open source repository for ${repoStats.name ?? "this project"} on GitHub`
                      : undefined
                  }
                >
                  {repoHref && <Github className="h-3 w-3 text-muted-foreground" />}
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: langColor ?? undefined }}
                  />
                  {repoStats.language}
                </a>
              )}
              {repoStats?.stars != null && repoStats.stars > 0 && (
                <a
                  href={repoHref ?? undefined}
                  target={repoHref ? "_blank" : undefined}
                  rel="noreferrer"
                  className={cn(
                    repoChipClass,
                    repoHref && "hover:border-[var(--user-accent-border,var(--border-strong))]",
                  )}
                >
                  <Star className="h-3 w-3" /> {repoStats.stars.toLocaleString()}
                </a>
              )}
              {repoStats?.forks != null && repoStats.forks > 0 && (
                <a
                  href={repoHref ?? undefined}
                  target={repoHref ? "_blank" : undefined}
                  rel="noreferrer"
                  className={cn(
                    repoChipClass,
                    repoHref && "hover:border-[var(--user-accent-border,var(--border-strong))]",
                  )}
                >
                  <GitBranch className="h-3 w-3" /> {repoStats.forks.toLocaleString()}
                </a>
              )}
              {forkCount != null && forkCount > 0 && (
                <span
                  className={repoChipClass}
                  title="Times this project has been forked on Tethyr"
                >
                  <GitBranch className="h-3 w-3" /> {forkCount.toLocaleString()}
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
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2.5 py-0.5 text-[11px] text-muted-foreground transition-lift hover:text-foreground"
                  >
                    <Icon className="h-3 w-3" />
                    {meta?.label ?? key}
                  </a>
                );
              })}
            </div>
          </div>

          {/* Actions stay in the project header so discovery, discussion, and contribution remain one connected path. */}
          <div
            className="flex w-full flex-wrap items-center justify-start gap-2 rounded-lg bg-surface-sunken/60 p-1.5 sm:w-auto sm:justify-end"
            aria-label="Project actions"
          >
            {openNeedCount > 0 && (
              <button
                onClick={onOpenNeeds}
                // "Help wanted", not an error: accent, never destructive red.
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--user-accent-border,var(--border-strong))] bg-[var(--user-accent-subtle,var(--surface))] px-3 py-2 text-xs font-medium text-[var(--user-accent-text,var(--foreground))] transition-lift hover:border-[var(--user-accent,var(--border-strong))]"
              >
                <Zap className="h-3.5 w-3.5" />
                {openNeedCount} open need{openNeedCount !== 1 ? "s" : ""}
              </button>
            )}
            {communityPostCount > 0 && (
              <button
                onClick={onOpenDiscussions}
                className="inline-flex items-center gap-1.5 rounded-md border border-learning/40 bg-learning/10 px-3 py-2 text-xs font-medium text-learning transition-lift hover:bg-learning/20"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {communityPostCount} post{communityPostCount !== 1 ? "s" : ""}
              </button>
            )}
            {canFork && onFork && (
              <button
                onClick={onFork}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface px-3 py-2 text-xs font-medium text-muted-foreground transition-lift hover:border-border-strong hover:text-foreground"
                title="Create your own version of this project"
              >
                <GitBranch className="h-3.5 w-3.5" />
                Fork
              </button>
            )}
            <button
              onClick={() => void copyLink()}
              className="inline-flex items-center justify-center rounded-md border border-border/60 bg-surface px-3 py-2 text-muted-foreground transition-lift hover:border-border-strong hover:text-foreground"
              aria-label="Copy link"
              title="Copy link"
            >
              {copied ? <Check className="h-4 w-4 text-trust" /> : <Share2 className="h-4 w-4" />}
            </button>
            {onJoin ? (
              <Button onClick={onJoin}>
                <UserPlus className="h-4 w-4" />
                Join project
              </Button>
            ) : onPostUpdate ? (
              <Button onClick={onPostUpdate}>
                <PenSquare className="h-4 w-4" />
                Post update
              </Button>
            ) : onSignIn ? (
              <Button onClick={onSignIn}>
                <UserPlus className="h-4 w-4" />
                Sign in to join
              </Button>
            ) : null}
          </div>
        </div>

        {/* Progress strip */}
        <div className="mt-5 flex items-center gap-3" aria-label="Project progress">
          {/* The builder's own measure. Milestones have their own count in
              Current work, so this never claims "complete". */}
          <span
            className="shrink-0 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
            title="Set by the builder, and nudged along by completed milestones and recent activity"
          >
            Progress
          </span>
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated"
            role="progressbar"
            aria-valuenow={project.progress_percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress ${project.progress_percent}%`}
          >
            <div
              className="h-full rounded-full bg-[var(--user-accent,var(--foreground))] transition-[width]"
              style={{ width: `${project.progress_percent}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium text-foreground tabular-nums">
            {project.progress_percent}%
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {project.looking_for_collaborators && <span>Seeking collaborators</span>}
          {project.looking_for_feedback && <span>Open to feedback</span>}
        </div>
      </div>
    </section>
  );
}
