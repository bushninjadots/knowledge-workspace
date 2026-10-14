// ── Ship log ──────────────────────────────────────────────────────────────────
// One short "what I shipped" note per member per week (20261014150000_ship_log
// .sql). Pure helpers: the week a date falls in, the streak label, and the
// draft built from a member's public GitHub activity for the week.

import { summarizeEvents, type GithubRecentEvent, type RawEvent } from "./github-profile";

export const SHIP_BODY_MIN = 3;
export const SHIP_BODY_MAX = 1000;
export const SHIP_NEXT_MAX = 200;
export const SHIP_REPLY_MAX = 500;
const SHIP_HIGHLIGHTS_MAX = 8;

export type ShipHighlight = Pick<GithubRecentEvent, "kind" | "title" | "url" | "repo">;

/** Monday 00:00 UTC of the week `date` is in, as YYYY-MM-DD (the server's
 *  current_ship_week()). */
export function shipWeekOf(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sunday → 7
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

/** The week before (or `offset` weeks from) a YYYY-MM-DD week start. */
export function shiftWeek(week: string, offset: number): string {
  const d = new Date(`${week}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset * 7);
  return d.toISOString().slice(0, 10);
}

/** "This week", "Last week", or "Week of 5 Oct". */
export function weekLabel(week: string, current: string = shipWeekOf()): string {
  if (week === current) return "This week";
  if (week === shiftWeek(current, -1)) return "Last week";
  const d = new Date(`${week}T00:00:00Z`);
  return `Week of ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
}

/** A streak worth showing ("3-week streak"), or null for 0–1. */
export function streakLabel(streak: number | null | undefined): string | null {
  return streak && streak > 1 ? `${streak}-week streak` : null;
}

/** Only https links are ever rendered from a ship. */
export function safeHighlightUrl(url: string): string | null {
  return /^https:\/\//i.test(url) ? url : null;
}

const repoShort = (repo: string) => repo.split("/")[1] ?? repo;

/** One line of the draft for one GitHub event. */
function highlightLine(e: GithubRecentEvent): string {
  const repo = repoShort(e.repo);
  switch (e.kind) {
    case "pr_merged":
      return `Merged “${e.title}” in ${repo}`;
    case "pr_opened":
      return `Opened “${e.title}” in ${repo}`;
    case "release":
      return `Released ${e.title} of ${repo}`;
    case "repo_created":
      return `Started ${repo}`;
    case "issue":
      return `Opened an issue in ${repo}: “${e.title}”`;
    case "push":
      return e.count
        ? `Pushed ${e.count} commit${e.count === 1 ? "" : "s"} to ${repo}`
        : `Pushed to ${repo}`;
    default:
      return e.title;
  }
}

export type ShipDraft = {
  body: string;
  highlights: ShipHighlight[];
  /** Counted from the week's public events. */
  stats: { commits: number; merged: number; releases: number; repos: number };
};

/**
 * The week's draft from public GitHub events: the notable things first
 * (releases, merged PRs, new repos), pushes last. Empty body when there was
 * no public activity this week — the member writes their own.
 */
export function draftShipFromEvents(raw: RawEvent[], week: string, now = Date.now()): ShipDraft {
  const since = Date.parse(`${week}T00:00:00Z`);
  const thisWeek = raw.filter((e) => Date.parse(e.created_at) >= since);
  const { activity, recent } = summarizeEvents(thisWeek, now);
  const order: GithubRecentEvent["kind"][] = [
    "release",
    "pr_merged",
    "repo_created",
    "pr_opened",
    "issue",
    "push",
  ];
  const picked = [...recent]
    .filter((e) => order.includes(e.kind))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .slice(0, SHIP_HIGHLIGHTS_MAX);
  const body = picked.length
    ? `This week I:\n${picked.map((e) => `- ${highlightLine(e)}`).join("\n")}`
    : "";
  return {
    body,
    highlights: picked.map(({ kind, title, url, repo }) => ({ kind, title, url, repo })),
    stats: {
      commits: activity.commits,
      merged: activity.merged,
      releases: activity.releases,
      repos: activity.active_repos,
    },
  };
}

/** Friendly copy for the server's ship-related errors. */
export function shipErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String((error as { message?: string })?.message ?? "");
  if (message.includes("rate_limited")) return message.replace(/^.*rate_limited:\s*/, "");
  if (message.includes("invalid_highlight"))
    return "One of the links isn't valid — remove it and try again.";
  if (message.includes("duplicate key"))
    return "You've already posted this week's ship — edit it instead.";
  // Replies need a confirmed email (the only RLS check a member can fail).
  if (message.includes("row-level security"))
    return "Confirm your email first — then you can reply.";
  return "Something went wrong. Try again.";
}

/** A ship as a post for LinkedIn / X, ending with the member's profile link. */
export function shipShareText(
  ship: { body: string; next_up?: string | null },
  profileUrl: string,
  maxLength?: number,
): string {
  const tail = `\n\nShipping every week on Tethyr → ${profileUrl}`;
  const next = ship.next_up ? `\n\nNext up: ${ship.next_up}` : "";
  let body = `${ship.body.trim()}${next}`;
  if (maxLength && body.length + tail.length > maxLength) {
    body = `${body.slice(0, Math.max(0, maxLength - tail.length - 1)).trimEnd()}…`;
  }
  return `${body}${tail}`;
}

export function linkedInShareUrl(text: string): string {
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
}

export function xShareUrl(text: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}
