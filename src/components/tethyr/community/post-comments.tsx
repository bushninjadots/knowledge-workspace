import { useMemo, useState } from "react";
import { CheckCircle2, Heart } from "lucide-react";
import { toast } from "sonner";
import { timeAgo } from "@/lib/time";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useAddComment, useUpdateComment } from "@/hooks/use-community";
import {
  isAsk,
  THANKS_REASON_MAX,
  THANKS_REASON_MIN,
  useMarkSolution,
  usePostThanks,
  useRemoveThanks,
  useThankReply,
  type ReplyThanks,
} from "@/hooks/use-community-help";
import type { CommentRow } from "@/lib/community-data";
import { friendlyError } from "@/lib/error-message";
import { Button } from "@/components/ui/button";

type ThreadPost = { id: string; type: string; author_id: string };

export function CommentThreadInline({
  post,
  comments,
}: {
  post: ThreadPost;
  comments: CommentRow[];
}) {
  const { data: thanks = [] } = usePostThanks(post.id, comments.length > 0);
  const thanksByComment = useMemo(() => {
    const map = new Map<string, ReplyThanks[]>();
    for (const t of thanks) map.set(t.comment_id, [...(map.get(t.comment_id) ?? []), t]);
    return map;
  }, [thanks]);

  // Build a reply tree: top-level comments first, replies nested under their
  // parent, each level chronologically ordered — except that an ask's solution
  // leads, so the answer is the first thing people read. Cap the visible tree
  // so long threads stay readable.
  const tree = useMemo(() => {
    const byParent = new Map<string | null, CommentRow[]>();
    for (const c of comments) {
      const key = c.parent_id ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(c);
    }
    const sortChrono = (list: CommentRow[]) =>
      [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const top = sortChrono(byParent.get(null) ?? []).sort(
      (a, b) => Number(b.is_best_answer) - Number(a.is_best_answer),
    );
    const children = (id: string) => sortChrono(byParent.get(id) ?? []);
    return { top, children };
  }, [comments]);

  const solved = comments.some((c) => c.is_best_answer);

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <p className="text-xs text-muted-foreground">
        {comments.length} comment{comments.length !== 1 ? "s" : ""}
        {isAsk(post.type) && comments.length > 0 && !solved && (
          <span> · the person who asked can mark the reply that solved it</span>
        )}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {tree.top.slice(0, 5).map((c) => (
          <CommentNode
            key={c.id}
            comment={c}
            depth={0}
            childrenOf={tree.children}
            post={post}
            thanksByComment={thanksByComment}
          />
        ))}

        <CommentComposer postId={post.id} />
      </div>
    </div>
  );
}

function CommentNode({
  comment,
  depth,
  childrenOf,
  post,
  thanksByComment,
}: {
  comment: CommentRow;
  depth: number;
  childrenOf: (id: string) => CommentRow[];
  post: ThreadPost;
  thanksByComment: Map<string, ReplyThanks[]>;
}) {
  const { data: me } = useCurrentUser();
  const canEdit = comment.author_id === me?.userId;
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [thanking, setThanking] = useState(false);
  const markSolution = useMarkSolution();
  const name = comment.author?.display_name || comment.author?.handle || "Unknown";
  const initial = name.charAt(0).toUpperCase();
  const children = childrenOf(comment.id);
  const thanks = thanksByComment.get(comment.id) ?? [];
  const myThanks = thanks.find((t) => t.giver_id === me?.userId) ?? null;

  const isMine = comment.author_id === me?.userId;
  // Only the asker picks the solution, and never their own reply.
  const canPickSolution =
    !!me && isAsk(post.type) && post.author_id === me.userId && !isMine && depth === 0;

  function toggleSolution() {
    const on = !comment.is_best_answer;
    markSolution.mutate(
      { commentId: comment.id, postId: post.id, on },
      {
        onSuccess: () => toast.success(on ? `Marked ${name}'s reply as the solution` : "Unmarked"),
        onError: (err) => toast.error(friendlyError(err, "Couldn't update the solution")),
      },
    );
  }

  return (
    <div
      className={`rounded-xl p-3 ${
        comment.is_best_answer ? "border border-trust/30 bg-trust/5" : "community-well"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-trust/80 text-[11px] font-semibold text-background">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="text-xs font-medium">{name}</span>
            <span className="text-[11px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
            {comment.is_best_answer && (
              <span className="inline-flex items-center gap-1 rounded-full bg-trust/15 px-1.5 py-0.5 text-[11px] font-medium text-trust">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                Solution
              </span>
            )}
          </div>
          {editing ? (
            <CommentEditor
              commentId={comment.id}
              postId={post.id}
              initialBody={comment.body}
              onCancel={() => setEditing(false)}
              onSaved={() => setEditing(false)}
            />
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{comment.body}</p>
          )}

          {thanks.length > 0 && (
            <ul className="mt-1.5 space-y-0.5" aria-label={`Thanks for ${name}'s reply`}>
              {thanks.slice(0, 3).map((t) => (
                <li
                  key={t.id}
                  className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
                >
                  <Heart
                    className="mt-0.5 h-3 w-3 shrink-0 fill-current text-caution"
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="font-medium text-foreground/85">
                      {t.giver?.display_name || t.giver?.handle || "Someone"}
                    </span>{" "}
                    {t.reason}
                  </span>
                </li>
              ))}
              {thanks.length > 3 && (
                <li className="pl-[18px] text-[11px] text-muted-foreground">
                  and {thanks.length - 3} more thanked this
                </li>
              )}
            </ul>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              onClick={() => setReplying((v) => !v)}
              className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {replying ? "Cancel" : "Reply"}
            </button>
            {me && !isMine && (
              <button
                onClick={() => setThanking((v) => !v)}
                aria-expanded={thanking}
                className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {myThanks ? "Thanked" : "Thank"}
              </button>
            )}
            {canPickSolution && (
              <button
                onClick={toggleSolution}
                disabled={markSolution.isPending}
                className="text-[11px] font-medium text-trust transition-colors hover:underline disabled:opacity-50"
              >
                {comment.is_best_answer ? "Unmark solution" : "Mark as solution"}
              </button>
            )}
            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                Edit
              </button>
            )}
          </div>
          {thanking && (
            <ThanksComposer
              commentId={comment.id}
              postId={post.id}
              recipient={name}
              existing={myThanks}
              onDone={() => setThanking(false)}
            />
          )}
          {replying && <CommentComposer postId={post.id} parentId={comment.id} autoFocus />}
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
              post={post}
              thanksByComment={thanksByComment}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Say what helped — the reason is what makes thanks worth showing on a profile. */
function ThanksComposer({
  commentId,
  postId,
  recipient,
  existing,
  onDone,
}: {
  commentId: string;
  postId: string;
  recipient: string;
  existing: ReplyThanks | null;
  onDone: () => void;
}) {
  const thank = useThankReply();
  const remove = useRemoveThanks();
  const [reason, setReason] = useState(existing?.reason ?? "");
  const tooShort = reason.trim().length < THANKS_REASON_MIN;

  function send() {
    if (tooShort) return;
    thank.mutate(
      { commentId, postId, reason },
      {
        onSuccess: () => {
          toast.success(existing ? "Thanks updated" : `Thanked ${recipient}`);
          onDone();
        },
        onError: (err) => toast.error(friendlyError(err, "Couldn't send your thanks")),
      },
    );
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, THANKS_REASON_MAX))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            send();
          } else if (e.key === "Escape") onDone();
        }}
        autoFocus
        aria-label={`What helped about ${recipient}'s reply?`}
        placeholder="What helped? e.g. “Fixed my layout in one line”"
        className="min-w-0 flex-1 rounded-xl border border-border/60 community-well px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
      />
      <Button type="button" size="sm" onClick={send} busy={thank.isPending} disabled={tooShort}>
        {existing ? "Update" : "Thank"}
      </Button>
      {existing && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() =>
            remove.mutate(
              { id: existing.id, postId },
              { onSuccess: onDone, onError: () => toast.error("Couldn't take back your thanks") },
            )
          }
        >
          Take back
        </Button>
      )}
      <p className="w-full text-[11px] text-muted-foreground">
        Thanks on public posts show on {recipient}&apos;s profile.
      </p>
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
        className="w-full resize-y rounded-xl border border-border/60 community-well px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={save}
          busy={updateComment.isPending}
          disabled={!text.trim()}
        >
          Save comment
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
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
        className="flex-1 rounded-xl border border-border/60 community-well px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
      />
      <Button
        type="button"
        size="sm"
        onClick={submitComment}
        busy={addComment.isPending}
        disabled={!newComment.trim()}
        className="shrink-0"
      >
        {parentId ? "Reply" : "Comment"}
      </Button>
    </div>
  );
}
