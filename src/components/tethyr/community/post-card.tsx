import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import {
  POST_TYPE_LABEL,
  flairClasses,
  type PostType,
  type CommentRow,
  type PostWithAuthor,
} from "@/lib/community-data";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { useCurrentUser, useSkillsCatalog } from "@/hooks/use-current-user";
import {
  useAddComment,
  useUpdateComment,
  useReportPost,
  useVotePoll,
  type PollData,
} from "@/hooks/use-community";
import { FollowButton } from "@/components/tethyr/follow-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProjectCardInline } from "@/components/tethyr/community/project-card-inline";
import { ShareSpaceDialog } from "@/components/tethyr/community/share-space-dialog";
import { timeAgo } from "@/lib/time";

const RESOURCE_ICON: Record<string, typeof FileText> = {
  Article: FileText,
  Video: Video,
  "GitHub Repo": Github,
  Template: LayoutTemplate,
  Book: BookMarked,
  Tool: Wrench,
};

export const TYPE_ACCENT: Record<PostType, string> = {
  showcase: "text-brand-green",
  question: "text-primary",
  project_update: "text-brand-green",
  tutorial: "text-brand-purple",
  resource: "text-brand-purple",
  achievement: "text-brand-green",
  discussion: "text-muted-foreground",
  help_request: "text-primary",
  collaboration_request: "text-brand-purple",
  progress_update: "text-brand-green",
  lesson_learned: "text-brand-purple",
  feedback_request: "text-primary",
  open_role: "text-brand-green",
  poll: "text-brand-purple",
};

const TYPE_BORDER: Record<PostType, string> = {
  showcase: "border-l-brand-green",
  question: "border-l-primary",
  project_update: "border-l-brand-green",
  tutorial: "border-l-brand-purple",
  resource: "border-l-brand-purple",
  achievement: "border-l-brand-green",
  discussion: "border-l-muted-foreground/40",
  help_request: "border-l-primary",
  collaboration_request: "border-l-brand-purple",
  progress_update: "border-l-brand-green",
  lesson_learned: "border-l-brand-purple",
  feedback_request: "border-l-primary",
  open_role: "border-l-brand-green",
  poll: "border-l-brand-purple",
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
  const initial = authorName.charAt(0).toUpperCase();

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
  const learningSkillNames = new Set(
    skillCatalog
      .filter((s) => (me?.learnIds ?? []).includes(s.id))
      .map((s) => s.name.toLowerCase()),
  );
  const matchedSkills = post.skills.filter((s) => learningSkillNames.has(s.toLowerCase()));

  return (
    <article
      className={`card-border border border-l-[3px] bg-surface px-4 py-3.5 sm:px-5 sm:py-4 transition-all duration-200 ${TYPE_BORDER[post.type]} ${
        autoDimmed
          ? "opacity-70 saturate-50"
          : highlighted
            ? "ring-2 ring-primary/50 shadow-[0_0_20px_rgba(var(--primary-rgb,59,130,246),0.3)]"
            : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-green text-sm font-semibold text-background">
          {initial}
        </div>
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-green text-sm font-semibold text-background">
                    {initial}
                  </div>
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
              className={`font-mono text-[10px] font-medium uppercase tracking-wider ${TYPE_ACCENT[post.type]}`}
            >
              {POST_TYPE_LABEL[post.type]}
            </span>
            {post.space_id ? (
              <span className="rounded-full border border-brand-purple/40 bg-brand-purple/10 px-1.5 py-0 text-[11px] uppercase tracking-wider text-brand-purple">
                Space
              </span>
            ) : (
              <span className="rounded-full border border-border/60 px-1.5 py-0 text-[11px] uppercase tracking-wider">
                {post.community}
              </span>
            )}
            {post.flair && (
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
              <span className="rounded-full border border-learning/40 bg-learning px-1.5 py-0 text-[11px] text-learning">
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
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/40 bg-brand-green/10 px-2 py-0.5 text-[11px] font-medium text-brand-green">
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
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/40 bg-brand-green/10 px-2 py-0.5 text-[11px] font-medium text-brand-green">
            <Trophy className="h-3 w-3" /> {String(achievementData.milestone)}
          </span>
        </div>
      )}
      {post.type === "progress_update" && progressData && (
        <div className="mt-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/40 bg-brand-green/10 px-2 py-0.5 text-[11px] font-medium text-brand-green">
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
              className="inline-flex items-center gap-1 rounded-full border border-brand-purple/40 bg-brand-purple/10 px-2 py-0.5 text-[11px] font-medium text-brand-purple"
            >
              <Handshake className="h-3 w-3" /> Looking for {role}
            </span>
          ))}
        </div>
      )}

      {/* Attached project */}
      {(post.project_id || post.project_snapshot) && (
        <div className="mt-3">
          <ProjectCardInline
            project_id={post.project_id}
            project_snapshot={post.project_snapshot}
          />
        </div>
      )}

      {/* Body — chat posts (space quick messages) have no title, so the
          message itself is the headline. */}
      {post.title && (
        <h3 className="font-title mt-3 text-base font-semibold leading-snug">
          <HighlightText text={post.title} query={searchQuery} />
        </h3>
      )}
      {post.link_url && (
        <a
          href={post.link_url}
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
              className="w-full rounded-xl border border-border/60 object-cover"
              style={{ maxHeight: post.images!.length === 1 ? "20rem" : "10rem" }}
            />
          ))}
        </div>
      )}

      {post.type === "project_update" && projectData && (
        <div className="mt-3 rounded-xl border border-border/60 bg-background/40 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{String(projectData.progress ?? 0)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
            <div
              className="h-full rounded-full bg-gradient-brand"
              style={{ width: `${Number(projectData.progress ?? 0)}%` }}
            />
          </div>
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span>{String(projectData.contributors ?? 0)} contributors</span>
            <span>{String(projectData.feedback ?? 0)} feedback notes</span>
          </div>
        </div>
      )}

      {post.type === "resource" && resourceData && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/60 bg-background/40 p-3 text-sm">
          {(() => {
            const Icon = RESOURCE_ICON[String(resourceData.kind)] ?? FileText;
            return <Icon className="h-4 w-4 text-brand-purple" />;
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
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] px-2 py-0.5 text-[11px] font-medium text-[var(--user-accent,var(--primary))]">
              <BadgeCheck className="h-3 w-3" />
              {skillOverlap} skill{skillOverlap !== 1 ? "s" : ""} you know
            </span>
          )}
          {matchedSkills.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/40 bg-brand-green/10 px-2 py-0.5 text-[11px] font-medium text-brand-green">
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

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <ActionButton
          icon={Heart}
          label="Appreciate"
          count={post.stats.likes}
          active={liked}
          activeClass="text-brand-green"
          onClick={() => onToggleAction?.("like")}
        />
        <ActionButton
          icon={ThumbsUp}
          label="Helpful"
          count={post.stats.helpful}
          active={helpful}
          activeClass="text-primary"
          onClick={() => onToggleAction?.("helpful")}
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
          activeClass="text-brand-purple"
          onClick={() => onToggleAction?.("save")}
        />
        <ActionButton
          icon={Share2}
          label="Share"
          count={0}
          onClick={() => setShareDialogOpen(true)}
        />
        {canReport && (
          <ActionButton
            icon={Flag}
            label="Report"
            count={0}
            activeClass="text-destructive"
            onClick={() => setReportOpen(true)}
          />
        )}
        <button
          onClick={() => setOfferOpen(true)}
          disabled={offered}
          className={`ml-auto flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium transition-all active:scale-95 ${
            isRequestType
              ? "border border-primary bg-primary/10 text-primary hover:bg-primary/20"
              : "hover:bg-surface-elevated hover:text-foreground"
          } ${offered ? "opacity-60" : ""}`}
        >
          <HandHeart className={`h-3.5 w-3.5 ${offered ? "fill-current" : ""}`} />
          {offered ? "Offered" : "Offer Help"}
          {post.stats.offers > 0 && <span className="tabular-nums">{post.stats.offers}</span>}
        </button>
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

function OfferHelpDialog({
  post,
  open,
  onOpenChange,
  onOffered,
}: {
  post: PostWithAuthor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOffered: () => void;
}) {
  const addComment = useAddComment();
  const isRequestType = post.type === "help_request" || post.type === "collaboration_request";
  const authorName = post.author.display_name || post.author.handle || "the author";
  // Help/collab posts already asked for a hand, so pre-fill a ready-to-send
  // offer the author can send immediately or edit. Other posts start empty.
  const [message, setMessage] = useState(() =>
    isRequestType ? "I can help with this — happy to jump in." : "",
  );

  async function submit() {
    try {
      // Record the offer (bumps the count + marks the post "Offered").
      onOffered();
      // Post the note as a comment so the author is notified and can respond.
      await addComment.mutateAsync({ postId: post.id, body: message.trim() });
      toast.success(`Offer sent to ${authorName}`);
      setMessage("");
      onOpenChange(false);
    } catch (err) {
      toast.error(friendlyError(err, "Couldn't send your offer"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Offer to help {authorName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Tell {authorName} how you can help. Your note is posted as a comment so they can reach
          back out.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 500))}
          placeholder="e.g. I can take a look at the onboarding flow and suggest fixes…"
          rows={4}
          maxLength={500}
          className="w-full rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
        />
        <div className="text-right text-[11px] text-muted-foreground">{message.length}/500</div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!message.trim() || addComment.isPending}>
            {addComment.isPending ? "Sending…" : "Send offer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportPostDialog({
  open,
  onOpenChange,
  postId,
  postTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postTitle: string;
}) {
  const reportPost = useReportPost();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  const REASONS = [
    "Breaks community rules",
    "Spam or self-promotion",
    "Harassment or hate",
    "Misinformation",
    "Off-topic",
    "Other",
  ];

  function friendlyError(err: unknown) {
    const msg = (err as Error)?.message ?? "";
    if (msg.toLowerCase().includes("rate_limit")) {
      return "You've filed too many reports recently — please wait a bit before reporting again.";
    }
    return `Failed to report: ${msg}`;
  }

  function submit() {
    if (!reason.trim()) {
      toast.error("Pick a reason");
      return;
    }
    reportPost.mutate(
      { postId, reason: reason.trim(), details },
      {
        onSuccess: () => {
          toast.success("Reported — the space moderators will review it");
          onOpenChange(false);
          setReason("");
          setDetails("");
        },
        onError: (err) => toast.error(friendlyError(err)),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this post</DialogTitle>
        </DialogHeader>
        <p className="line-clamp-2 text-xs text-muted-foreground" title={postTitle}>
          “{postTitle}”
        </p>
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  reason === r
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-border bg-background/40 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 500))}
            placeholder="Anything else the moderators should know? (optional)"
            rows={3}
            className="w-full rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={!reason.trim() || reportPost.isPending}
          >
            {reportPost.isPending ? "Reporting..." : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommentThreadInline({
  postId,
  comments,
  isQuestion,
}: {
  postId: string;
  comments: CommentRow[];
  isQuestion: boolean;
}) {
  // Build a reply tree: top-level comments first, replies nested under their
  // parent, each level chronologically ordered. Cap the visible tree so long
  // threads stay readable.
  const tree = useMemo(() => {
    const byParent = new Map<string | null, CommentRow[]>();
    for (const c of comments) {
      const key = c.parent_id ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(c);
    }
    const sortChrono = (list: CommentRow[]) =>
      [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const top = sortChrono(byParent.get(null) ?? []);
    const children = (id: string) => sortChrono(byParent.get(id) ?? []);
    return { top, children };
  }, [comments]);

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <p className="text-xs text-muted-foreground">
        {comments.length} comment{comments.length !== 1 ? "s" : ""}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {tree.top.slice(0, 5).map((c) => (
          <CommentNode
            key={c.id}
            comment={c}
            depth={0}
            childrenOf={tree.children}
            isQuestion={isQuestion}
            postId={postId}
          />
        ))}

        <CommentComposer postId={postId} />
      </div>
    </div>
  );
}

function CommentNode({
  comment,
  depth,
  childrenOf,
  isQuestion,
  postId,
}: {
  comment: CommentRow;
  depth: number;
  childrenOf: (id: string) => CommentRow[];
  isQuestion: boolean;
  postId: string;
}) {
  const { data: me } = useCurrentUser();
  const canEdit = comment.author_id === me?.userId;
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const name = comment.author?.display_name || comment.author?.handle || "Unknown";
  const initial = name.charAt(0).toUpperCase();
  const children = childrenOf(comment.id);

  return (
    <div
      className={`rounded-xl p-3 ${
        comment.is_best_answer
          ? "border border-brand-green/30 bg-brand-green/5"
          : "bg-background/40"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-green/80 text-[11px] font-semibold text-background">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="text-xs font-medium">{name}</span>
            <span className="text-[11px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
          </div>
          {editing ? (
            <CommentEditor
              commentId={comment.id}
              postId={postId}
              initialBody={comment.body}
              onCancel={() => setEditing(false)}
              onSaved={() => setEditing(false)}
            />
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{comment.body}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {isQuestion && comment.is_best_answer && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-brand-green">
                <CheckCircle2 className="h-3 w-3" />
                Best answer
              </span>
            )}
            <button
              onClick={() => setReplying((v) => !v)}
              className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {replying ? "Cancel" : "Reply"}
            </button>
            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                Edit
              </button>
            )}
          </div>
          {replying && <CommentComposer postId={postId} parentId={comment.id} autoFocus />}
        </div>
      </div>

      {children.length > 0 && depth < 3 && (
        <div className="mt-2 space-y-2 border-l-2 border-border/50 pl-3">
          {children.slice(0, 5).map((child) => (
            <CommentNode
              key={child.id}
              comment={child}
              depth={depth + 1}
              childrenOf={childrenOf}
              isQuestion={isQuestion}
              postId={postId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentEditor({
  commentId,
  postId,
  initialBody,
  onCancel,
  onSaved,
}: {
  commentId: string;
  postId: string;
  initialBody: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const updateComment = useUpdateComment();
  const [text, setText] = useState(initialBody);

  function save() {
    const body = text.trim();
    if (!body) return;
    updateComment.mutate(
      { commentId, postId, body },
      {
        onSuccess: onSaved,
        onError: () => toast.error("Failed to update comment"),
      },
    );
  }

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 2000))}
        rows={3}
        autoFocus
        className="w-full resize-y rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={!text.trim() || updateComment.isPending}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          {updateComment.isPending ? "..." : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-border bg-background/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CommentComposer({
  postId,
  parentId,
  autoFocus,
}: {
  postId: string;
  parentId?: string | null;
  autoFocus?: boolean;
}) {
  const addComment = useAddComment();
  const [newComment, setNewComment] = useState("");

  function submitComment() {
    const body = newComment.trim();
    if (!body) return;
    addComment.mutate(
      { postId, body, parentId },
      {
        onSuccess: () => setNewComment(""),
        onError: () => toast.error("Couldn't post your comment — please try again"),
      },
    );
  }

  return (
    <div className="mt-1 flex items-start gap-2.5">
      <input
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitComment();
          }
        }}
        placeholder={parentId ? "Write a reply..." : "Write a comment..."}
        autoFocus={autoFocus}
        className="flex-1 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
      />
      <button
        onClick={submitComment}
        disabled={!newComment.trim() || addComment.isPending}
        className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
      >
        {addComment.isPending ? "..." : "Reply"}
      </button>
    </div>
  );
}

function PollWidget({ pollData, postId }: { pollData: PollData; postId: string }) {
  const { data: me } = useCurrentUser();
  const votePoll = useVotePoll();
  const myVote = pollData.votes?.find((v) => v.user_id === me?.userId) ?? null;
  const totalVotes = pollData.votes?.length ?? 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!pollData.ends_at) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [pollData.ends_at]);
  const hasEnded = !!pollData.ends_at && new Date(pollData.ends_at).getTime() <= now;

  function handleVote(optionIndex: number) {
    if (myVote || votePoll.isPending || !me?.userId || hasEnded) return;
    votePoll.mutate(
      { postId, optionIndex, userId: me.userId },
      {
        onError: (err) => toast.error(friendlyError(err, "Failed to vote")),
      },
    );
  }

  return (
    <div className="mt-3 rounded-xl border card-border bg-background/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-brand-purple" />
        <p className="text-sm font-semibold">{pollData.question}</p>
      </div>
      <div className="space-y-2">
        {pollData.options.map((option, i) => {
          const optionVotes = pollData.votes?.filter((v) => v.option_index === i).length ?? 0;
          const pct = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
          const isVoted = myVote?.option_index === i;
          return (
            <button
              key={i}
              onClick={() => handleVote(i)}
              disabled={!!myVote || votePoll.isPending || hasEnded}
              className={`group relative w-full rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                isVoted
                  ? "border-brand-purple/40 bg-brand-purple/10 text-brand-purple"
                  : myVote
                    ? "border-border/60 bg-background/40 text-muted-foreground"
                    : "border-border/60 bg-background/40 text-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-[var(--user-accent-subtle,var(--surface-elevated))]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{option}</span>
                {myVote && (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {pct}%
                  </span>
                )}
              </div>
              {myVote && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
                  <div
                    className="h-full rounded-full bg-brand-purple/40 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
        </span>
        {pollData.ends_at && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {hasEnded ? "Ended" : `Ends ${new Date(pollData.ends_at).toLocaleDateString()}`}
          </span>
        )}
      </div>
    </div>
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
      className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-all active:scale-95 hover:bg-surface-elevated hover:text-foreground ${
        active ? activeClass : ""
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${active ? "fill-current" : ""}`} />
      {label}
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}
