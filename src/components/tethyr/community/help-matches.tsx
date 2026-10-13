// "You could help": open asks from other people that need a skill you teach.
// Discovery that ends in an action (product rule 4) — one click offers help,
// the same `offer` toggle the post card's "Offer help" uses.
import { memo, type CSSProperties } from "react";
import { HandHeart, Check } from "lucide-react";
import type { PostWithAuthor } from "@/hooks/use-community";
import { POST_TYPE_LABEL } from "@/lib/community-data";
import { cn } from "@/lib/utils";
import { TONE_TEXT } from "@/lib/post-tone";
import { skillKey } from "@/lib/skill-key";

const ASK_TYPES = new Set([
  "help_request",
  "collaboration_request",
  "feedback_request",
  "question",
]);

/** Asks by others tagged with a skill I teach. `teachSkills` maps skill keys
 *  (skill-key.ts) to display names; matches come back as display names. */
export function findHelpMatches(
  posts: PostWithAuthor[],
  teachSkills: Map<string, string>,
  myId: string | null,
  limit = 3,
) {
  if (teachSkills.size === 0) return [];
  const matches: { post: PostWithAuthor; skills: string[] }[] = [];
  for (const post of posts) {
    if (!ASK_TYPES.has(post.type) || post.author_id === myId) continue;
    const skills = post.skills
      .map((skill) => teachSkills.get(skillKey(skill)))
      .filter((name): name is string => !!name);
    if (skills.length === 0) continue;
    matches.push({ post, skills });
    if (matches.length === limit) break;
  }
  return matches;
}

export const HelpMatches = memo(function HelpMatches({
  matches,
  onOffer,
  onOpen,
}: {
  matches: { post: PostWithAuthor; skills: string[] }[];
  onOffer: (postId: string) => void;
  onOpen: (postId: string) => void;
}) {
  if (matches.length === 0) return null;
  return (
    <section
      aria-labelledby="help-matches-title"
      style={{ "--post-tone": "var(--caution)" } as CSSProperties}
      className="community-card mb-6 border-[color-mix(in_oklab,var(--caution)_45%,var(--border))] bg-[color-mix(in_oklab,var(--caution)_8%,var(--card))] p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <HandHeart className={`h-4 w-4 ${TONE_TEXT}`} aria-hidden />
        <h2 id="help-matches-title" className="text-sm font-semibold">
          You could help
        </h2>
        <span className="text-xs text-muted-foreground">— asks that need what you teach</span>
      </div>
      <ul className="space-y-1.5">
        {matches.map(({ post, skills }) => {
          const offered = post.myActions.includes("offer");
          const name = post.author.display_name || post.author.handle || "Someone";
          return (
            <li
              key={post.id}
              className="flex items-center gap-3 rounded-lg border border-border/50 bg-card px-3 py-2.5"
            >
              <button
                type="button"
                onClick={() => onOpen(post.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-medium hover:underline">
                  {post.title || post.body.slice(0, 80)}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {name} · {POST_TYPE_LABEL[post.type]} ·{" "}
                  <span className={`font-medium ${TONE_TEXT}`}>{skills.join(", ")}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onOffer(post.id)}
                aria-pressed={offered}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  offered
                    ? "bg-surface-elevated text-muted-foreground"
                    : "bg-[var(--user-accent,var(--primary))] text-[var(--user-accent-foreground,var(--primary-foreground))] hover:opacity-90",
                )}
              >
                {offered ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden /> Offered
                  </>
                ) : (
                  "I can help"
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
});
