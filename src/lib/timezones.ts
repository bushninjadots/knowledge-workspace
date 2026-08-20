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
