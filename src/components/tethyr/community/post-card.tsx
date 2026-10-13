import { useState } from "react";
import { Link } from "@tanstack/react-router";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Heart,
  ThumbsUp,
  MessageCircle,
  Bookmark,
  HandHeart,
  Link2,
  Flag,
  CheckCircle2,
  FileText,
  Video,
  Github,
  LayoutTemplate,
  BookMarked,
  Wrench,
  Trophy,
  Sparkles,
  Handshake,
  Zap,
  HelpCircle,
  Rocket,
  BookOpen,
  MessageSquare,
  Pencil,
  Trash2,
  BadgeCheck,
  Clock,
  Lightbulb,
  MessageSquareMore,
  UserPlus,
  Share2,
  BarChart3,
  MoreHorizontal,
} from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  POST_TYPE_LABEL,
  flairClasses,
  type PostType,
  type CommentRow,
  type PostWithAuthor,
} from "@/lib/community-data";
import { safeHref } from "@/lib/validators";
import { useCurrentUser, useSkillsCatalog } from "@/hooks/use-current-user";
import { type PollData } from "@/hooks/use-community";
import { FollowButton } from "@/components/tethyr/follow-button";
import { ProjectCardInline } from "@/components/tethyr/community/project-card-inline";
import { ShareSpaceDialog } from "@/components/tethyr/community/share-space-dialog";
import { CommentThreadInline } from "@/components/tethyr/community/post-comments";
import { timeAgo } from "@/lib/time";
import { OfferHelpDialog, ReportPostDialog, PollWidget } from "./post-card-actions";
import { MemberAvatar } from "@/components/tethyr/member-avatar";
import { skillKey, skillKeyMap } from "@/lib/skill-key";
import { postToneStyle, TONE_CHIP, TONE_TEXT } from "@/lib/post-tone";

const RESOURCE_ICON: Record<string, typeof FileText> = {
  Article: FileText,
  Video: Video,
  "GitHub Repo": Github,
  Template: LayoutTemplate,
  Book: BookMarked,
  Tool: Wrench,
};

/** A flair like "Update" on a Project update adds nothing the type tag hasn't said. */
export function flairRepeatsType(flair: string, typeLabel: string | undefined) {
  if (!typeLabel) return false;
  const f = flair.trim().toLowerCase();
  const label = typeLabel.toLowerCase();
  if (f === label) return true;
  // "Update" on "Project update", "Collab" on "Collaboration request".
  return f.length >= 3 && !f.includes(" ") && label.split(/\s+/).some((word) => word.startsWith(f));
}

/** Type colour as a text class, matching POST_TONE (lib/post-tone.ts). Used
 *  where a single label is coloured without a card (e.g. the landing feed). */
export const TYPE_ACCENT: Record<PostType, string> = {
  help_request: "text-[color-mix(in_oklab,var(--caution)_70%,var(--foreground))]",
  feedback_request: "text-[color-mix(in_oklab,var(--caution)_70%,var(--foreground))]",
  question: "text-learning",
  tutorial: "text-learning",
  resource: "text-learning",
  collaboration_request: "text-ai",
  open_role: "text-ai",
  lesson_learned: "text-ai",
  poll: "text-ai",
  showcase: "text-trust",
  project_update: "text-trust",
  progress_update: "text-trust",
  achievement: "text-trust",
  discussion: "text-muted-foreground",
};

export const TYPE_ICON: Record<PostType, typeof Heart> = {
  showcase: Rocket,
  question: HelpCircle,
  project_update: Zap,
  tutorial: BookOpen,
  resource: FileText,
  achievement: Trophy,
  discussion: MessageSquare,
  help_request: HandHeart,
  collaboration_request: Handshake,
  progress_update: Sparkles,
  lesson_learned: Lightbulb,
  feedback_request: MessageSquareMore,
  open_role: UserPlus,
  poll: BarChart3,
};

function HighlightText({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim()) return <>{text}</>;
  const q = query.trim();
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  const testRe = new RegExp(`^${escaped}$`, "i");
  return (
    <>
      {parts.map((part, i) =>
        testRe.test(part) ? (
          <mark key={i} className="rounded bg-primary/20 px-0.5 text-primary">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function PostCard({
  post,
  searchQuery,
  comments,
  showComments,
  onToggleComments,
  onDelete,
  onEdit,
  onToggleAction,
  highlighted,
  shared_from_space,
  skillOverlap,
  canModerate,
  reportCount,
  dimThreshold,
}: {
  post: PostWithAuthor;
  searchQuery?: string;
  comments: CommentRow[];
  showComments: boolean;
  onToggleComments: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onToggleAction?: (action: "like" | "helpful" | "save" | "offer") => void;
  highlighted?: boolean;
  shared_from_space?: string | null;
  skillOverlap?: number;
  /** Space owner/moderator — may remove posts in their space (moderation). */
  canModerate?: boolean;
  /** Number of open reports on this post (visible to the space's moderators). */
  reportCount?: number;
  /** Report count at which this post gets auto-dimmed (space setting). */
  dimThreshold?: number;
}) {
  const { data: me } = useCurrentUser();
  const { data: skillCatalog = [] } = useSkillsCatalog();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);

  const isOwner = me?.userId === post.author_id;
  const canModerateThis = canModerate && !isOwner;
  const reported = !!canModerateThis && (reportCount ?? 0) > 0;
  const autoDimmed = !!canModerateThis && (reportCount ?? 0) >= (dimThreshold ?? 3);
  const liked = post.myActions.includes("like");
  const helpful = post.myActions.includes("helpful");
  const offered = post.myActions.includes("offer");
  const isRequestType = post.type === "help_request" || post.type === "collaboration_request";
  const canReport = !!post.space_id && !isOwner;

  const authorName = post.author.display_name || post.author.handle || "Unknown";
  const authorTitle = post.author.creator_title || post.author.category || "Member";

  const questionData = post.question_data as Record<string, unknown> | null;
  const achievementData = post.achievement_data as Record<string, unknown> | null;
  const progressData = post.progress_data as Record<string, unknown> | null;
  const helpData = post.help_data as Record<string, unknown> | null;
  const collabData = post.collaboration_data as Record<string, unknown> | null;
  const projectData = post.project_data as Record<string, unknown> | null;
  const resourceData = post.resource_data as Record<string, unknown> | null;
  const pollData = post.poll_data as PollData | null;
  const feedbackTags = post.feedback_tags ?? [];

  // Skills in this post that the viewer is actively growing ("skills I'm
  // growing") — surfaces a "match" chip instead of the old empty constant.
  const learningSkills = skillKeyMap(
    skillCatalog.filter((s) => (me?.learnIds ?? []).includes(s.id)),
  );
  const matchedSkills = post.skills
    .filter((s) => learningSkills.has(skillKey(s)))
    .map((s) => learningSkills.get(skillKey(s)) ?? s);

  return (
    <article
      style={{
        ...postToneStyle(post.type),
        // A faint wash of the post's colour in the top corner.
        backgroundImage:
          "linear-gradient(135deg, color-mix(in oklab, var(--post-tone) 11%, transparent) 0%, transparent 48%)",
      }}
      className={`content-safe community-card min-w-0 border-l-[3px] border-l-[color-mix(in_oklab,var(--post-tone)_75%,transparent)] px-4 py-3.5 transition-lift duration-150 sm:px-5 sm:py-4 ${
        autoDimmed
          ? "opacity-70 saturate-50"
          : highlighted
            ? "ring-2 ring-[var(--user-accent,var(--ring))]/60"
            : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <MemberAvatar name={authorName} avatarPath={post.author.avatar_url} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <HoverCard>
              <HoverCardTrigger asChild>
                <Link
                  to="/u/$handle"
                  params={{ handle: post.author.handle ?? "unknown" }}
                  className="truncate text-sm font-medium hover:underline"
                  title={authorName}
                >
                  {authorName}
                </Link>
              </HoverCardTrigger>
              <HoverCardContent className="w-64" side="top">
                <div className="flex items-start gap-3">
                  <MemberAvatar name={authorName} avatarPath={post.author.avatar_url} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{authorName}</p>
                    <p className="text-xs text-muted-foreground">{authorTitle}</p>
                  </div>
                </div>
                <Link
                  to="/u/$handle"
                  params={{ handle: post.author.handle ?? "unknown" }}
                  className="mt-3 block w-full rounded-lg bg-surface-elevated py-1.5 text-center text-xs font-medium text-foreground transition-colors hover:bg-surface"
                >
                  View profile
                </Link>
              </HoverCardContent>
            </HoverCard>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>{authorTitle}</span>
            <span aria-hidden>·</span>
            {/* Type reads as data — mono tag + left accent bar */}
            <span
              className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${TONE_TEXT} ${TONE_CHIP}`}
            >
              {POST_TYPE_LABEL[post.type]}
            </span>
            {/* One type tag. The category pill and a flair that only repeats
                the type ("Project update" · "Projects" · "Update") said it thrice. */}
            {post.space_id && (
              <span className="rounded-full border border-ai/40 bg-ai/10 px-1.5 py-0 text-[11px] uppercase tracking-wider text-ai">
                Space
              </span>
            )}
            {post.flair && !flairRepeatsType(post.flair, POST_TYPE_LABEL[post.type]) && (
              <span
                className={`rounded-full border px-1.5 py-0 text-[11px] font-medium ${flairClasses(post.flair)}`}
              >
                {post.flair}
              </span>
            )}
            {reported && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                title={
                  autoDimmed
                    ? `${reportCount} open reports (auto-dimmed) — click to remove this post`
                    : "Reported by members — click to remove this post"
                }
                className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[11px] font-medium uppercase tracking-wider transition-colors ${
                  autoDimmed
                    ? "border-destructive/60 bg-destructive/20 text-destructive hover:bg-destructive/30"
                    : "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                }`}
              >
                <Flag className="h-2.5 w-2.5" />
                Reported{reportCount && reportCount > 1 ? ` (${reportCount})` : ""}
              </button>
            )}
            {shared_from_space && (
              <span className="rounded-full border border-learning/40 bg-learning/10 px-1.5 py-0 text-[11px] text-learning">
                Shared from {shared_from_space}
              </span>
            )}
            <span aria-hidden>·</span>
            <span className="mono flex items-center gap-1 text-[10px]">
              <Clock className="h-3 w-3" />
              {timeAgo(post.created_at)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isOwner && !canModerateThis && <FollowButton targetUserId={post.author_id} size="sm" />}
          {(isOwner || canModerateThis) && (
            <div className="flex items-center gap-1">
              {isOwner && (
                <button
                  type="button"
                  onClick={onEdit}
                  aria-label="Edit post"
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
                  title="Edit post"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {confirmDelete ? (
                <div className="flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1">
                  <span className="text-[11px] text-destructive">
                    {canModerateThis ? "Remove?" : "Delete?"}
                  </span>
                  <button
                    onClick={() => {
                      onDelete?.();
                      setConfirmDelete(false);
                    }}
                    className="text-[11px] font-semibold text-destructive hover:underline"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-[11px] text-muted-foreground hover:underline"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title={canModerateThis ? "Remove post (moderation)" : "Delete post"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Type-specific top strip */}
      {post.type === "question" && questionData && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!!questionData.solved && (
            <span className="inline-flex items-center gap-1 rounded-full border border-trust/40 bg-trust/10 px-2 py-0.5 text-[11px] font-medium text-trust">
              <CheckCircle2 className="h-3 w-3" /> Solved
            </span>
          )}
          {!!questionData.difficulty && (
            <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
              {`${questionData.difficulty}`}
            </span>
          )}
        </div>
      )}
      {post.type === "achievement" && achievementData && (
        <div className="mt-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-trust/40 bg-trust/10 px-2 py-0.5 text-[11px] font-medium text-trust">
            <Trophy className="h-3 w-3" /> {String(achievementData.milestone)}
          </span>
        </div>
      )}
      {post.type === "progress_update" && progressData && (
        <div className="mt-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-trust/40 bg-trust/10 px-2 py-0.5 text-[11px] font-medium text-trust">
            <Sparkles className="h-3 w-3" /> Progress in {String(progressData.skill)}
          </span>
        </div>
      )}
      {post.type === "help_request" && helpData && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            <HandHeart className="h-3 w-3" /> Needs help with {String(helpData.skill_needed)}
          </span>
          {!!helpData.difficulty && (
            <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
              {`${helpData.difficulty}`}
            </span>
          )}
        </div>
      )}
      {post.type === "collaboration_request" && collabData && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(collabData.roles_needed as string[] | undefined)?.map((role) => (
            <span
              key={role}
              className="inline-flex items-center gap-1 rounded-full border border-ai/40 bg-ai/10 px-2 py-0.5 text-[11px] font-medium text-ai"
            >
              <Handshake className="h-3 w-3" /> Looking for {role}
            </span>
          ))}
        </div>
      )}

      {/* Attached project */}
      {(post.project_id || post.project_snapshot) && (
        <div className="mt-3 border-l-2 border-trust/60 pl-3">
          <p className="section-label mb-1">Project context</p>
          <ProjectCardInline
            project_id={post.project_id}
            project_snapshot={post.project_snapshot}
          />
        </div>
      )}

      {/* Body — chat posts (space quick messages) have no title, so the
          message itself is the headline. */}
      {post.title && (
        <h3 className="font-display mt-3 text-base font-semibold leading-snug">
          <HighlightText text={post.title} query={searchQuery} />
        </h3>
      )}
      {post.link_url && (
        <a
          href={safeHref(post.link_url)}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-2 flex items-center gap-3 rounded-xl border card-border bg-background/40 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
            <Link2 className="h-4 w-4 text-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground group-hover:underline">
              {post.link_url.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {post.link_url}
            </span>
          </span>
        </a>
      )}
      <div className="prose-custom mt-1.5 text-sm text-foreground/90">
        <Markdown remarkPlugins={[remarkGfm]}>{post.body}</Markdown>
      </div>

      {!!questionData?.best_answer && (
        <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            Best answer
          </p>
          <p className="text-sm text-foreground/90">{String(questionData.best_answer)}</p>
        </div>
      )}

      {post.images && post.images.length > 0 && (
        <div
          className={`mt-3 grid gap-2 ${post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {post.images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Image ${i + 1}`}
              width="640"
              height="400"
              loading="lazy"
              decoding="async"
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
              className={`w-full rounded-lg border border-border/60 object-cover ${
                post.images!.length === 1 ? "aspect-video" : "aspect-square"
              }`}
            />
          ))}
        </div>
      )}

      {post.type === "project_update" &&
        projectData &&
        (() => {
          // Only what's real: an empty "0% · 0 contributors · 0 feedback notes"
          // block read as broken, not as progress.
          const progress = Number(projectData.progress ?? 0);
          const contributors = Number(projectData.contributors ?? 0);
          const feedback = Number(projectData.feedback ?? 0);
          if (progress <= 0 && contributors <= 0 && feedback <= 0) return null;
          return (
            <div className="mt-3 rounded-xl border border-border/60 bg-background/40 p-3">
              {progress > 0 && (
                <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span className="numeric">{progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
                    <div
                      className="h-full rounded-full bg-[var(--user-accent,var(--foreground))]"
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                </>
              )}
              {(contributors > 0 || feedback > 0) && (
                <div
                  className={`flex gap-4 text-xs text-muted-foreground ${progress > 0 ? "mt-2" : ""}`}
                >
                  {contributors > 0 && (
                    <span>
                      {contributors} contributor{contributors === 1 ? "" : "s"}
                    </span>
                  )}
                  {feedback > 0 && (
                    <span>
                      {feedback} feedback note{feedback === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })()}

      {post.type === "resource" && resourceData && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/60 bg-background/40 p-3 text-sm">
          {(() => {
            const Icon = RESOURCE_ICON[String(resourceData.kind)] ?? FileText;
            return <Icon className="h-4 w-4 text-ai" />;
          })()}
          <span className="text-muted-foreground">{String(resourceData.kind)}</span>
        </div>
      )}

      {post.type === "feedback_request" && feedbackTags.length > 0 && (
        <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <MessageSquareMore className="h-3.5 w-3.5" />
            Feedback requested on
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {feedbackTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-primary/30 bg-background/50 px-2.5 py-1 text-[11px] text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Poll display */}
      {post.type === "poll" && pollData && <PollWidget pollData={pollData} postId={post.id} />}

      {post.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {skillOverlap != null && skillOverlap > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] px-2 py-0.5 text-[11px] font-medium text-[var(--user-accent-text,var(--primary))]">
              <BadgeCheck className="h-3 w-3" />
              {skillOverlap} skill{skillOverlap !== 1 ? "s" : ""} you know
            </span>
          )}
          {matchedSkills.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-trust/40 bg-trust/10 px-2 py-0.5 text-[11px] font-medium text-trust">
              <BadgeCheck className="h-3 w-3" />
              {matchedSkills.length} skill{matchedSkills.length !== 1 ? "s" : ""} match
            </span>
          )}
          {post.skills.map((s) => (
            <span
              key={s}
              className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Actions — keep the response path calm; secondary actions live in More. */}
      <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <ActionButton
          icon={Heart}
          label="Appreciate"
          count={post.stats.likes}
          active={liked}
          activeClass="text-trust"
          onClick={() => onToggleAction?.("like")}
        />
        <ActionButton
          icon={MessageCircle}
          label="Discuss"
          count={post.stats.comment_count}
          active={showComments}
          activeClass="text-primary"
          onClick={onToggleComments}
        />
        <ActionButton
          icon={Bookmark}
          label="Save"
          count={post.stats.saves}
          active={post.myActions.includes("save")}
          activeClass="text-ai"
          onClick={() => onToggleAction?.("save")}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More post actions"
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-surface-elevated hover:text-foreground"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
              {/* Label drops on narrow columns so the action row stays one line. */}
              <span className="hidden @sm:inline">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onClick={() => onToggleAction?.("helpful")}>
              <ThumbsUp className="mr-2 h-3.5 w-3.5" />
              {helpful ? "Not helpful" : "Mark helpful"}
              {post.stats.helpful > 0 && (
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {post.stats.helpful}
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShareDialogOpen(true)}>
              <Share2 className="mr-2 h-3.5 w-3.5" />
              Share to a Space
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOfferOpen(true)} disabled={offered}>
              <HandHeart className="mr-2 h-3.5 w-3.5" />
              {offered ? "Help offered" : isRequestType ? "Offer to help" : "Offer help"}
              {post.stats.offers > 0 && (
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {post.stats.offers}
                </span>
              )}
            </DropdownMenuItem>
            {canReport && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setReportOpen(true)}>
                  <Flag className="mr-2 h-3.5 w-3.5" />
                  Report post
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showComments && (
        <CommentThreadInline
          postId={post.id}
          comments={comments}
          isQuestion={post.type === "question"}
        />
      )}

      <ShareSpaceDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        postId={post.id}
        currentSpaceId={post.space_id}
      />

      <OfferHelpDialog
        post={post}
        open={offerOpen}
        onOpenChange={setOfferOpen}
        onOffered={() => onToggleAction?.("offer")}
      />

      <ReportPostDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        postId={post.id}
        postTitle={post.title}
      />
    </article>
  );
}

function ActionButton({
  icon: Icon,
  label,
  count,
  active,
  activeClass,
  onClick,
}: {
  icon: typeof Heart;
  label: string;
  count: number;
  active?: boolean;
  activeClass?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-colors active:scale-95 hover:bg-surface-elevated hover:text-foreground ${
        active ? activeClass : ""
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${active ? "fill-current" : ""}`} />
      {label}
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}
