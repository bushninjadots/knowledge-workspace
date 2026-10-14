// ── Dev journal ───────────────────────────────────────────────────────────────
// Short log lines (20261014160000_dev_journal.sql) and what they turn into:
// the daily standup, the weekly ship draft and the monthly brag doc. Pure
// functions, so the dock, the journal page, the API and the MCP server all
// write the same words.

export type JournalKind = "did" | "fixed" | "decided" | "learned" | "stuck" | "next";

export const JOURNAL_KINDS: {
  kind: JournalKind;
  label: string;
  placeholder: string;
  /** Prefix in standups and drafts ("" = the line speaks for itself). */
  prefix: string;
}[] = [
  { kind: "did", label: "Did", placeholder: "Built the settings page", prefix: "" },
  { kind: "fixed", label: "Fixed", placeholder: "the login redirect loop", prefix: "Fixed" },
  {
    kind: "decided",
    label: "Decided",
    placeholder: "Postgres queue over Redis — one less service",
    prefix: "Decided",
  },
  {
    kind: "learned",
    label: "Learned",
    placeholder: "how React transitions batch updates",
    prefix: "Learned",
  },
  { kind: "stuck", label: "Stuck", placeholder: "CORS on the upload endpoint", prefix: "Stuck on" },
  { kind: "next", label: "Next", placeholder: "wire up email reminders", prefix: "" },
];

export const JOURNAL_BODY_MAX = 500;
export const JOURNAL_DETAIL_MAX = 4000;

export function isJournalKind(value: unknown): value is JournalKind {
  return JOURNAL_KINDS.some((k) => k.kind === value);
}

export function kindLabel(kind: JournalKind): string {
  return JOURNAL_KINDS.find((k) => k.kind === kind)?.label ?? kind;
}

/** Friendly names for where an entry came from. */
const SOURCE_LABELS: Record<string, string> = {
  tethyr: "Tethyr",
  api: "API",
  mcp: "AI assistant",
  "claude-code": "Claude Code",
  claude: "Claude",
  cursor: "Cursor",
  windsurf: "Windsurf",
  copilot: "Copilot",
  vscode: "VS Code",
  git: "git",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  github: "GitHub",
  obsidian: "Obsidian",
  notion: "Notion",
  raycast: "Raycast",
  cli: "CLI",
};

export function sourceLabel(source: string | null | undefined): string | null {
  if (!source || source === "tethyr") return null;
  return SOURCE_LABELS[source] ?? source;
}

/** A tool's name → a stored source slug ("Claude Code" → "claude-code"). */
export function normalizeSource(raw: unknown, fallback = "api"): string {
  if (typeof raw !== "string") return fallback;
  const slug = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return /^[a-z0-9][a-z0-9_-]*$/.test(slug) ? slug : fallback;
}

export type JournalEntryLite = {
  kind: JournalKind;
  body: string;
  occurred_at: string;
  project_title?: string | null;
  resolved_at?: string | null;
  source_url?: string | null;
};

/* ── Days ──────────────────────────────────────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, "0");

/** The local calendar day of a timestamp, as YYYY-MM-DD. */
function dayKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** The last working day before `now` (Monday → Friday). */
export function previousWorkday(now: Date = new Date()): Date {
  const d = startOfDay(now);
  do d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

export function dayLabel(day: string, now: Date = new Date()): string {
  const today = dayKey(now);
  const y = new Date(startOfDay(now));
  y.setDate(y.getDate() - 1);
  if (day === today) return "Today";
  if (day === dayKey(y)) return "Yesterday";
  const [yy, mm, dd] = day.split("-").map(Number);
  return new Date(yy, mm - 1, dd).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Entries grouped by local day, newest day first (entries keep their order). */
export function groupByDay<T extends { occurred_at: string }>(
  entries: T[],
): { day: string; entries: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const key = dayKey(entry.occurred_at);
    const list = groups.get(key);
    if (list) list.push(entry);
    else groups.set(key, [entry]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, list]) => ({ day, entries: list }));
}

/* ── Lines ─────────────────────────────────────────────────────────────── */

/** "The bug" → "the bug", but "CORS" and "API" keep their case. */
function lowerFirst(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

/** One entry as a sentence ("Fixed the login loop (Tethyr)"). */
export function entryLine(entry: JournalEntryLite, withProject = true): string {
  const prefix = JOURNAL_KINDS.find((k) => k.kind === entry.kind)?.prefix ?? "";
  const body = entry.body.trim();
  // "Fixed: fixed the bug" reads badly — skip the prefix when the line starts with it.
  const text =
    prefix && !body.toLowerCase().startsWith(prefix.toLowerCase())
      ? `${prefix} ${lowerFirst(body)}`
      : `${body.charAt(0).toUpperCase()}${body.slice(1)}`;
  return withProject && entry.project_title ? `${text} (${entry.project_title})` : text;
}

/* ── Standup ───────────────────────────────────────────────────────────── */

/**
 * Yesterday / Today / Blockers, ready to paste into Slack or Teams.
 * Yesterday = the last working day plus anything logged today so far;
 * Today = "next" lines since then; Blockers = unresolved "stuck" lines from
 * the last week.
 */
export function buildStandup(entries: JournalEntryLite[], now: Date = new Date()): string {
  const since = previousWorkday(now).getTime();
  const weekAgo = startOfDay(now).getTime() - 7 * 86_400_000;
  const recent = entries.filter((e) => Date.parse(e.occurred_at) >= since);
  const done = recent.filter((e) => e.kind !== "next" && e.kind !== "stuck");
  const next = recent.filter((e) => e.kind === "next");
  const blockers = entries.filter(
    (e) => e.kind === "stuck" && !e.resolved_at && Date.parse(e.occurred_at) >= weekAgo,
  );
  const bullets = (list: JournalEntryLite[], empty: string) =>
    list.length ? list.map((e) => `• ${entryLine(e)}`).join("\n") : `• ${empty}`;
  return [
    "Yesterday",
    bullets(done, "Nothing logged"),
    "",
    "Today",
    bullets(next, "—"),
    "",
    "Blockers",
    bullets(blockers, "None"),
  ].join("\n");
}

/* ── Weekly ship draft ─────────────────────────────────────────────────── */

/** The week's journal as ship lines, notable kinds first, plus the latest "next". */
export function shipLinesFromJournal(entries: JournalEntryLite[]): {
  lines: string[];
  nextUp: string | null;
} {
  const order: JournalKind[] = ["did", "fixed", "decided", "learned"];
  const lines = entries
    .filter((e) => order.includes(e.kind))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .map((e) => entryLine(e))
    .slice(0, 12);
  const latestNext = entries
    .filter((e) => e.kind === "next")
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))[0];
  return { lines, nextUp: latestNext ? latestNext.body.slice(0, 200) : null };
}

/* ── Brag doc ──────────────────────────────────────────────────────────── */

/** [start, end) of a calendar month in local time, as ISO strings. */
export function monthRange(year: number, month: number): [string, string] {
  return [new Date(year, month, 1).toISOString(), new Date(year, month + 1, 1).toISOString()];
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

const BRAG_SECTIONS: { kind: JournalKind; title: string }[] = [
  { kind: "did", title: "Built & shipped" },
  { kind: "fixed", title: "Fixed" },
  { kind: "decided", title: "Decisions" },
  { kind: "learned", title: "Learned" },
];

const mdEscape = (text: string) => text.replace(/([\\`*_[\]])/g, "\\$1");

/**
 * The month as a Markdown brag doc — for a performance review, a CV, an
 * Obsidian vault or a Notion page (both import Markdown as-is).
 */
export function bragDocMarkdown(
  entries: JournalEntryLite[],
  title: string,
  name?: string | null,
): string {
  const counted = BRAG_SECTIONS.map((s) => ({
    ...s,
    items: entries
      .filter((e) => e.kind === s.kind)
      .sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at)),
  }));
  const resolved = entries.filter((e) => e.kind === "stuck" && e.resolved_at);
  const projects = new Set(entries.map((e) => e.project_title).filter(Boolean));
  const summary = [
    ...counted
      .filter((s) => s.items.length)
      .map((s) => `${s.items.length} ${s.title.toLowerCase()}`),
    resolved.length ? `${resolved.length} blockers cleared` : null,
    projects.size ? `across ${projects.size} project${projects.size === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const line = (e: JournalEntryLite) => {
    const date = new Date(e.occurred_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    const text = mdEscape(e.body.trim());
    const linked = e.source_url ? `[${text}](${e.source_url})` : text;
    const project = e.project_title ? ` — *${mdEscape(e.project_title)}*` : "";
    return `- ${linked}${project} (${date})`;
  };

  const out = [`# ${title}${name ? ` — ${name}` : ""}`, ""];
  out.push(summary ? `_${summary}_` : "_Nothing logged this month yet._", "");
  for (const section of counted) {
    if (!section.items.length) continue;
    out.push(`## ${section.title}`, "", ...section.items.map(line), "");
  }
  if (resolved.length) out.push("## Blockers cleared", "", ...resolved.map(line), "");
  return out.join("\n").trimEnd() + "\n";
}

/* ── Commits (git hook) ────────────────────────────────────────────────── */

/**
 * A commit message → a journal line, or null when it isn't worth logging.
 * Conventional commits decide: feat/perf/refactor → did, fix → fixed;
 * chore/docs/test/style/ci/build, merges and reverts are skipped. Anything
 * else is logged only when it says so with "[log]".
 */
export function parseCommitMessage(message: string): { kind: JournalKind; body: string } | null {
  const subject = message.split("\n")[0]?.trim() ?? "";
  if (!subject || /^(merge|revert)\b/i.test(subject)) return null;
  const tagged = /\[log\]/i.test(message);
  const clean = (text: string) =>
    text
      .replace(/\s*\[log\]\s*/gi, " ")
      .trim()
      .slice(0, 500);
  const conventional = subject.match(/^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/);
  if (conventional) {
    const [, type, scope, rest] = conventional;
    const t = type.toLowerCase();
    // Dependency bumps (Renovate, Dependabot, "fix(deps): …") aren't the story.
    if (!tagged && scope && /^deps(-dev)?$/i.test(scope)) return null;
    const body = clean(scope ? `${rest} (${scope})` : rest);
    if (!body) return null;
    if (t === "fix") return { kind: "fixed", body };
    if (t === "feat" || t === "perf" || t === "refactor") return { kind: "did", body };
    return tagged ? { kind: "did", body } : null;
  }
  return tagged && clean(subject) ? { kind: "did", body: clean(subject) } : null;
}
