import { buildSessionIcs, downloadIcs } from "@/lib/ical";
import type { SessionWithParticipants } from "@/hooks/use-sessions";

/**
 * Build and download an .ics for a session. Shared by the session detail page
 * and the Upcoming/Today list cards so the filename and body rules live in
 * one place. No-ops for unscheduled sessions.
 */
export function downloadSessionIcs(session: {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  duration_minutes: number;
  description?: string | null;
  location?: string | null;
  meeting_url?: string | null;
}): boolean {
  if (!session.starts_at) return false;
  const body = buildSessionIcs({
    uid: session.id,
    title: session.title,
    start: new Date(session.starts_at),
    end: session.ends_at ? new Date(session.ends_at) : null,
    durationMinutes: session.duration_minutes,
    description: session.description ?? null,
    location: session.location ?? null,
    meetingUrl: session.meeting_url ?? null,
  });
  const slug = session.title.replace(/[^\w-]+/g, "-").toLowerCase() || "session";
  downloadIcs(`${slug}.ics`, body);
  return true;
}

/** Convenience re-export for callers that already hold a full session row. */
export function sessionToIcsDownload(session: SessionWithParticipants): boolean {
  return downloadSessionIcs(session);
}
