// A one-line read of how alive the community is right now, built only from
// posts the feed already loaded: posts and people in the last day, and help
// requests nobody has replied to yet (the most useful thing to act on).
import { memo, useMemo } from "react";
import { HandHeart } from "lucide-react";
import type { PostWithAuthor } from "@/hooks/use-community";
import type { CommunityNavId } from "@/data/mocks/community-nav";

const DAY_MS = 24 * 60 * 60 * 1000;

export function summarizePulse(posts: PostWithAuthor[], now = Date.now()) {
  const recent = posts.filter((post) => now - new Date(post.created_at).getTime() < DAY_MS);
  const people = new Set(recent.map((post) => post.author_id)).size;
  const unanswered = posts.filter(
    (post) => post.type === "help_request" && post.stats.comment_count === 0,
  ).length;
  return { postsToday: recent.length, people, unanswered };
}

export const CommunityPulse = memo(function CommunityPulse({
  posts,
  onNavChange,
}: {
  posts: PostWithAuthor[];
  onNavChange: (nav: CommunityNavId) => void;
}) {
  const { postsToday, people, unanswered } = useMemo(() => summarizePulse(posts), [posts]);
  if (posts.length === 0) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <span className="relative flex h-2 w-2" aria-hidden>
          {postsToday > 0 && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--user-accent,var(--trust))] opacity-60 motion-safe:animate-ping" />
          )}
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--user-accent,var(--trust))]" />
        </span>
        {postsToday > 0 ? (
          <span>
            <span className="numeric font-medium text-foreground">{postsToday}</span> post
            {postsToday === 1 ? "" : "s"} from{" "}
            <span className="numeric font-medium text-foreground">{people}</span>{" "}
            {people === 1 ? "person" : "people"} today
          </span>
        ) : (
          <span>Quiet today — a good moment to share what you're building</span>
        )}
      </span>
      {unanswered > 0 && (
        <button
          type="button"
          onClick={() => onNavChange("help")}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface/70 px-2.5 py-1 transition-colors hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
        >
          <HandHeart className="h-3.5 w-3.5" aria-hidden />
          <span className="numeric font-medium text-foreground">{unanswered}</span>
          help {unanswered === 1 ? "request has" : "requests have"} no reply yet
        </button>
      )}
    </div>
  );
});
