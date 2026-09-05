export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

export type TimeZone = (typeof TIMEZONES)[number];

export function getUserTimezone(): TimeZone {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if ((TIMEZONES as readonly string[]).includes(tz)) return tz as TimeZone;
  return "UTC";
}

export function formatTimezone(tz: string): string {
  return tz.replace(/_/g, " ");
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const wall: Record<string, number | undefined> = {};
  for (const part of parts) {
    if (part.type !== "literal") wall[part.type] = Number(part.value);
  }
  const wallAsUtc = Date.UTC(
    wall.year ?? 1970,
    (wall.month ?? 1) - 1,
    wall.day ?? 1,
    wall.hour ?? 0,
    wall.minute ?? 0,
    wall.second ?? 0,
  );
  return wallAsUtc - instant.getTime();
}

/**
 * Convert a local wall-clock ("2026-07-15" + "12:00") into the UTC instant
 * that clock represents *in the given timezone*. Sessions are stored as UTC
 * ISO; building the instant from the browser's zone and the user's chosen
 * zone disagreeing would schedule the wrong local time.
 */
export function zonedDateTimeToUtcIso(date: string, time: string, timeZone: string): string {
  const naiveUtc = Date.parse(`${date}T${time}Z`);
  if (Number.isNaN(naiveUtc)) throw new Error(`Invalid date/time: ${date}T${time}`);
  return new Date(naiveUtc - timeZoneOffsetMs(new Date(naiveUtc), timeZone)).toISOString();
}
