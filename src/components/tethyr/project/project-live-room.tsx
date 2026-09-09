import { useEffect, useRef, useState } from "react";
import { CalendarPlus, DoorOpen, LogOut, Radio, Send } from "lucide-react";
import { useProjectRoom, type RoomIdentity, type RoomOccupant } from "@/hooks/use-project-room";

/**
 * The "jump in" room, surfaced from the project workspace. It turns a
 * read-only project page into a live co-working window: see who is here right
 * now, drop into a shared scratch chat, and formalize the moment into a real
 * Session. Presence and chat are ephemeral (Supabase Realtime, no persistence)
 * — the durable record is the Session created via the existing sessions flow.
 */
export function ProjectLiveRoom({
  projectId,
  me,
  canStartSession,
  onStartSession,
  onSignIn,
}: {
  projectId: string;
  me: RoomIdentity | null;
  canStartSession: boolean;
  onStartSession?: () => void;
  onSignIn?: () => void;
}) {
  const { joined, occupants, messages, join, leave, sendMessage } = useProjectRoom(projectId, me);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const liveCount = occupants.length;
  const isLive = liveCount > 0;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendMessage(draft);
    setDraft("");
  };

  return (
    <section
      id="project-room"
      aria-labelledby="project-room-heading"
      className="mt-10 scroll-mt-24 border-t border-border/60 pt-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2
              id="project-room-heading"
              className="font-display text-lg font-semibold tracking-tight"
            >
              Work on it now
            </h2>
            <LiveBadge isLive={isLive} count={liveCount} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Jump into a live co-working room instead of emailing — see who&apos;s here, think out
            loud, and turn the moment into a session.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {me ? (
            joined ? (
              <button
                type="button"
                onClick={leave}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                Leave room
              </button>
            ) : (
              <button
                type="button"
                onClick={join}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--user-accent,var(--primary))] px-3 py-2 text-xs font-semibold text-[var(--user-accent-foreground,var(--background))] transition hover:opacity-90"
              >
                <DoorOpen className="h-3.5 w-3.5" />
                Jump in
              </button>
            )
          ) : (
            onSignIn && (
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--user-accent,var(--primary))] px-3 py-2 text-xs font-semibold text-[var(--user-accent-foreground,var(--background))] transition hover:opacity-90"
              >
                <DoorOpen className="h-3.5 w-3.5" />
                Sign in to jump in
              </button>
            )
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,240px)_1fr]">
        <PresenceRail occupants={occupants} meId={me?.userId ?? null} />

        <div className="min-w-0">
          {joined ? (
            <div className="flex h-full flex-col rounded-xl border border-[var(--user-accent-border,var(--border))] bg-surface/40">
              <div
                ref={scrollRef}
                className="max-h-72 min-h-40 flex-1 overflow-y-auto px-4 py-3"
                aria-live="polite"
              >
                {messages.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    The scratch board is empty. Say what you&apos;re working on to get things going.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {messages.map((m) => (
                      <li key={m.id} className="text-sm">
                        <span
                          className={
                            m.userId === me?.userId
                              ? "font-medium text-[var(--user-accent,var(--primary))]"
                              : "font-medium text-foreground"
                          }
                        >
                          {m.userId === me?.userId ? "You" : m.name}
                        </span>
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {new Date(m.at).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-foreground/90">
                          {m.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <form
                onSubmit={handleSend}
                className="flex items-center gap-2 border-t border-border/50 px-3 py-2.5"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing &&
                      e.keyCode !== 229
                    ) {
                      handleSend(e);
                    }
                  }}
                  placeholder="Think out loud, share a link, pair up…"
                  maxLength={500}
                  className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  aria-label="Room message"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--user-accent,var(--primary))] text-[var(--user-accent-foreground,var(--background))] transition hover:opacity-90 disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>

              <div className="flex items-center justify-between gap-3 border-t border-border/50 px-3 py-2">
                <span className="text-[11px] text-muted-foreground">
                  Live &amp; unsaved — capture anything worth keeping in a session.
                </span>
                {canStartSession && onStartSession && (
                  <button
                    type="button"
                    onClick={onStartSession}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    <CalendarPlus className="h-3 w-3" />
                    Turn into a session
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-40 flex-col items-start justify-center rounded-xl border border-dashed border-border/60 bg-surface/20 px-5 py-6">
              <p className="text-sm font-medium text-foreground">
                {isLive
                  ? `${liveCount} ${liveCount === 1 ? "person is" : "people are"} working in here right now.`
                  : "No one is in the room yet."}
              </p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {isLive
                  ? "Jump in to see the shared scratch board and co-work in real time."
                  : "Be the first to open a working window — anyone watching the project can join you."}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LiveBadge({ isLive, count }: { isLive: boolean; count: number }) {
  if (!isLive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        Quiet
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--user-accent-border,var(--border-strong))] bg-[var(--user-accent-subtle,var(--surface-elevated))] px-2 py-0.5 text-[11px] font-medium text-foreground">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--user-accent,var(--primary))] opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--user-accent,var(--primary))]" />
      </span>
      {count} live
    </span>
  );
}

function PresenceRail({
  occupants,
  meId,
}: {
  occupants: RoomOccupant[];
  meId: string | null;
}) {
  return (
    <div className="lg:border-r lg:border-border/40 lg:pr-5">
      <div className="flex items-center gap-1.5">
        <Radio className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="section-label">In the room</span>
      </div>
      {occupants.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Empty for now.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {occupants.map((o) => (
            <li key={o.userId} className="flex items-center gap-2.5">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs font-semibold text-foreground ${
                  o.userId === meId
                    ? "ring-2 ring-[var(--user-accent,var(--primary))] ring-offset-1 ring-offset-background"
                    : ""
                }`}
                aria-hidden="true"
              >
                {initials(o.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {o.userId === meId ? "You" : o.name}
                </p>
                {o.handle && (
                  <p className="truncate text-[11px] text-muted-foreground">@{o.handle}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
