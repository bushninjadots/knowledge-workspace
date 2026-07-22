import { useState, useRef } from "react";
import {
  Rocket,
  HelpCircle,
  Link2,
  BookOpen,
  Trophy,
  HandHeart,
  Handshake,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QUICK_ACTIONS, type Post, type PostType } from "@/lib/community-data";
import { useCurrentUser } from "@/hooks/use-current-user";

const ACTION_ICON: Record<PostType, typeof Rocket> = {
  showcase: Rocket,
  question: HelpCircle,
  project_update: Rocket,
  tutorial: BookOpen,
  resource: Link2,
  achievement: Trophy,
  discussion: HelpCircle,
  help_request: HandHeart,
  collaboration_request: Handshake,
  progress_update: Sparkles,
};

const MAX_CHARS = 500;

function CharCount({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? current / max : 0;
  const r = 7;
  const circ = 2 * Math.PI * r;
  const offset = circ - pct * circ;
  const warn = pct > 0.85;

  return (
    <div className="relative h-5 w-5">
      <svg className="h-5 w-5 -rotate-90" viewBox="0 0 18 18">
        <circle
          cx="9"
          cy="9"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-border"
        />
        <circle
          cx="9"
          cy="9"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={warn ? "text-destructive" : "text-brand-green"}
        />
      </svg>
    </div>
  );
}

export function ComposerBar({ onPost }: { onPost: (post: Post) => void }) {
  const { data: me } = useCurrentUser();
  const [type, setType] = useState<PostType | null>(null);
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const name = me?.profile?.display_name || me?.profile?.handle || "You";
  const initial = name.charAt(0).toUpperCase();

  function submit() {
    const body = draft.trim();
    if (!body || !type) {
      if (!type) toast.info("Pick a post type above first");
      return;
    }
    onPost({
      id: `local-${Date.now()}`,
      type,
      author: {
        name,
        title: me?.profile?.creator_title || me?.profile?.category || "Tethyr creator",
        reputation: 0,
        badges: [],
        accent: "green",
      },
      community: me?.profile?.category || "General",
      skills: [],
      timestamp: "Just now",
      title: body.length > 80 ? `${body.slice(0, 77)}…` : body,
      body,
      stats: { likes: 0, helpful: 0, comments: 0, saves: 0, offers: 0 },
    });
    setDraft("");
    setType(null);
    toast.success("Posted to the community");
  }

  return (
    <div
      className={`card-border rounded-3xl border bg-surface p-5 sm:p-6 transition-shadow ${
        focused
          ? "shadow-[0_0_0_1px_oklch(0.92_0.23_142/20%),0_0_20px_-4px_oklch(0.92_0.23_142/15%)]"
          : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-green text-sm font-semibold text-background">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="What are you building or learning today?"
            rows={focused || draft.length > 80 ? 4 : 2}
            className="min-h-16 resize-none rounded-2xl border-border/60 bg-background/40 transition-all"
          />
          {focused && (
            <div className="mt-1.5 flex items-center justify-end gap-1.5">
              <CharCount current={draft.length} max={MAX_CHARS} />
              <span
                className={`text-[10px] tabular-nums ${draft.length > MAX_CHARS * 0.85 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {draft.length}/{MAX_CHARS}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {QUICK_ACTIONS.map((a) => {
          const Icon = ACTION_ICON[a.type];
          const active = type === a.type;
          return (
            <button
              key={a.type}
              onClick={() => setType(active ? null : a.type)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all active:scale-95 ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {a.label}
            </button>
          );
        })}
        <Button size="sm" className="ml-auto" onClick={submit} disabled={!draft.trim()}>
          Post
        </Button>
      </div>
    </div>
  );
}
