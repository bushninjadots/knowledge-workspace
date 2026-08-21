import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { timeAgo } from "@/lib/time";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useAddComment, useUpdateComment } from "@/hooks/use-community";
import type { CommentRow } from "@/lib/community-data";

export function CommentThreadInline({
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
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-green/80 text-[11px] font-semibold text-background">
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
