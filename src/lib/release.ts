// Release countdown (projects.release_*, 20261014200000).

type ReleaseState = "none" | "upcoming" | "shipped";

export function releaseState(releaseAt: string | null | undefined, now = Date.now()): ReleaseState {
  if (!releaseAt) return "none";
  return Date.parse(releaseAt) > now ? "upcoming" : "shipped";
}

export function countdownParts(releaseAt: string, now = Date.now()) {
  const ms = Math.max(0, Date.parse(releaseAt) - now);
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86_400),
    hours: Math.floor((s % 86_400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    done: ms === 0,
  };
}

/** "3d 04:12:09", "04:12:09" under a day. */
export function countdownLabel(releaseAt: string, now = Date.now()): string {
  const { days, hours, minutes, seconds } = countdownParts(releaseAt, now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days > 0 ? `${days}d ` : ""}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** Just shipped (within `days`)? — when the owner sees the celebration. */
export function recentlyShipped(releaseAt: string | null | undefined, days = 7, now = Date.now()) {
  if (!releaseAt) return false;
  const t = Date.parse(releaseAt);
  return t <= now && now - t < days * 86_400_000;
}

/** A project is ready to plan its release once the work is done. */
export function readyToRelease(p: {
  status?: string | null;
  progress_percent?: number | null;
  milestonesTotal?: number;
  milestonesDone?: number;
}): boolean {
  if (p.status === "completed" || (p.progress_percent ?? 0) >= 100) return true;
  return !!p.milestonesTotal && p.milestonesDone === p.milestonesTotal;
}

/** <input type="datetime-local"> value for an ISO time, in local time. */
export function toLocalInput(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 7 * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
