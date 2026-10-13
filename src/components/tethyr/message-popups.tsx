// Instant message popups: a new direct message shows as a small card in the
// bottom-right corner on any signed-in page — the sender's face, a preview,
// an inline quick reply and a way into the conversation. Fed by the existing
// per-user notifications channel (every message inserts a `message`
// notification via notify_new_message), so there is no extra subscription.
//
// Skipped while that conversation is already open, and when message
// notifications are muted in Settings.
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Send, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { onNotificationInsert, useNotificationRealtime } from "@/hooks/use-notifications";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { useSendMessage } from "@/hooks/use-messages";
import { MemberAvatar } from "@/components/tethyr/member-avatar";
import { cn } from "@/lib/utils";

/** How long an untouched popup stays up. */
export const POPUP_LIFETIME_MS = 12_000;
const MAX_POPUPS = 3;

type Sender = { name: string; handle: string | null; avatarPath: string | null };

export type MessagePopup = {
  /** One popup per conversation; later messages update it. */
  connectionId: string;
  actorId: string | null;
  preview: string;
  count: number;
  receivedAt: number;
};

/** Merge a new message into the stack: same conversation → bump, else push. */
export function addMessagePopup(
  stack: MessagePopup[],
  next: Omit<MessagePopup, "count">,
  max = MAX_POPUPS,
): MessagePopup[] {
  const existing = stack.find((popup) => popup.connectionId === next.connectionId);
  const merged: MessagePopup = existing
    ? { ...next, count: existing.count + 1 }
    : { ...next, count: 1 };
  const rest = stack.filter((popup) => popup.connectionId !== next.connectionId);
  return [merged, ...rest].slice(0, max);
}

export function MessagePopups() {
  useNotificationRealtime();
  const { mutedCategories } = useNotificationPreferences();
  const location = useLocation();
  const openConnection =
    location.pathname === "/messages" ? ((location.search as { c?: string }).c ?? null) : null;
  const [popups, setPopups] = useState<MessagePopup[]>([]);

  // Latest values for the long-lived listener.
  const stateRef = useRef({ muted: mutedCategories.includes("message"), openConnection });
  stateRef.current = { muted: mutedCategories.includes("message"), openConnection };

  useEffect(
    () =>
      onNotificationInsert((row) => {
        if (row.type !== "message") return;
        const connectionId =
          row.entity_id ?? (row.metadata?.connection_id as string | undefined) ?? null;
        if (!connectionId) return;
        const { muted, openConnection: reading } = stateRef.current;
        if (muted || reading === connectionId) return;
        const preview =
          (row.metadata?.message_preview as string | undefined) ?? row.body ?? "New message";
        setPopups((stack) =>
          addMessagePopup(stack, {
            connectionId,
            actorId: row.actor_id,
            preview,
            receivedAt: Date.now(),
          }),
        );
      }),
    [],
  );

  // Opening a conversation clears its popup.
  useEffect(() => {
    if (openConnection) {
      setPopups((stack) => stack.filter((popup) => popup.connectionId !== openConnection));
    }
  }, [openConnection]);

  const dismiss = useCallback((connectionId: string) => {
    setPopups((stack) => stack.filter((popup) => popup.connectionId !== connectionId));
  }, []);

  if (popups.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="New messages"
      className="pointer-events-none fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 z-50 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2 md:bottom-5 md:right-5"
    >
      {popups.map((popup) => (
        <MessagePopupCard
          key={popup.connectionId}
          popup={popup}
          onDismiss={() => dismiss(popup.connectionId)}
        />
      ))}
    </div>
  );
}

function useSender(actorId: string | null) {
  const queryClient = useQueryClient();
  const [sender, setSender] = useState<Sender | null>(null);
  useEffect(() => {
    if (!actorId) return;
    let cancelled = false;
    void queryClient
      .fetchQuery({
        queryKey: ["message-popup-sender", actorId],
        staleTime: 10 * 60 * 1000,
        queryFn: async (): Promise<Sender> => {
          const { data } = await supabase
            .from("profiles")
            .select("display_name, handle, avatar_url")
            .eq("id", actorId)
            .maybeSingle();
          return {
            name: data?.display_name || data?.handle || "Someone",
            handle: data?.handle ?? null,
            avatarPath: data?.avatar_url ?? null,
          };
        },
      })
      .then((value) => !cancelled && setSender(value))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [actorId, queryClient]);
  return sender;
}

function MessagePopupCard({ popup, onDismiss }: { popup: MessagePopup; onDismiss: () => void }) {
  const sender = useSender(popup.actorId);
  const send = useSendMessage(popup.connectionId);
  const [reply, setReply] = useState("");
  const [held, setHeld] = useState(false);
  const name = sender?.name ?? "New message";

  // Auto-dismiss, paused while hovered, focused or holding a draft. A newer
  // message in the same conversation (receivedAt) restarts the clock.
  useEffect(() => {
    if (held || reply.trim()) return;
    const timer = window.setTimeout(onDismiss, POPUP_LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [held, reply, popup.receivedAt, onDismiss]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const body = reply.trim();
    if (!body) return;
    send.mutate(body, {
      onSuccess: () => {
        toast.success(`Sent to ${name}`);
        onDismiss();
      },
      onError: () => toast.error("Couldn't send — open the conversation to try again"),
    });
  };

  return (
    <div
      role="status"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onDismiss();
      }}
      className={cn(
        "pointer-events-auto rounded-xl border border-border/70 bg-surface p-3 shadow-lg",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2",
      )}
    >
      <div className="flex items-start gap-3">
        <MemberAvatar name={name} avatarPath={sender?.avatarPath} className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{name}</p>
            {popup.count > 1 && (
              <span className="numeric shrink-0 rounded-full bg-[var(--user-accent-subtle,var(--surface-elevated))] px-1.5 text-[10px] font-semibold text-[var(--user-accent-text,var(--foreground))]">
                {popup.count} new
              </span>
            )}
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">now</span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{popup.preview}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Dismiss message from ${name}`}
          className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <form onSubmit={submit} className="mt-2.5 flex items-center gap-1.5">
        <input
          value={reply}
          onChange={(event) => setReply(event.target.value.slice(0, 2000))}
          placeholder={`Reply to ${sender ? name.split(" ")[0] : "them"}…`}
          aria-label={`Reply to ${name}`}
          className="h-8 min-w-0 flex-1 rounded-lg border border-border/60 bg-background/60 px-2.5 text-sm outline-none transition-colors focus:border-[var(--user-accent-border,var(--ring))]"
        />
        <button
          type="submit"
          disabled={!reply.trim() || send.isPending}
          aria-label="Send reply"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--user-accent,var(--primary))] text-[var(--user-accent-foreground,var(--primary-foreground))] transition-opacity disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
        <Link
          to="/messages"
          search={{ c: popup.connectionId }}
          onClick={onDismiss}
          aria-label={`Open conversation with ${name}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </form>
    </div>
  );
}
