import { useState } from "react";
import { Link } from "@tanstack/react-router";
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
} from "lucide-react";
import { toast } from "sonner";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  POST_TYPE_LABEL,
  PROJECT_JOURNEY_STAGES,
  reputationLabel,
  ACTIVE_LEARNING_GOALS,
  type Comment,
  type Post,
  type PostStats,
  type ProjectJourneyStage,
} from "@/lib/community-data";
import { ReputationBadgePill, SkillBadge } from "./badges";
import { CommentThread } from "./comment-thread";
import { useCurrentUser } from "@/hooks/use-current-user";

const RESOURCE_ICON = {
  Article: FileText,
  Video: Video,
  "GitHub Repo": Github,
  Template: LayoutTemplate,
  Book: BookMarked,
  Tool: Wrench,
};

const TYPE_ACCENT: Record<Post["type"], string> = {
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
};

const TYPE_BORDER: Record<Post["type"], string> = {
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
};

const TYPE_ICON: Record<Post["type"], typeof Heart> = {
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
};

function coverClasses(gradient: "brand" | "green" | "purple") {
  if (gradient === "green") {
    return "bg-[linear-gradient(135deg,color-mix(in_oklab,var(--brand-green)_55%,transparent),color-mix(in_oklab,var(--brand-purple)_15%,transparent))]";
  }
  if (gradient === "purple") {
    return "bg-[linear-gradient(135deg,color-mix(in_oklab,var(--brand-purple)_55%,transparent),color-mix(in_oklab,var(--brand-green)_15%,transparent))]";
  }
  return "bg-[linear-gradient(135deg,color-mix(in_oklab,var(--brand-green)_35%,transparent),color-mix(in_oklab,var(--brand-purple)_35%,transparent))]";
}

function JourneyStepper({ stage }: { stage: ProjectJourneyStage }) {
  const currentIndex = PROJECT_JOURNEY_STAGES.indexOf(stage);
  return (
    <div className="flex items-center gap-1">
      {PROJECT_JOURNEY_STAGES.map((s, i) => (
        <div key={s} className="flex flex-1 items-center gap-1">
          <div
            className={`h-1.5 flex-1 rounded-full ${
              i <= currentIndex ? "bg-gradient-brand" : "bg-surface-elevated"
            }`}
            title={s}
          />
        </div>
      ))}
    </div>
  );
}

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

export function PostCard({
  post,
  saved,
  onToggleSave,
  searchQuery,
  comments,
  onCommentsChange,
  showComments,
  onToggleComments,
  onDelete,
  onEdit,
}: {
  post: Post;
  saved: boolean;
  onToggleSave: () => void;
  searchQuery?: string;
  comments: Comment[];
  onCommentsChange: (comments: Comment[]) => void;
  showComments: boolean;
  onToggleComments: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  const { data: me } = useCurrentUser();
  const [stats, setStats] = useState<PostStats>(post.stats);
  const [appreciated, setAppreciated] = useState(false);
  const [markedHelpful, setMarkedHelpful] = useState(false);
  const [offered, setOffered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOwner =
    me?.profile?.display_name === post.author.name || me?.profile?.handle === post.author.name;

  const matchedSkills = post.skills.filter((s) =>
    ACTIVE_LEARNING_GOALS.some((g) => g.toLowerCase() === s.toLowerCase()),
  );

  function toggleAppreciate() {
    setAppreciated((v) => !v);
    setStats((s) => ({ ...s, likes: s.likes + (appreciated ? -1 : 1) }));
  }
  function toggleHelpful() {
    setMarkedHelpful((v) => !v);
    setStats((s) => ({ ...s, helpful: s.helpful + (markedHelpful ? -1 : 1) }));
  }
  function toggleSave() {
    setStats((s) => ({ ...s, saves: s.saves + (saved ? -1 : 1) }));
    onToggleSave();
    toast.success(saved ? "Removed from saved" : "Saved for later");
  }
  function offerHelp() {
    if (offered) return;
    setOffered(true);
    setStats((s) => ({ ...s, offers: s.offers + 1 }));
    toast.success("They'll see that you offered to help");
  }

  const initial = post.author.name.charAt(0).toUpperCase();
  const avatarBg =
    post.author.accent === "green"
      ? "bg-brand-green text-background"
      : "bg-brand-purple text-background";
  const isRequestType = post.type === "help_request" || post.type === "collaboration_request";

  return (
    <article
      className={`card-border rounded-3xl border border-l-[3px] bg-surface p-5 sm:p-6 ${TYPE_BORDER[post.type]}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${avatarBg}`}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <HoverCard>
              <HoverCardTrigger asChild>
                <Link to="/profile" className="truncate text-sm font-medium hover:underline">
                  {post.author.name}
                </Link>
              </HoverCardTrigger>
              <HoverCardContent className="w-64" side="top">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${avatarBg}`}
                  >
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{post.author.name}</p>
                    <p className="text-xs text-muted-foreground">{post.author.title}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs font-semibold text-brand-green">
                        {reputationLabel(post.author.reputation)}
                      </span>
                      {post.author.badges.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <BadgeCheck className="h-3 w-3" />
                          {post.author.badges.length} badge
                          {post.author.badges.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Link
                  to="/profile"
                  className="mt-3 block w-full rounded-lg bg-surface-elevated py-1.5 text-center text-xs font-medium text-foreground transition-colors hover:bg-surface"
                >
                  View profile
                </Link>
              </HoverCardContent>
            </HoverCard>
            <span className="text-xs text-muted-foreground">
              {reputationLabel(post.author.reputation)}
            </span>
            {post.author.badges.map((b) => (
              <ReputationBadgePill key={b} badge={b} />
            ))}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>{post.author.title}</span>
            <span aria-hidden>·</span>
            <span className="rounded-full border border-border/60 px-1.5 py-0 text-[10px] uppercase tracking-wider">
              {post.community}
            </span>
            <span aria-hidden>·</span>
            <span>{post.timestamp}</span>
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
      {post.type === "question" && post.question && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {post.question.solved && (
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/40 bg-brand-green/10 px-2 py-0.5 text-[11px] font-medium text-brand-green">
              <CheckCircle2 className="h-3 w-3" /> Solved
            </span>
          )}
          <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
            {post.question.difficulty}
          </span>
        </div>
      )}
      {post.type === "achievement" && post.achievement && (
        <div className="mt-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/40 bg-brand-green/10 px-2 py-0.5 text-[11px] font-medium text-brand-green">
            <Trophy className="h-3 w-3" /> {post.achievement.milestone}
          </span>
        </div>
      )}
      {post.type === "progress_update" && post.progress && (
        <div className="mt-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/40 bg-brand-green/10 px-2 py-0.5 text-[11px] font-medium text-brand-green">
            <Sparkles className="h-3 w-3" /> Progress in {post.progress.skill}
          </span>
        </div>
      )}
      {post.type === "help_request" && post.helpRequest && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            <HandHeart className="h-3 w-3" /> Needs help with {post.helpRequest.skillNeeded}
          </span>
          <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
            {post.helpRequest.difficulty}
          </span>
        </div>
      )}
      {post.type === "collaboration_request" && post.collaboration && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {post.collaboration.rolesNeeded.map((role) => (
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
      <p className="mt-1.5 text-sm text-foreground/90">
        <HighlightText text={post.body} query={searchQuery} />
      </p>

      {post.code && (
        <div className="relative mt-3">
          <pre className="overflow-x-auto rounded-2xl border border-border/60 bg-background/60 p-3 text-xs scrollbar-none">
            <code>{post.code.snippet}</code>
          </pre>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent rounded-r-2xl" />
        </div>
      )}

      {post.question?.bestAnswer && (
        <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            Best answer
          </p>
          <p className="text-sm text-foreground/90">{post.question.bestAnswer}</p>
        </div>
      )}

      {post.cover && (
        <div
          className={`mt-3 flex h-36 items-end rounded-2xl p-4 ${coverClasses(post.cover.gradient)}`}
        >
          <p className="font-display text-sm font-semibold text-background/90">
            {post.cover.label}
          </p>
        </div>
      )}

      {post.type === "project_update" && post.project && (
        <div className="mt-3 rounded-2xl border border-border/60 bg-background/40 p-3">
          {post.project.journeyStage && (
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Project journal</span>
                <span className="font-medium text-foreground">{post.project.journeyStage}</span>
              </div>
              <JourneyStepper stage={post.project.journeyStage} />
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{post.project.progress}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
            <div
              className="h-full rounded-full bg-gradient-brand"
              style={{ width: `${post.project.progress}%` }}
            />
          </div>
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span>{post.project.contributors} contributors</span>
            <span>{post.project.feedback} feedback notes</span>
          </div>
        </div>
      )}

      {post.type === "resource" && post.resource && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border/60 bg-background/40 p-3 text-sm">
          {(() => {
            const Icon = RESOURCE_ICON[post.resource.kind];
            return <Icon className="h-4 w-4 text-brand-purple" />;
          })()}
          <span className="text-muted-foreground">{post.resource.kind}</span>
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
            <SkillBadge key={s} label={s} />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <ActionButton
          icon={Heart}
          label="Appreciate"
          count={stats.likes}
          active={appreciated}
          activeClass="text-brand-green"
          onClick={toggleAppreciate}
        />
        <ActionButton
          icon={ThumbsUp}
          label="Helpful"
          count={stats.helpful}
          active={markedHelpful}
          activeClass="text-primary"
          onClick={toggleHelpful}
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
          count={stats.saves}
          active={saved}
          activeClass="text-brand-purple"
          onClick={toggleSave}
        />
        <button
          onClick={offerHelp}
          disabled={offered}
          className={`ml-auto flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium transition-all active:scale-95 ${
            isRequestType
              ? "border border-primary bg-primary/10 text-primary hover:bg-primary/20"
              : "hover:bg-surface-elevated hover:text-foreground"
          } ${offered ? "opacity-60" : ""}`}
        >
          <HandHeart className={`h-3.5 w-3.5 ${offered ? "fill-current" : ""}`} />
          {offered ? "Offered" : "Offer Help"}
          <span className="tabular-nums">{stats.offers}</span>
        </button>
      </div>

      {showComments && (
        <CommentThread post={post} comments={comments} onCommentsChange={onCommentsChange} />
      )}
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
