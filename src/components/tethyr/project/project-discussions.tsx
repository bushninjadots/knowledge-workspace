import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2, Pin, MessageCircle, ChevronRight, ChevronDown, Users } from "lucide-react";
import { toast } from "sonner";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DiscussionRow, DiscussionReplyRow } from "@/hooks/use-projects";
import {
  useCreateDiscussion,
  useDeleteDiscussion,
  useDiscussionReplies,
  useCreateDiscussionReply,
} from "@/hooks/use-projects";
import { useCurrentUser } from "@/hooks/use-current-user";
import { timeAgo } from "@/lib/time";
import { Button } from "@/components/ui/button";

const CATEGORY_STYLE: Record<DiscussionRow["category"], string> = {
  general: "border-border/60 bg-background/60 text-muted-foreground",
  question:
    "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]",
  idea: "border-brand-green/40 bg-brand-green/10 text-brand-green",
  feedback: "border-brand-purple/40 bg-brand-purple/10 text-brand-purple",
  announcement: "border-teaching/40 bg-teaching text-teaching",
};

const CATEGORY_LABEL: Record<DiscussionRow["category"], string> = {
  general: "General",
  question: "Question",
  idea: "Idea",
  feedback: "Feedback",
  announcement: "Announcement",
};

function DiscussionThread({
  discussion,
  isContributor,
  isOwner,
}: {
  discussion: DiscussionRow;
  isContributor: boolean;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const { data: me } = useCurrentUser();
  const { data: replies = [] } = useDiscussionReplies(open ? discussion.id : "");
  const createReply = useCreateDiscussionReply();
  const deleteDiscussion = useDeleteDiscussion();

  const handleReply = async () => {
    if (!replyBody.trim()) return;
    try {
      await createReply.mutateAsync({ discussionId: discussion.id, body: replyBody.trim() });
      setReplyBody("");
    } catch {
      toast.error("Failed to post reply");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDiscussion.mutateAsync({ id: discussion.id, projectId: discussion.project_id });
      toast.success("Discussion deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const name = discussion.author?.display_name || discussion.author?.handle || "Unknown";

  return (
    <div
      id={`discussion-${discussion.id}`}
      className="scroll-mt-28 rounded-xl border border-border/60 bg-background/40 p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {discussion.is_pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${CATEGORY_STYLE[discussion.category]}`}
            >
              {CATEGORY_LABEL[discussion.category]}
            </span>
            {discussion.community_post_id && (
              <Link
                to="/community"
                search={{ post: discussion.community_post_id } as Record<string, string>}
                className="inline-flex items-center gap-1 rounded-full border border-learning/40 bg-learning px-2 py-0.5 text-[11px] font-medium text-learning transition hover:bg-learning"
              >
                <Users className="h-2.5 w-2.5" />
                Also on Community
              </Link>
            )}
            <h4 className="text-sm font-medium">{discussion.title}</h4>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Link
              to="/u/$handle"
              params={{ handle: discussion.author?.handle ?? "unknown" }}
              className="hover:underline"
            >
              {name}
            </Link>
            <span aria-hidden>·</span>
            <span>{timeAgo(discussion.created_at)}</span>
          </div>
          <div className="prose-custom mt-2 text-sm text-foreground/90">
            <Markdown remarkPlugins={[remarkGfm]}>{discussion.body}</Markdown>
          </div>
        </div>
        {(discussion.author_id === me?.userId || isOwner) && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={handleDelete}
            busy={deleteDiscussion.isPending}
            aria-label={`Delete discussion ${discussion.title}`}
            className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="mt-3 h-auto px-0 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <MessageCircle className="h-3 w-3" />
        {discussion.reply_count ?? 0} {(discussion.reply_count ?? 0) === 1 ? "reply" : "replies"}
      </Button>

      {open && (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          {replies.map((r: DiscussionReplyRow) => {
            const rName = r.author?.display_name || r.author?.handle || "Unknown";
            return (
              <div key={r.id} className="rounded-xl bg-surface-elevated/60 p-3">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Link
                    to="/u/$handle"
                    params={{ handle: r.author?.handle ?? "unknown" }}
                    className="font-medium hover:underline"
                  >
                    {rName}
                  </Link>
                  <span>{timeAgo(r.created_at)}</span>
                </div>
                <p className="mt-1 text-sm text-foreground/90">{r.body}</p>
              </div>
            );
          })}

          {isContributor && (
            <div className="flex gap-2">
              <input
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                onKeyDown={(e) => e.key === "Enter" && handleReply()}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleReply}
                busy={createReply.isPending}
                disabled={!replyBody.trim()}
              >
                Reply
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProjectDiscussions({
  discussions,
  projectId,
  isContributor,
  isOwner,
}: {
  discussions: DiscussionRow[];
  projectId: string;
  isContributor: boolean;
  isOwner: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<DiscussionRow["category"]>("general");
  const createDiscussion = useCreateDiscussion();

  const handleAdd = async () => {
    if (!title.trim() || !body.trim()) return;
    try {
      await createDiscussion.mutateAsync({
        projectId,
        title: title.trim(),
        body: body.trim(),
        category,
      });
      setTitle("");
      setBody("");
      setCategory("general");
      setShowAdd(false);
      toast.success("Discussion started");
    } catch {
      toast.error("Failed to create discussion");
    }
  };

  return (
    <div className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground/80">Discussion</h3>
        {isContributor && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowAdd(!showAdd)}
            aria-expanded={showAdd}
            className="rounded-full"
          >
            <Plus className="h-3 w-3" />
            New Thread
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="mb-4 space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
          <div className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Thread title"
              className="flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DiscussionRow["category"])}
              className="rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="general">General</option>
              <option value="question">Question</option>
              <option value="idea">Idea</option>
              <option value="feedback">Feedback</option>
              <option value="announcement">Announcement</option>
            </select>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Start the conversation... (Markdown supported)"
            rows={3}
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary resize-none"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              busy={createDiscussion.isPending}
              disabled={!title.trim() || !body.trim()}
            >
              Start discussion
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {discussions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No discussions yet.</p>
      ) : (
        <div className="space-y-3">
          {discussions.map((d) => (
            <DiscussionThread
              key={d.id}
              discussion={d}
              isContributor={isContributor}
              isOwner={isOwner}
            />
          ))}
        </div>
      )}
    </div>
  );
}
