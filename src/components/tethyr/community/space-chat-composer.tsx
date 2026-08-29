import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useCreatePost } from "@/hooks/use-community";
import type { CommunitySpace } from "@/hooks/use-community-spaces";
import { useQueryClient } from "@tanstack/react-query";
import type { SpaceTypingUser } from "@/hooks/use-space-typing";
import { friendlyError } from "@/lib/error-message";
import { Button } from "@/components/ui/button";

/**
 * Lightweight chat composer for a community space. Members who have joined can
 * just type and hit Enter — no post type, title, or toolbar — and the message
 * appears in the space feed as a conversation post others can reply to.
 */
export function SpaceChatComposer({
  space,
  announceTyping,
}: {
  space: CommunitySpace;
  /** Broadcast "this member is typing" — owned by the feed so only one channel subscription exists per space. */
  announceTyping?: (user: SpaceTypingUser) => void;
}) {
  const { data: me } = useCurrentUser();
  const createPost = useCreatePost();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const name = me?.profile?.display_name || me?.profile?.handle || "You";
  const initial = name.charAt(0).toUpperCase();

  function announceIfTyping(value: string) {
    if (value.trim() && me?.userId && announceTyping) {
      announceTyping({ id: me.userId, name, lastTypedAt: Date.now() });
    }
  }

  async function send() {
    const body = message.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await createPost.mutateAsync({
        type: "discussion",
        title: "",
        body,
        community: space.name,
        space_id: space.id,
      });
      setMessage("");
      // Show the new message instantly in the space feed.
      qc.invalidateQueries({ queryKey: ["space-posts", space.id] });
      qc.invalidateQueries({ queryKey: ["posts"] });
      textareaRef.current?.focus();
    } catch (err: unknown) {
      toast.error(friendlyError(err, "Couldn't send — try again"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card-border border bg-surface px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-green text-sm font-semibold text-background">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            id="community-composer-textarea"
            value={message}
            onChange={(e) => {
              const value = e.target.value;
              setMessage(value);
              announceIfTyping(value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Message ${space.name}…`}
            rows={2}
            className="min-h-12 w-full resize-none rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--user-accent-border,var(--border-strong))] focus:outline-none"
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              Enter to send · Shift+Enter for a new line
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={send}
              busy={sending}
              disabled={!message.trim()}
              aria-label="Send message"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
