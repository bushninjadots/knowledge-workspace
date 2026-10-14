// The messaging dock: a "Messages" launcher in the bottom-right corner of
// every signed-in page (tablet and up; phones have Messages in the bottom
// bar). It opens a small panel with your conversations and a compact thread,
// so you can reply without leaving the page. New-message popups open threads
// here. Hidden on /messages, which is the full-size version of the same thing.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Loader2,
  Maximize2,
  MessageCircle,
  Search,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { onNotificationInsert } from "@/hooks/use-notifications";
import { MemberAvatar } from "@/components/tethyr/member-avatar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useConnections, type ConnectionWithProfile } from "@/hooks/use-connections";
import { useMessages, useSendMessage, useTyping, useUnreadCounts } from "@/hooks/use-messages";
import { messageDock, useMessageDock } from "@/lib/message-dock-store";
import { cn } from "@/lib/utils";

const nameOf = (conn: ConnectionWithProfile) =>
  conn.other?.display_name || conn.other?.handle || "Connection";

/** Unread conversations first, then the existing (newest-first) order. */
export function sortConversations<T extends { id: string }>(
  conversations: T[],
  unread: Record<string, number>,
): T[] {
  return conversations
    .map((conversation, index) => ({ conversation, index }))
    .sort((a, b) => {
      const aUnread = (unread[a.conversation.id] ?? 0) > 0 ? 1 : 0;
      const bUnread = (unread[b.conversation.id] ?? 0) > 0 ? 1 : 0;
      return bUnread - aUnread || a.index - b.index;
    })
    .map(({ conversation }) => conversation);
}

export function MessagingDock() {
  const location = useLocation();
  const { open, threadId } = useMessageDock();
  const { data: connections } = useConnections();
  const { data: unread } = useUnreadCounts();
  const total = unread?.total ?? 0;

  // Keep the launcher's count live: every new message also inserts a
  // `message` notification, which arrives on the shared channel.
  const queryClient = useQueryClient();
  useEffect(
    () =>
      onNotificationInsert((row) => {
        if (row.type === "message") {
          void queryClient.invalidateQueries({ queryKey: ["messages-unread"] });
        }
      }),
    [queryClient],
  );

  // Escape closes the dock wherever focus is (e.g. after going back to the
  // list), unless a dialog or menu is handling it.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"]')) return;
      messageDock.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // The full Messages page is the same thing, bigger.
  const onMessagesPage = location.pathname === "/messages";
  useEffect(() => {
    if (onMessagesPage) messageDock.close();
  }, [onMessagesPage]);

  const accepted = useMemo(
    () => (connections ?? []).filter((conn) => conn.status === "accepted"),
    [connections],
  );
  const active = threadId ? (accepted.find((conn) => conn.id === threadId) ?? null) : null;

  if (onMessagesPage) return null;

  return (
    <div className="hidden flex-col items-end gap-3 md:flex">
      {open && (
        <section
          aria-label="Messages"
          className="pointer-events-auto flex h-[min(34rem,calc(100vh-7rem))] w-[22rem] flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-panel motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3"
        >
          {active ? (
            <DockThread conn={active} />
          ) : (
            <DockList conversations={accepted} unread={unread?.byConnection ?? {}} total={total} />
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => messageDock.toggle()}
        aria-expanded={open}
        aria-label={total > 0 ? `Messages, ${total} unread` : "Messages"}
        className={cn(
          "pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium shadow-lg transition-colors",
          open
            ? "border-border/70 bg-surface text-foreground hover:bg-surface-elevated"
            : "border-transparent bg-[var(--user-accent,var(--primary))] text-[var(--user-accent-foreground,var(--primary-foreground))] hover:opacity-95",
        )}
      >
        {open ? (
          <X className="h-4 w-4" aria-hidden />
        ) : (
          <MessageCircle className="h-4 w-4" aria-hidden />
        )}
        Messages
        {total > 0 && !open && (
          <span className="numeric -mr-1 min-w-5 rounded-full bg-background px-1.5 py-0.5 text-center text-[11px] font-semibold text-foreground">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>
    </div>
  );
}

function DockHeader({ children }: { children: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-[color-mix(in_oklab,var(--user-accent,var(--primary))_7%,var(--card))] px-3">
      {children}
      <Link
        to="/messages"
        onClick={() => messageDock.close()}
        aria-label="Open the full Messages page"
        className="ml-auto rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </Link>
      <button
        type="button"
        onClick={() => messageDock.close()}
        aria-label="Close messages"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </header>
  );
}

function DockList({
  conversations,
  unread,
  total,
}: {
  conversations: ConnectionWithProfile[];
  unread: Record<string, number>;
  total: number;
}) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? conversations.filter((conn) =>
          [conn.other?.display_name, conn.other?.handle, conn.other?.creator_title].some((value) =>
            value?.toLowerCase().includes(q),
          ),
        )
      : conversations;
    return sortConversations(filtered, unread);
  }, [conversations, unread, query]);

  return (
    <>
      <DockHeader>
        <MessageCircle
          className="h-4 w-4 text-[var(--user-accent-text,var(--primary))]"
          aria-hidden
        />
        <h2 className="font-display text-base font-semibold">Messages</h2>
        {total > 0 && (
          <span className="numeric rounded-full bg-[var(--user-accent,var(--primary))] px-1.5 text-[11px] font-semibold text-[var(--user-accent-foreground,var(--primary-foreground))]">
            {total}
          </span>
        )}
      </DockHeader>
      {conversations.length > 4 && (
        <div className="relative shrink-0 border-b border-border/50 px-3 py-2">
          <Search
            className="absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a conversation"
            aria-label="Find a conversation"
            className="h-8 w-full rounded-lg bg-surface-elevated/60 pl-7 pr-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      )}
      <ul className="min-h-0 flex-1 overflow-y-auto py-1">
        {list.length === 0 ? (
          <li className="px-5 py-10 text-center text-sm text-muted-foreground">
            {conversations.length === 0 ? (
              <>
                No conversations yet.{" "}
                <Link
                  to="/explore"
                  search={{ tab: "creators" }}
                  onClick={() => messageDock.close()}
                  className="font-medium text-[var(--user-accent-text,var(--primary))] hover:underline"
                >
                  Find people to connect with
                </Link>
              </>
            ) : (
              "No one matches that."
            )}
          </li>
        ) : (
          list.map((conn) => {
            const count = unread[conn.id] ?? 0;
            const name = nameOf(conn);
            return (
              <li key={conn.id}>
                <button
                  type="button"
                  onClick={() => messageDock.open(conn.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-elevated/70"
                >
                  <MemberAvatar
                    name={name}
                    avatarPath={conn.other?.avatar_url}
                    className="h-9 w-9"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm",
                        count > 0 ? "font-semibold" : "font-medium",
                      )}
                    >
                      {name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {conn.other?.creator_title ||
                        (conn.other?.handle ? `@${conn.other.handle}` : "")}
                    </span>
                  </span>
                  {count > 0 && (
                    <span className="numeric shrink-0 rounded-full bg-[var(--user-accent,var(--primary))] px-1.5 text-[11px] font-semibold text-[var(--user-accent-foreground,var(--primary-foreground))]">
                      {count}
                    </span>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </>
  );
}

function DockThread({ conn }: { conn: ConnectionWithProfile }) {
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;
  const { messages, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useMessages(
    conn.id,
  );
  const send = useSendMessage(conn.id);
  const { otherTyping, notifyTyping } = useTyping(conn.id);
  const [draft, setDraft] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const name = nameOf(conn);
  const lastMineId = [...messages].reverse().find((m) => m.sender_id === meId)?.id;
  const newestId = messages.at(-1)?.id;

  // Stick to the newest message as they arrive (and when the thread opens).
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [newestId, otherTyping]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conn.id]);

  const submit = () => {
    const body = draft.trim();
    if (!body || send.isPending) return;
    setDraft("");
    send.mutate(body, {
      onError: () => {
        setDraft(body);
        toast.error("Couldn't send that — try again");
      },
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <>
      <DockHeader>
        <button
          type="button"
          onClick={() => messageDock.showList()}
          aria-label="Back to conversations"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <MemberAvatar name={name} avatarPath={conn.other?.avatar_url} className="h-8 w-8" />
        <div className="min-w-0">
          {conn.other?.handle ? (
            <Link
              to="/u/$handle"
              params={{ handle: conn.other.handle }}
              className="block truncate text-sm font-semibold hover:underline"
            >
              {name}
            </Link>
          ) : (
            <p className="truncate text-sm font-semibold">{name}</p>
          )}
          <p className="truncate text-[11px] text-muted-foreground">
            {otherTyping ? "typing…" : conn.other?.creator_title || "Connection"}
          </p>
        </div>
      </DockHeader>

      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[color-mix(in_oklch,var(--user-accent,var(--primary))_3%,var(--background))] px-3 py-4"
      >
        {hasNextPage && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="rounded-full px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
            >
              {isFetchingNextPage ? "Loading…" : "Load older messages"}
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            This is the start of your conversation with {name}. Say hi.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.sender_id === meId;
            return (
              <div
                key={message.id}
                className={cn("flex flex-col", mine ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm",
                    mine
                      ? "rounded-br-md bg-[var(--user-accent,var(--primary))] text-[var(--user-accent-foreground,var(--primary-foreground))]"
                      : "rounded-bl-md border border-border/60 bg-surface",
                  )}
                >
                  {message.body}
                </div>
                {mine && message.id === lastMineId && (
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    {message.read_at ? (
                      <>
                        <CheckCheck className="h-3 w-3" aria-hidden /> Read
                      </>
                    ) : message.id.startsWith("optimistic-") ? (
                      "Sending…"
                    ) : (
                      <>
                        <Check className="h-3 w-3" aria-hidden /> Sent
                      </>
                    )}
                  </span>
                )}
              </div>
            );
          })
        )}
        {otherTyping && (
          <div
            className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border/60 bg-surface px-3 py-2.5 w-fit"
            aria-label={`${name} is typing`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce" />
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex shrink-0 items-end gap-2 border-t border-border/60 bg-surface p-2.5"
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value.slice(0, 4000));
            notifyTyping();
          }}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={`Message ${name.split(" ")[0]}…`}
          aria-label={`Message ${name}`}
          className="max-h-28 min-h-9 flex-1 resize-none rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none transition-colors [field-sizing:content] focus:border-[var(--user-accent-border,var(--ring))]"
        />
        <button
          type="submit"
          disabled={!draft.trim() || send.isPending}
          aria-label="Send message"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--user-accent,var(--primary))] text-[var(--user-accent-foreground,var(--primary-foreground))] transition-opacity disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </>
  );
}
