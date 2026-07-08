import { useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import {
  POST_TYPE_LABEL,
  PROJECT_JOURNEY_STAGES,
  reputationLabel,
  type Post,
  type PostStats,
  type ProjectJourneyStage,
} from "@/lib/community-data";
import { ReputationBadgePill, SkillBadge } from "./badges";

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

export function PostCard({
  post,
  saved,
  onToggleSave,
}: {
  post: Post;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const [stats, setStats] = useState<PostStats>(post.stats);
  const [appreciated, setAppreciated] = useState(false);
  const [markedHelpful, setMarkedHelpful] = useState(false);
  const [offered, setOffered] = useState(false);

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
  const avatarBg = post.author.accent === "green" ? "bg-brand-green text-background" : "bg-brand-purple text-background";
  const isRequestType = post.type === "help_request" || post.type === "collaboration_request";

  return (
    <article className="card-border rounded-3xl border bg-surface p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${avatarBg}`}>
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-medium">{post.author.name}</p>
            <span className="text-xs text-muted-foreground">{reputationLabel(post.author.reputation)}</span>
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
        <span className={`shrink-0 text-[11px] font-semibold uppercase tracking-wider ${TYPE_ACCENT[post.type]}`}>
          {POST_TYPE_LABEL[post.type]}
        </span>
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
      <h3 className="mt-3 text-base font-semibold leading-snug">{post.title}</h3>
      <p className="mt-1.5 text-sm text-foreground/90">{post.body}</p>

      {post.code && (
        <pre className="mt-3 overflow-x-auto rounded-2xl border border-border/60 bg-background/60 p-3 text-xs">
          <code>{post.code.snippet}</code>
        </pre>
      )}

      {post.question?.bestAnswer && (
        <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-primary">Best answer</p>
          <p className="text-sm text-foreground/90">{post.question.bestAnswer}</p>
        </div>
      )}

      {post.cover && (
        <div
          className={`mt-3 flex h-36 items-end rounded-2xl p-4 ${coverClasses(post.cover.gradient)}`}
        >
          <p className="font-display text-sm font-semibold text-background/90">{post.cover.label}</p>
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
        <div className="mt-3 flex flex-wrap gap-1.5">
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
        <ActionButton icon={MessageCircle} label="Discuss" count={stats.comments} onClick={() => toast.info("Comments coming soon")} />
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
          className={`ml-auto flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium transition-colors ${
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
      className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-surface-elevated hover:text-foreground ${
        active ? activeClass : ""
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${active ? "fill-current" : ""}`} />
      {label}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
