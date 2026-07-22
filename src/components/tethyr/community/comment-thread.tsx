import { useState } from "react";
import { Heart, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/use-current-user";
import { reputationLabel, type Comment, type Post, type PostAuthor } from "@/lib/community-data";

const PREVIEW_COUNT = 2;

export function CommentThread({
  post,
  comments: initialComments,
  onCommentsChange,
}: {
  post: Post;
  comments: Comment[];
  onCommentsChange: (comments: Comment[]) => void;
}) {
  const { data: me } = useCurrentUser();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [commentLikes, setCommentLikes] = useState<Record<string, boolean>>({});

  const isQuestion = post.type === "question";
  const visibleComments = expanded ? initialComments : initialComments.slice(0, PREVIEW_COUNT);
  const hasMore = initialComments.length > PREVIEW_COUNT;

  function addComment() {
    const body = draft.trim();
    if (!body) return;

    const name = me?.profile?.display_name || me?.profile?.handle || "You";
    const newComment: Comment = {
      id: `local-${Date.now()}`,
      postId: post.id,
      author: {
        name,
        title: me?.profile?.creator_title || me?.profile?.category || "Tethyr creator",
        reputation: 0,
        badges: [],
        accent: "green",
      } as PostAuthor,
      body,
      timestamp: "Just now",
      likes: 0,
    };
    onCommentsChange([newComment, ...initialComments]);
    setDraft("");
    setExpanded(true);
    toast.success("Reply posted");
  }

  function toggleLike(commentId: string) {
    setCommentLikes((prev) => {
      const next = { ...prev };
      next[commentId] = !next[commentId];
      return next;
    });
    onCommentsChange(
      initialComments.map((c) =>
        c.id === commentId ? { ...c, likes: c.likes + (commentLikes[commentId] ? -1 : 1) } : c,
      ),
    );
  }

  function markBestAnswer(commentId: string) {
    onCommentsChange(
      initialComments.map((c) => ({
        ...c,
        isBestAnswer: c.id === commentId,
      })),
    );
    toast.success("Marked as best answer");
  }

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <div className="flex flex-col gap-3">
        {visibleComments.map((comment) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            liked={!!commentLikes[comment.id]}
            onToggleLike={() => toggleLike(comment.id)}
            isQuestion={isQuestion}
            onMarkBestAnswer={() => markBestAnswer(comment.id)}
          />
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> View all {initialComments.length} comments
            </>
          )}
        </button>
      )}

      <div className="mt-3 flex items-start gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a reply..."
          rows={1}
          className="min-h-9 resize-none rounded-xl border-border/60 bg-background/40 py-2 text-sm"
        />
        <Button size="sm" className="shrink-0" onClick={addComment} disabled={!draft.trim()}>
          Reply
        </Button>
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  liked,
  onToggleLike,
  isQuestion,
  onMarkBestAnswer,
}: {
  comment: Comment;
  liked: boolean;
  onToggleLike: () => void;
  isQuestion: boolean;
  onMarkBestAnswer: () => void;
}) {
  const initial = comment.author.name.charAt(0).toUpperCase();
  const avatarBg =
    comment.author.accent === "green"
      ? "bg-brand-green/80 text-background"
      : "bg-brand-purple/80 text-background";

  return (
    <div
      className={`rounded-xl p-3 ${
        comment.isBestAnswer ? "border border-brand-green/30 bg-brand-green/5" : "bg-background/40"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold ${avatarBg}`}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="text-xs font-medium">{comment.author.name}</span>
            <span className="text-[10px] text-muted-foreground">
              {reputationLabel(comment.author.reputation)}
            </span>
            <span className="text-[10px] text-muted-foreground">{comment.timestamp}</span>
          </div>
          <p className="mt-1 text-sm text-foreground/90">{comment.body}</p>
          <div className="mt-1.5 flex items-center gap-3">
            <button
              onClick={onToggleLike}
              className={`flex items-center gap-1 text-[11px] transition-colors ${
                liked ? "text-brand-green" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Heart className={`h-3 w-3 ${liked ? "fill-current" : ""}`} />
              {comment.likes + (liked ? 1 : 0)}
            </button>
            {isQuestion && !comment.isBestAnswer && (
              <button
                onClick={onMarkBestAnswer}
                className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-brand-green"
              >
                <CheckCircle2 className="h-3 w-3" />
                Mark as best
              </button>
            )}
            {comment.isBestAnswer && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-brand-green">
                <CheckCircle2 className="h-3 w-3" />
                Best answer
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
