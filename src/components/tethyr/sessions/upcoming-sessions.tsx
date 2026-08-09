import { CalendarDays, Video, MoreHorizontal, MapPin } from "lucide-react";
import type { SessionWithParticipants } from "@/hooks/use-sessions";
import { STATUS_CONFIG, TYPE_LABELS } from "./sessions-sidebar";

function formatDate(iso: string | null) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string | null) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function UpcomingCard({
  session,
  onClick,
}: {
  session: SessionWithParticipants;
  onClick?: () => void;
}) {
  const status = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.scheduled;
  const type = TYPE_LABELS[session.session_type] ?? session.session_type;
  const start = session.starts_at ? new Date(session.starts_at) : null;
  const participantCount = session.participants?.length ?? 0;

  return (
    <div
      onClick={onClick}
      className="group flex items-start gap-4 rounded-xl border card-border bg-surface/30 p-4 transition-all hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface/50 cursor-pointer"
    >
      {/* Date badge */}
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-elevated">
        {start ? (
          <>
            <span className="text-[11px] font-semibold uppercase text-brand-green">
              {start.toLocaleDateString(undefined, { weekday: "short" })}
            </span>
            <span className="text-lg font-bold tabular-nums text-foreground">
              {start.getDate()}
            </span>
          </>
        ) : (
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="text-sm font-semibold text-foreground">{session.title}</h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.bg} ${status.color}`}
          >
            {status.icon} {status.label}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{type}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {formatDate(session.starts_at)}
          </span>
          <span className="inline-flex items-center gap-1">
            🕐 {formatTime(session.starts_at)} – {formatTime(session.ends_at)}
          </span>
          <span>{formatDuration(session.duration_minutes)}</span>
          {session.meeting_url && (
            <span className="inline-flex items-center gap-1 text-brand-green">
              <Video className="h-3 w-3" /> Online
            </span>
          )}
          {session.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {session.location}
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-3">
          {session.skills && (
            <span className="inline-flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {session.skills.name}
            </span>
          )}
          {session.projects && (
            <span className="inline-flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              📁 {session.projects.title}
            </span>
          )}
          {participantCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="flex -space-x-1.5">
                {session.participants.slice(0, 3).map((p) => (
                  <span
                    key={p.id}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-brand text-[8px] font-bold text-background ring-2 ring-surface"
                  >
                    {p.profiles?.display_name?.charAt(0) ?? "?"}
                  </span>
                ))}
              </span>
              {participantCount}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {session.meeting_url && (
          <a
            href={session.meeting_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-brand-green/10 p-2 text-brand-green transition-colors hover:bg-brand-green/20"
            title="Join"
          >
            <Video className="h-3.5 w-3.5" />
          </a>
        )}
        <button
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          title="More"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function UpcomingSessions({
  sessions,
  onSessionClick,
}: {
  sessions: SessionWithParticipants[];
  onSessionClick?: (session: SessionWithParticipants) => void;
}) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border card-border bg-surface/20 p-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No upcoming sessions</p>
        <p className="mt-1 text-xs text-muted-foreground">Schedule a session to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Upcoming Sessions</h3>
        <span className="text-[11px] text-muted-foreground">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {sessions.map((session) => (
          <UpcomingCard
            key={session.id}
            session={session}
            onClick={() => onSessionClick?.(session)}
          />
        ))}
      </div>
    </div>
  );
}
