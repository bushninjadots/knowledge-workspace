import { memo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { timeAgo } from "@/lib/time";
import { useComments, type PostWithAuthor } from "@/hooks/use-community";
import { CommentThreadInline } from "@/components/tethyr/community/post-card";

/**
 * Compact chat row for a space's quick messages (posts with no title created
 * from the space chat composer). Shows the message like a chat line — avatar,
 * name, time, and the text — with a threaded reply count to open the
 * conversation underneath. Structured posts (showcase, question, …) keep
 * rendering as full cards.
 */
export const SpaceChatMessage = memo(function SpaceChatMessage({
  post,
  defaultOpenComments = false,
}: {
  post: PostWithAuthor;
  defaultOpenComments?: boolean;
}) {
  const [showComments, setShowComments] = useState(defaultOpenComments);
  const { data: comments = [] } = useComments(showComments ? post.id : "");

  const authorName = post.author.display_name || post.author.handle || "Unknown";
  const initial = authorName.charAt(0).toUpperCase();

  return (
    <article
      id={`post-${post.id}`}
      className="card-border border bg-surface px-4 py-3 transition-colors hover:bg-surface-elevated/40 sm:px-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-green text-xs font-semibold text-background">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link
              to="/u/$handle"
              params={{ handle: post.author.handle ?? "unknown" }}
              className="text-sm font-medium hover:underline"
            >
              {authorName}
            </Link>
            <span className="text-[11px] text-muted-foreground">{timeAgo(post.created_at)}</span>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
            {post.body}
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors ${
                showComments
                  ? "bg-surface-elevated font-medium text-foreground"
                  : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {post.stats.comment_count > 0 ? post.stats.comment_count : "Reply"}
              {post.stats.comment_count > 0 && (
                <span className="text-muted-foreground">
                  {post.stats.comment_count === 1 ? "reply" : "replies"}
                </span>
              )}
            </button>
          </div>
          {showComments && (
            <div className="mt-2">
              <CommentThreadInline
                postId={post.id}
                comments={comments}
                isQuestion={post.type === "question"}
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
});
