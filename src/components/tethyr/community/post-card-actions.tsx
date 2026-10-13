// A post's secondary surfaces: the offer-help and report dialogs, and the poll
// widget. Rendered by PostCard (post-card.tsx).

import { useState } from "react";
import { Clock, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type PostWithAuthor } from "@/lib/community-data";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useNow } from "@/hooks/use-now";
import { useAddComment, useReportPost, useVotePoll, type PollData } from "@/hooks/use-community";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function OfferHelpDialog({
  post,
  open,
  onOpenChange,
  onOffered,
}: {
  post: PostWithAuthor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOffered: () => void;
}) {
  const addComment = useAddComment();
  const isRequestType = post.type === "help_request" || post.type === "collaboration_request";
  const authorName = post.author.display_name || post.author.handle || "the author";
  // Help/collab posts already asked for a hand, so pre-fill a ready-to-send
  // offer the author can send immediately or edit. Other posts start empty.
  const [message, setMessage] = useState(() =>
    isRequestType ? "I can help with this — happy to jump in." : "",
  );

  async function submit() {
    try {
      // Record the offer (bumps the count + marks the post "Offered").
      onOffered();
      // Post the note as a comment so the author is notified and can respond.
      await addComment.mutateAsync({ postId: post.id, body: message.trim() });
      toast.success(`Offer sent to ${authorName}`);
      setMessage("");
      onOpenChange(false);
    } catch (err) {
      toast.error(friendlyError(err, "Couldn't send your offer"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Offer to help {authorName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Tell {authorName} how you can help. Your note is posted as a comment so they can reach
          back out.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 500))}
          placeholder="e.g. I can take a look at the onboarding flow and suggest fixes…"
          rows={4}
          maxLength={500}
          className="w-full rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
        />
        <div className="text-right text-[11px] text-muted-foreground">{message.length}/500</div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} busy={addComment.isPending} disabled={!message.trim()}>
            Send offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReportPostDialog({
  open,
  onOpenChange,
  postId,
  postTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postTitle: string;
}) {
  const reportPost = useReportPost();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  const REASONS = [
    "Breaks community rules",
    "Spam or self-promotion",
    "Harassment or hate",
    "Misinformation",
    "Off-topic",
    "Other",
  ];

  function friendlyError(err: unknown) {
    const msg = (err as Error)?.message ?? "";
    if (msg.toLowerCase().includes("rate_limit")) {
      return "You've filed too many reports recently — please wait a bit before reporting again.";
    }
    return `Failed to report: ${msg}`;
  }

  function submit() {
    if (!reason.trim()) {
      toast.error("Pick a reason");
      return;
    }
    reportPost.mutate(
      { postId, reason: reason.trim(), details },
      {
        onSuccess: () => {
          toast.success("Reported — the space moderators will review it");
          onOpenChange(false);
          setReason("");
          setDetails("");
        },
        onError: (err) => toast.error(friendlyError(err)),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this post</DialogTitle>
        </DialogHeader>
        <p className="line-clamp-2 text-xs text-muted-foreground" title={postTitle}>
          “{postTitle}”
        </p>
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-full border px-3 py-1 text-xs transition-lift ${
                  reason === r
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-border bg-background/40 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 500))}
            placeholder="Anything else the moderators should know? (optional)"
            rows={3}
            className="w-full rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            busy={reportPost.isPending}
            disabled={!reason.trim()}
          >
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PollWidget({ pollData, postId }: { pollData: PollData; postId: string }) {
  const { data: me } = useCurrentUser();
  const votePoll = useVotePoll();
  const myVote = pollData.votes?.find((v) => v.user_id === me?.userId) ?? null;
  const totalVotes = pollData.votes?.length ?? 0;
  // Shared 30s wall-clock ticker — one module-level interval serves every poll
  // card, instead of one timer (and one re-render loop) per rendered poll.
  const now = useNow();
  const hasEnded = !!pollData.ends_at && new Date(pollData.ends_at).getTime() <= now;

  function handleVote(optionIndex: number) {
    if (myVote || votePoll.isPending || !me?.userId || hasEnded) return;
    votePoll.mutate(
      { postId, optionIndex, userId: me.userId },
      {
        onError: (err) => toast.error(friendlyError(err, "Failed to vote")),
      },
    );
  }

  return (
    <div className="mt-3 rounded-xl border card-border bg-background/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-ai" />
        <p className="text-sm font-semibold">{pollData.question}</p>
      </div>
      <div className="space-y-2">
        {pollData.options.map((option, i) => {
          const optionVotes = pollData.votes?.filter((v) => v.option_index === i).length ?? 0;
          const pct = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
          const isVoted = myVote?.option_index === i;
          return (
            <button
              key={i}
              onClick={() => handleVote(i)}
              disabled={!!myVote || votePoll.isPending || hasEnded}
              className={`group relative w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-lift ${
                isVoted
                  ? "border-ai/40 bg-ai/10 text-ai"
                  : myVote
                    ? "border-border/60 bg-background/40 text-muted-foreground"
                    : "border-border/60 bg-background/40 text-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-[var(--user-accent-subtle,var(--surface-elevated))]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{option}</span>
                {myVote && (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {pct}%
                  </span>
                )}
              </div>
              {myVote && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
                  <div
                    className="h-full rounded-full bg-ai/40 transition-[width] duration-150"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
        </span>
        {pollData.ends_at && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {hasEnded ? "Ended" : `Ends ${new Date(pollData.ends_at).toLocaleDateString()}`}
          </span>
        )}
      </div>
    </div>
  );
}
