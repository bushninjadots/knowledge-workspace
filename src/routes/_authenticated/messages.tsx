// Direct messages surface — list of accepted tethrs + active thread.
// Realtime handled inside the hooks. URL owns the selection (?c=<id>).
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { MessageSquare, Send, ArrowLeft } from "lucide-react";
import { DashboardSidebar } from "@/components/tethyr/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/tethyr/empty-state";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useConnections, type ConnectionWithProfile } from "@/hooks/use-connections";
import { useMessages, useSendMessage } from "@/hooks/use-messages";

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
            <header className="flex h-16 items-center border-b border-border/60 px-4">
              <h1 className="font-display text-lg font-semibold">Messages</h1>
            </header>
            <div className="flex-1 overflow-y-auto p-2">
              {isLoading ? (
                <div className="h-16 animate-pulse rounded-2xl bg-surface" />
              ) : accepted.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={<MessageSquare className="h-5 w-5" />}
                    title="No conversations yet"
                    description="Once you're tethryd with someone you can message them here."
                  />
                </div>
              ) : (
                accepted.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conn={c}
                    active={c.id === activeId}
                    onSelect={() => select(c.id)}
                  />
                ))
              )}
            </div>
          </aside>

          {/* Thread */}
          <section className={`flex-1 flex-col ${active ? "flex" : "hidden sm:flex"}`}>
            {active ? (
              <Thread conn={active} meId={meId} onBack={() => select(null)} />
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                Pick a conversation to start messaging.
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
  onSelect,
}: {
  conn: ConnectionWithProfile;
  active: boolean;
  onSelect: () => void;
}) {
  const name = conn.other?.display_name ?? conn.other?.handle ?? "Creator";
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
        active ? "bg-surface" : "hover:bg-surface/60"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-purple text-sm font-semibold text-background">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {conn.other?.creator_title || conn.other?.category || "—"}
        </p>
      </div>
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
  const { data: messages, isLoading } = useMessages(conn.id);
  const send = useSendMessage(conn.id);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  function submit() {
    const body = draft.trim();
    if (!body) return;
    send.mutate(body, {
      onSuccess: () => setDraft(""),
      onError: (e: Error) => toast.error(e.message),
    });
    setDraft("");
  }

  const name = conn.other?.display_name ?? conn.other?.handle ?? "Creator";

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
            {conn.other?.creator_title || conn.other?.category || "—"}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {conn.intro_message && (
          <div className="mx-auto max-w-md rounded-2xl border border-primary/30 bg-primary/5 p-3 text-center text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Intro note:</span>{" "}
            {conn.intro_message}
          </div>
        )}
        {isLoading ? (
          <div className="h-12 animate-pulse rounded-2xl bg-surface" />
        ) : messages && messages.length > 0 ? (
          messages.map((m) => {
            const mine = m.sender_id === meId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "border border-border/60 bg-surface"
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        ) : (
          <p className="pt-8 text-center text-sm text-muted-foreground">
            Say hi — this is the beginning of your conversation.
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border/60 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
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
