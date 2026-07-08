import { useState } from "react";
import { Rocket, HelpCircle, Link2, BookOpen, Trophy, HandHeart, Handshake, Sparkles } from "lucide-react";
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

export function ComposerBar({ onPost }: { onPost: (post: Post) => void }) {
  const { data: me } = useCurrentUser();
  const [type, setType] = useState<PostType | null>(null);
  const [draft, setDraft] = useState("");

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
    <div className="card-border rounded-3xl border bg-surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-green text-sm font-semibold text-background">
          {initial}
        </div>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 500))}
          placeholder="What are you building or learning today?"
          rows={2}
          className="min-h-16 resize-none rounded-2xl border-border/60 bg-background/40"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {QUICK_ACTIONS.map((a) => {
          const Icon = ACTION_ICON[a.type];
          const active = type === a.type;
          return (
            <button
              key={a.type}
              onClick={() => setType(active ? null : a.type)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
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
