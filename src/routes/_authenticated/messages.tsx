// Direct messages surface — list of accepted tethrs + active thread.
// Includes pagination, typing indicators, read receipts, unread badges.
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Send, ArrowLeft, Check, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/tethyr/empty-state";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useConnections, type ConnectionWithProfile } from "@/hooks/use-connections";
import { useMessages, useSendMessage, useUnreadCounts, useTyping } from "@/hooks/use-messages";

const searchSchema = z.object({ c: z.string().optional() });

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Meeting Table — Tethyr" },
      { name: "description", content: "Focused conversations at the meeting table." },
    ],
  }),
  component: MessagesPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
});

function MessagesPage() {
  const { c: activeId } = Route.useSearch();
  const navigate = useNavigate({ from: "/messages" });
  const { data: me } = useCurrentUser();
  const { data: connections, isLoading } = useConnections();
  const { data: unread } = useUnreadCounts();
  const meId = me?.userId ?? null;

  const accepted = useMemo<ConnectionWithProfile[]>(
    () => (connections ?? []).filter((c) => c.status === "accepted"),
    [connections],
  );
  const active = accepted.find((c) => c.id === activeId) ?? null;

  function select(id: string | null) {
    navigate({ search: id ? { c: id } : {} });
  }

  return (
    <div className="animate-room-enter mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-6xl md:h-screen">
      {/* Seating chart — conversation list */}
      <aside
        className={`w-full flex-col border-r border-border/60 sm:w-80 ${
          active ? "hidden sm:flex" : "flex"
        }`}
      >
        <header className="flex h-16 items-center justify-between border-b border-border/60 px-4">
          <div className="leading-tight">
            <h1 className="font-display text-lg font-semibold">Messages</h1>
            <p className="text-[11px] text-muted-foreground">Where tethrs actually talk</p>
          </div>
          {unread && unread.total > 0 && (
            <span className="animate-in zoom-in rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {unread.total}
            </span>
          )}
        </header>
        <div className="flex-1 overflow-y-auto bg-noise">
          {isLoading ? (
            <div className="m-2 h-16 animate-pulse rounded-2xl bg-surface" />
          ) : accepted.length === 0 ? (
            <div className="p-4">
              <EmptyState
                variant="messages"
                icon={<span className="text-xl">&#128075;</span>}
                title="The table is empty"
                description="Once you're tethryd with someone, this is where focused conversations happen. Pull up a chair."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {accepted.map((c) => (
                <li key={c.id}>
                  <ConversationRow
                    conn={c}
                    active={c.id === activeId}
                    unreadCount={unread?.byConnection[c.id] ?? 0}
                    onSelect={() => select(c.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Thread — focused conversation */}
      <section className={`flex-1 flex-col ${active ? "flex" : "hidden sm:flex"}`}>
        {active ? (
          <Thread conn={active} meId={meId} onBack={() => select(null)} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <EmptyState
              variant="messages"
              title="Pick a seat at the table"
              description="Every great tether starts with a conversation. Choose someone from the seating chart to begin."
            />
          </div>
        )}
      </section>
    </div>
  );
}

function ConversationRow({
  conn,
  active,
  unreadCount,
  onSelect,
}: {
  conn: ConnectionWithProfile;
  active: boolean;
  unreadCount: number;
  onSelect: () => void;
}) {
  const name = conn.other?.display_name ?? conn.other?.handle ?? "Member";
  const subtitle = conn.other?.creator_title || conn.other?.category || "—";

  return (
    <button
      onClick={onSelect}
      className={`group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all duration-200 ease-out ${
        active
          ? "border-l-2 border-l-primary bg-surface"
          : "border-l-2 border-l-transparent hover:border-l-primary/50 hover:bg-surface/50"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold transition-colors duration-200 ${
          active
            ? "bg-primary text-primary-foreground"
            : "bg-brand-purple text-background group-hover:bg-brand-purple/90"
        }`}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm ${
            unreadCount > 0 ? "font-semibold" : "font-medium"
          } ${active ? "text-foreground" : "text-foreground/80 group-hover:text-foreground"}`}
        >
          {name}
        </p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {unreadCount > 0 && (
        <span className="shrink-0 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm">
          {unreadCount}
        </span>
      )}
    </button>
  );
}

function Thread({
  conn,
  meId,
  onBack,
}: {
  conn: ConnectionWithProfile;
  meId: string | null;
  onBack: () => void;
}) {
  const { messages, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useMessages(
    conn.id,
  );
  const send = useSendMessage(conn.id);
  const { otherTyping, notifyTyping } = useTyping(conn.id);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  // Auto-scroll to bottom when new messages arrive at the tail.
  useEffect(() => {
    if (messages.length > lastCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    lastCountRef.current = messages.length;
  }, [messages.length]);

  function submit() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    send.mutate(body, {
      onError: (e: Error) => toast.error(e.message),
    });
  }

  const name = conn.other?.display_name ?? conn.other?.handle ?? "Member";
  // Last message I sent — used to place the read receipt only under it.
  const lastMineId = [...messages].reverse().find((m) => m.sender_id === meId)?.id;

  return (
    <>
      <header className="flex h-16 items-center gap-3 border-b border-border/60 px-4">
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-purple text-sm font-semibold text-background shadow-sm">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {otherTyping ? (
              <span className="flex items-center gap-1 text-primary">
                <span className="inline-flex items-center gap-0.5">
                  <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                  <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                  <span className="h-1 w-1 animate-bounce rounded-full bg-primary" />
                </span>
                typing
              </span>
            ) : (
              conn.other?.creator_title || conn.other?.category || "—"
            )}
          </p>
        </div>
      </header>

      <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto p-4 bg-noise">
        {hasNextPage && (
          <div className="flex justify-center">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="gap-2 text-xs text-muted-foreground"
            >
              {isFetchingNextPage ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Load older messages
            </Button>
          </div>
        )}
        {conn.intro_message && (
          <div className="mx-auto max-w-md rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-center text-xs text-muted-foreground shadow-sm">
            <span className="font-medium text-foreground">Intro note:</span> {conn.intro_message}
          </div>
        )}
        {isLoading ? (
          <div className="h-12 animate-pulse rounded-2xl bg-surface" />
        ) : messages.length > 0 ? (
          messages.map((m) => {
            const mine = m.sender_id === meId;
            const isLastMine = mine && m.id === lastMineId;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    mine
                      ? "bg-primary text-primary-foreground shadow-primary/10"
                      : "border border-border/60 bg-surface-elevated shadow-soft"
                  }`}
                >
                  {m.body}
                </div>
                {isLastMine && (
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                    {m.read_at ? (
                      <>
                        <CheckCheck className="h-3 w-3 text-primary/60" />
                        <span className="text-primary/60">Read</span>
                      </>
                    ) : m.id.startsWith("optimistic-") ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50" />
                        Sending
                      </>
                    ) : (
                      <>
                        <Check className="h-3 w-3" />
                        Sent
                      </>
                    )}
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <div className="pt-8 text-center">
            <p className="text-2xl">&#10024;</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This is the very beginning of your conversation with {name}.
            </p>
            <p className="text-xs text-muted-foreground/60">
              No pressure, but "hi" is a great opener.
            </p>
          </div>
        )}
        {otherTyping && (
          <div className="flex items-start">
            <div className="flex items-center gap-1.5 rounded-2xl border border-border/60 bg-surface-elevated px-3.5 py-2.5 shadow-sm">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border/60 p-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 rounded-2xl border border-border/60 bg-surface/80 transition-shadow duration-300 focus-within:border-primary/30 focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0),0_0_12px_-3px_var(--brand-green)]">
            <Textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value.slice(0, 2000));
                notifyTyping();
              }}
              placeholder={`Message ${name}…`}
              aria-label={`Message ${name}`}
              rows={1}
              className="min-h-11 resize-none rounded-2xl border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </div>
          <Button
            onClick={submit}
            disabled={send.isPending || !draft.trim()}
            className="h-11 w-11 shrink-0 gap-1.5 rounded-2xl shadow-sm transition-transform duration-150 active:scale-95"
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
