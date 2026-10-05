// Sessions on a project page — live working time, visible to the team.

import { Link } from "@tanstack/react-router";
import { CalendarPlus } from "lucide-react";
import type { useProjectSessions } from "@/hooks/use-sessions";

type ProjectSession = NonNullable<ReturnType<typeof useProjectSessions>["data"]>[number];

export function ProjectSessionsSection({
  sessions,
  canSchedule,
  onSchedule,
}: {
  sessions: ProjectSession[];
  canSchedule: boolean;
  onSchedule: () => void;
}) {
  return (
    <section
      id="project-sessions"
      aria-labelledby="project-sessions-heading"
      className="mt-10 scroll-mt-24 border-t border-border/60 pt-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="project-sessions-heading"
            className="font-display text-lg font-semibold tracking-tight"
          >
            Sessions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Live working time on this project — past, present, and next.
          </p>
        </div>
        {canSchedule && (
          <button
            type="button"
            onClick={onSchedule}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-lift hover:text-foreground"
          >
            <CalendarPlus className="h-3 w-3" />
            Schedule session
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No sessions scheduled for this project yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border/50">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                to="/sessions/$id"
                params={{ id: s.id }}
                className="flex items-center justify-between gap-4 py-3 transition-lift hover:bg-surface-elevated/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.starts_at
                      ? new Date(s.starts_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "Unscheduled"}
                    {s.organizer?.display_name ? ` · ${s.organizer.display_name}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {s.status.replace(/_/g, " ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
