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
} from "lucide-react";
import { toast } from "sonner";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  POST_TYPE_LABEL,
  ACTIVE_LEARNING_GOALS,
  type PostType,
  type CommentRow,
  type PostWithAuthor,
} from "@/lib/community-data";
import { useCurrentUser } from "@/hooks/use-current-user";

const RESOURCE_ICON: Record<string, typeof FileText> = {
  Article: FileText,
  Video: Video,
  "GitHub Repo": Github,
  Template: LayoutTemplate,
  Book: BookMarked,
  Tool: Wrench,
};

const TYPE_ACCENT: Record<PostType, string> = {
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
};

const TYPE_ICON: Record<PostType, typeof Heart> = {
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
};

function HighlightText({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim()) return <>{text}</>;
  const q = query.trim();
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
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

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function PostCard({
  post,
  saved,
  onToggleSave,
  searchQuery,
  comments,
  showComments,
  onToggleComments,
  onDelete,
  onEdit,
  onToggleAction,
  currentUserId,
}: {
  post: PostWithAuthor;
  saved: boolean;
  onToggleSave: () => void;
  searchQuery?: string;
  comments: CommentRow[];
  showComments: boolean;
  onToggleComments: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onToggleAction?: (action: "like" | "helpful" | "offer") => void;
  currentUserId?: string;
}) {
  const { data: me } = useCurrentUser();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOwner = me?.userId === post.author_id;
  const liked = post.myActions.includes("like");
  const helpful = post.myActions.includes("helpful");
  const offered = post.myActions.includes("offer");
  const isRequestType = post.type === "help_request" || post.type === "collaboration_request";

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

  const matchedSkills = post.skills.filter((s) =>
    ACTIVE_LEARNING_GOALS.some((g) => g.toLowerCase() === s.toLowerCase()),
  );

  return (
    <article
      className={`card-border rounded-3xl border border-l-[3px] bg-surface p-5 sm:p-6 ${TYPE_BORDER[post.type]}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-green text-sm font-semibold text-background">
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
            <span className="rounded-full border border-border/60 px-1.5 py-0 text-[10px] uppercase tracking-wider">
              {post.community}
            </span>
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(post.created_at)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isOwner && (
            <div className="flex items-center gap-1">
              <button
                onClick={onEdit}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
                title="Edit post"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {confirmDelete ? (
                <div className="flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1">
                  <span className="text-[10px] text-destructive">Delete?</span>
                  <button
                    onClick={() => {
                      onDelete?.();
                      setConfirmDelete(false);
                    }}
                    className="text-[10px] font-semibold text-destructive hover:underline"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-[10px] text-muted-foreground hover:underline"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="Delete post"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          <span
            className={`flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider ${TYPE_ACCENT[post.type]}`}
          >
            {(() => {
              const TypeIcon = TYPE_ICON[post.type];
              return <TypeIcon className="h-3 w-3" />;
            })()}
            {POST_TYPE_LABEL[post.type]}
          </span>
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

      {/* Body */}
      <h3 className="mt-3 text-base font-semibold leading-snug">
        <HighlightText text={post.title} query={searchQuery} />
      </h3>
      <div className="prose-custom mt-1.5 text-sm text-foreground/90">
        <Markdown remarkPlugins={[remarkGfm]}>{post.body}</Markdown>
      </div>

      {!!questionData?.best_answer && (
        <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
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
              className="w-full rounded-2xl border border-border/60 object-cover"
              style={{ maxHeight: post.images!.length === 1 ? "20rem" : "10rem" }}
            />
          ))}
        </div>
      )}

      {post.type === "project_update" && projectData && (
        <div className="mt-3 rounded-2xl border border-border/60 bg-background/40 p-3">
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
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border/60 bg-background/40 p-3 text-sm">
          {(() => {
            const Icon = RESOURCE_ICON[String(resourceData.kind)] ?? FileText;
            return <Icon className="h-4 w-4 text-brand-purple" />;
          })()}
          <span className="text-muted-foreground">{String(resourceData.kind)}</span>
        </div>
      )}

      {post.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
          count={comments.length}
          active={showComments}
          activeClass="text-primary"
          onClick={onToggleComments}
        />
        <ActionButton
          icon={Bookmark}
          label="Save"
          count={post.stats.saves}
          active={saved}
          activeClass="text-brand-purple"
          onClick={onToggleSave}
        />
        <button
          onClick={() => onToggleAction?.("offer")}
          disabled={offered}
          className={`ml-auto flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium transition-all active:scale-95 ${
            isRequestType
              ? "border border-primary bg-primary/10 text-primary hover:bg-primary/20"
              : "hover:bg-surface-elevated hover:text-foreground"
          } ${offered ? "opacity-60" : ""}`}
        >
          <HandHeart className={`h-3.5 w-3.5 ${offered ? "fill-current" : ""}`} />
          {offered ? "Offered" : "Offer Help"}
          <span className="tabular-nums">{post.stats.offers}</span>
        </button>
      </div>

      {showComments && (
        <CommentThreadInline
          postId={post.id}
          comments={comments}
          isQuestion={post.type === "question"}
        />
      )}
    </article>
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
  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <p className="text-xs text-muted-foreground">
        {comments.length} comment{comments.length !== 1 ? "s" : ""}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {comments.slice(0, 5).map((c) => {
          const name = c.author?.display_name || c.author?.handle || "Unknown";
          const initial = name.charAt(0).toUpperCase();
          return (
            <div
              key={c.id}
              className={`rounded-xl p-3 ${
                c.is_best_answer
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
                    <span className="text-[10px] text-muted-foreground">
                      {timeAgo(c.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground/90">{c.body}</p>
                  {isQuestion && c.is_best_answer && (
                    <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-brand-green">
                      <CheckCircle2 className="h-3 w-3" />
                      Best answer
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
