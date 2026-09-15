/**
 * Minimal RFC 5545 (iCal) event builder for the "Add to calendar" export.
 * Covers the subset sessions need: a timed event, a description, a location,
 * and an organizer line — no recurrence expansion (recurring sessions export
 * the individual occurrence the user is looking at).
 */

/** Escape per RFC 5545 §3.3.11 (TEXT). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets per RFC 5545 §3.1. */
function foldLine(line: string): string {
  if (line.length <= 73) return line; // 75 minus CRLF headroom
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 72)}`);
    rest = rest.slice(72);
  }
  return parts.join("\r\n");
}

/**
 * Build a .ics file body for one event. `start`/`end` are UTC instants;
 * `durationMinutes` is used when `end` is null.
 */
export function buildSessionIcs(input: {
  uid: string;
  title: string;
  start: Date;
  end: Date | null;
  durationMinutes: number;
  description?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
}): string {
  const end = input.end ?? new Date(input.start.getTime() + input.durationMinutes * 60_000);
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tethyr//Sessions//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}@tethyr`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(input.start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escapeText(input.title)}`,
  ];

  const descriptionParts = [input.description?.trim(), input.meetingUrl?.trim()].filter(
    Boolean,
  ) as string[];
  if (descriptionParts.length > 0) {
    lines.push(`DESCRIPTION:${escapeText(descriptionParts.join("\n\n"))}`);
  }
  if (input.location?.trim()) {
    lines.push(`LOCATION:${escapeText(input.location.trim())}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Trigger a client-side download of an .ics file. */
export function downloadIcs(filename: string, body: string): void {
  const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
