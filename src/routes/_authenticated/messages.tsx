// Direct messages surface — list of accepted tethrs + active thread.
// Includes pagination, typing indicators, read receipts, unread badges.
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { MessageSquare, Send, ArrowLeft, Check, CheckCheck, Loader2 } from "lucide-react";
import { DashboardSidebar } from "@/components/tethyr/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/tethyr/empty-state";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useConnections, type ConnectionWithProfile } from "@/hooks/use-connections";
import {
  useMessages,
  useSendMessage,
  useUnreadCounts,
  useTyping,
} from "@/hooks/use-messages";

const searchSchema = z.object({ c: z.string().optional() });

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Messages — Tethyr" },
      { name: "description", content: "Chat with your tethryd creators." },
    ],
  }),
  component: MessagesPage,
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
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <DashboardSidebar />
      </div>
      <main className="flex-1">
        <div className="mx-auto flex h-[calc(100vh-0px)] w-full max-w-6xl">
          {/* List */}
          <aside
            className={`w-full flex-col border-r border-border/60 sm:w-80 ${
              active ? "hidden sm:flex" : "flex"
            }`}
          >
            <header className="flex h-16 items-center justify-between border-b border-border/60 px-4">
              <div className="leading-tight">
                <h1 className="font-display text-lg font-semibold">Messages</h1>
                <p className="text-[11px] text-muted-foreground">
                  Where tethrs actually talk 💬
                </p>
              </div>
              {unread && unread.total > 0 && (
                <span className="animate-in zoom-in rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {unread.total}
                </span>
              )}
            </header>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="m-2 h-16 animate-pulse rounded-2xl bg-surface" />
              ) : accepted.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={<span className="text-xl">👋</span>}
                    title="It's quiet in here... too quiet"
                    description="Once you're tethryd with someone, this is where the real talk (and probably some memes) happens."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
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

          {/* Thread */}
          <section className={`flex-1 flex-col ${active ? "flex" : "hidden sm:flex"}`}>
            {active ? (
              <Thread conn={active} meId={meId} onBack={() => select(null)} />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-purple/20 to-primary/20 text-3xl">
                  🔗
                </div>
                <p className="text-sm font-medium text-foreground">
                  Pick a conversation to start messaging
                </p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Every great tether starts with "hey." Pick someone on the left and send
                  yours.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
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
  const name = conn.other?.display_name ?? conn.other?.handle ?? "Creator";
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
        active ? "bg-surface" : "hover:bg-surface/60"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-purple text-sm font-semibold text-background">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${unreadCount > 0 ? "font-semibold" : "font-medium"}`}>
          {name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {conn.other?.creator_title || conn.other?.category || "—"}
        </p>
      </div>
      {unreadCount > 0 && (
        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
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
  const { messages, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useMessages(conn.id);
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

  const name = conn.other?.display_name ?? conn.other?.handle ?? "Creator";
  // Last message I sent — used to place the read receipt only under it.
  const lastMineId = [...messages].reverse().find((m) => m.sender_id === meId)?.id;

  return (
    <>
      <header className="flex h-16 items-center gap-3 border-b border-border/60 px-4">
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-purple text-sm font-semibold text-background">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {otherTyping ? (
              <span className="text-primary">typing…</span>
            ) : (
              conn.other?.creator_title || conn.other?.category || "—"
            )}
          </p>
        </div>
      </header>

      <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {hasNextPage && (
          <div className="flex justify-center">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="gap-2 text-xs text-muted-foreground"
            >
              {isFetchingNextPage ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : null}
              Load older messages
            </Button>
          </div>
        )}
        {conn.intro_message && (
          <div className="mx-auto max-w-md rounded-2xl border border-primary/30 bg-primary/5 p-3 text-center text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Intro note:</span>{" "}
            {conn.intro_message}
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
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "border border-border/60 bg-surface"
                  }`}
                >
                  {m.body}
                </div>
                {isLastMine && (
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    {m.read_at ? (
                      <>
                        <CheckCheck className="h-3 w-3 text-primary" /> Read
                      </>
                    ) : m.id.startsWith("optimistic-") ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Sending
                      </>
                    ) : (
                      <>
                        <Check className="h-3 w-3" /> Sent
                      </>
                    )}
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <div className="pt-8 text-center">
            <p className="text-2xl">✨</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This is the very beginning of your conversation with {name}.
            </p>
            <p className="text-xs text-muted-foreground/70">No pressure, but "hi" is a great opener.</p>
          </div>
        )}
        {otherTyping && (
          <div className="flex items-start">
            <div className="flex items-center gap-1 rounded-2xl border border-border/60 bg-surface px-3 py-2">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border/60 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value.slice(0, 2000));
              notifyTyping();
            }}
            placeholder={`Message ${name}…`}
            rows={1}
            className="min-h-11 resize-none rounded-2xl"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button onClick={submit} disabled={send.isPending || !draft.trim()} className="gap-1.5">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
