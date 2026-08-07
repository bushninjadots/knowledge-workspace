import { History, Clock, Users } from "lucide-react";
import type { SessionWithParticipants } from "@/hooks/use-sessions";
import { TYPE_LABELS } from "./sessions-sidebar";

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function HistoryCard({ session }: { session: SessionWithParticipants }) {
  const type = TYPE_LABELS[session.session_type] ?? session.session_type;
  const participantCount = session.participants?.length ?? 0;

  return (
    <div className="group flex items-start gap-4 rounded-2xl border border-border/40 bg-surface/30 p-4 transition-all hover:border-border/60 hover:bg-surface/50">
      {/* Date badge */}
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-elevated">
        <span className="text-[11px] font-semibold uppercase text-muted-foreground">
          {session.starts_at
            ? new Date(session.starts_at).toLocaleDateString(undefined, { weekday: "short" })
            : "—"}
        </span>
        <span className="text-lg font-bold tabular-nums text-foreground">
          {session.starts_at ? new Date(session.starts_at).getDate() : "—"}
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground">{session.title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{type}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(session.duration_minutes)}
          </span>
          {session.skills && (
            <span className="inline-flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium">
              {session.skills.name}
            </span>
          )}
          {session.projects && (
            <span className="inline-flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium">
              📁 {session.projects.title}
            </span>
          )}
          {participantCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {participantCount} participant{participantCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <span className="shrink-0 rounded-full bg-trust-subtle px-2 py-0.5 text-[11px] font-medium text-trust">
        🏁 Completed
      </span>
    </div>
  );
}

export function SessionHistory({
  sessions,
  loading,
}: {
  sessions: SessionWithParticipants[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface/50" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-surface/20 p-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-elevated">
          <History className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No completed sessions yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Your session history will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Session History</h3>
        <span className="text-[11px] text-muted-foreground">{sessions.length} completed</span>
      </div>
      <div className="space-y-2">
        {sessions.map((session) => (
          <HistoryCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}
