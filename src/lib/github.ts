// Shared GitHub helpers used by both the client (pure parsing) and the server
// functions in src/lib/github-server.ts (README/meta fetching with the user's
// stored token). These functions are deliberately free of browser/server
// globals except `fetch`, so they are unit-testable in isolation.
//
// SECURITY: the GitHub token is stored server-side (user_github_tokens) and
// never reaches the browser. It is passed into these functions only by server
// code.

export type RepoReadmeResult = {
  text: string | null;
  /** GitHub rate-limit (or abuse) — retry later, don't keep hammering. */
  rateLimited: boolean;
  /** A token was sent but GitHub rejected it (401) — bad/expired token. */
  unauthorized: boolean;
};

/** These fetches run server-side (in server functions), so cap their duration. */
const FETCH_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    // Network error or timeout — callers treat null as "couldn't reach GitHub".
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type RepoMeta = {
  full_name?: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number | null;
  forks_count?: number | null;
  updated_at?: string | null;
  topics?: string[] | null;
  private?: boolean | null;
  default_branch?: string | null;
  homepage?: string | null;
  license?: string | null;
  open_issues_count?: number | null;
  created_at?: string | null;
  /** Cached 52-week commit history for the contribution graph (optional). */
  commit_activity?: CommitActivityWeek[] | null;
};

/** One week of the repo's commit history, as returned by the stats API. */
export type CommitActivityWeek = {
  /** Unix timestamp of the week's Monday (seconds, GitHub's shape). */
  week: number;
  total: number;
  /** Commits per day, Sunday-first, matching GitHub's stats endpoint. */
  days: number[];
};

export type CommitActivityResult = {
  weeks: CommitActivityWeek[] | null;
  /** GitHub is computing fresh stats — try again shortly. */
  pending: boolean;
  notFound: boolean;
  rateLimited: boolean;
};

/** Which parts of the linked repo's cached GitHub data a project page shows. */
export type GithubDisplay = {
  show_stats?: boolean;
  show_topics?: boolean;
  show_graph?: boolean;
  show_details?: boolean;
};

/** Absent keys (and a null column) mean "show it" — owners only opt OUT. */
export function githubDisplayShows(
  display: GithubDisplay | null | undefined,
  key: keyof GithubDisplay,
): boolean {
  return display?.[key] !== false;
}

type ContributionCalendarCell = {
  /** 0 = no commits, 1–4 = quartiles of the busiest day. */
  level: 0 | 1 | 2 | 3 | 4;
  count: number;
};

export type ContributionCalendar = {
  /** Columns of 7 cells (Sunday-first), matching GitHub's own layout. */
  weeks: ContributionCalendarCell[][];
  total: number;
};

/**
 * Merge several repos' 52-week commit histories into one aggregate grid:
 * aligned by week timestamp (GitHub keys weeks to Mondays), per-day sums.
 * Pure so the profile aggregate stays testable — a person's contribution
 * graph is the union of their linked repos' cached histories, never a fetch.
 */
export function mergeCommitActivity(weeksList: CommitActivityWeek[][]): CommitActivityWeek[] {
  const byWeek = new Map<number, number[]>();
  for (const weeks of weeksList) {
    for (const w of weeks) {
      const days = byWeek.get(w.week);
      if (!days) {
        byWeek.set(w.week, [...w.days]);
        continue;
      }
      for (let i = 0; i < Math.min(7, w.days.length); i++) days[i] += w.days[i] ?? 0;
    }
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, days]) => ({
      week,
      total: days.reduce((n, d) => n + d, 0),
      days,
    }));
}

/**
 * Turn GitHub's 52-week commit-activity shape into the contribution-graph
 * grid: one column per week, 7 cells per column (Sun–Sat), levels banded by
 * quartiles of the busiest single day — pure so the panel stays testable.
 */
export function buildContributionCalendar(weeks: CommitActivityWeek[]): ContributionCalendar {
  // GitHub normally returns all 52 columns, but cached snapshots and the
  // profile aggregate can be partial. Preserve empty weeks so a sparse repo
  // does not look artificially active or claim a shorter time window.
  const ordered = [...weeks].sort((a, b) => a.week - b.week);
  const latestWeek = ordered.at(-1)?.week;
  const byWeek = new Map(ordered.map((week) => [week.week, week]));
  const normalized =
    latestWeek === undefined
      ? []
      : Array.from({ length: 52 }, (_, index) => {
          const week = latestWeek - (51 - index) * 7 * 24 * 60 * 60;
          return byWeek.get(week) ?? { week, total: 0, days: [] };
        });
  const dayMax = Math.max(0, ...normalized.flatMap((w) => w.days));
  const levelFor = (count: number): ContributionCalendarCell["level"] => {
    if (count <= 0 || dayMax <= 0) return 0;
    if (count <= dayMax * 0.25) return 1;
    if (count <= dayMax * 0.5) return 2;
    if (count <= dayMax * 0.75) return 3;
    return 4;
  };
  let total = 0;
  const columns = normalized.map((w) => {
    total += w.total;
    return Array.from({ length: 7 }, (_, index) => {
      const count = w.days[index] ?? 0;
      return { level: levelFor(count), count };
    });
  });
  return { weeks: columns, total };
}

/** Extract "owner/repo" from a linked repo's stored metadata or URL. */
export function getRepoFullName(repo: {
  metadata?: { full_name?: string | null } | null;
  url: string;
}): string {
  return (
    repo.metadata?.full_name ??
    repo.url
      .replace(/^https?:\/\/(www\.)?github\.com\//, "")
      .replace(/\/$/, "")
      .replace(/\.git$/, "")
  );
}

/**
 * A human title from a repo's full name: the repo segment only, with `-`/`_`
 * runs spaced and words capitalized ("threadline-app" → "Threadline App").
 * Import pre-fills the project title from this; the creator edits from there.
 */
export function repoFullNameToTitle(fullName: string): string {
  const repoSegment = fullName.split("/").pop() ?? fullName;
  const spaced = repoSegment.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!spaced) return "";
  // Capitalize only words written entirely in lowercase; mixed-case words
  // ("iOS", "jQuery") are brands the author already cased deliberately.
  return spaced
    .split(" ")
    .map((word) => (/[A-Z]/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

/**
 * Point relative URLs in an imported README at the source repo so they resolve
 * on Tethyr instead of 404ing against local routes. Images go to
 * raw.githubusercontent.com; links go to the file on github.com. Absolute
 * URLs, fragment anchors, data URIs, and mailto: links are left untouched.
 * `branch` should be the repo's default branch when known (else "HEAD").
 */
export function absolutizeRelativeLinks(
  markdown: string,
  fullName: string,
  branch = "HEAD",
): string {
  return markdown.replace(
    /(!?)\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g,
    (match, bang, text, url, title) => {
      if (
        /^(?:https?:)?\/\//i.test(url) ||
        url.startsWith("#") ||
        url.startsWith("data:") ||
        url.startsWith("mailto:")
      ) {
        return match;
      }
      const path = url.startsWith("/") ? url : `/${url}`;
      if (bang === "!") {
        return `![${text}](https://raw.githubusercontent.com/${fullName}/${branch}${path}${title})`;
      }
      return `[${text}](https://github.com/${fullName}/blob/${branch}${path}${title})`;
    },
  );
}

/**
 * Fetch a repository's README text, or null when none is found.
 *
 * Public repos: raw.githubusercontent.com is tried first (HEAD/main/master),
 * then the GitHub API. When a token is supplied the API is used directly —
 * this works for private repos and sidesteps the unauthenticated 60 req/hr
 * rate limit.
 */
export async function fetchRepoReadme(fullName: string, token?: string): Promise<RepoReadmeResult> {
  if (!token) {
    for (const branch of ["HEAD", "main", "master"]) {
      const res = await fetchWithTimeout(
        `https://raw.githubusercontent.com/${fullName}/${branch}/README.md`,
      );
      if (res?.ok) return { text: await res.text(), rateLimited: false, unauthorized: false };
    }
  }

  const headers: Record<string, string> = { Accept: "application/vnd.github.v3.raw" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const apiRes = await fetchWithTimeout(`https://api.github.com/repos/${fullName}/readme`, {
    headers,
  });
  if (!apiRes) return { text: null, rateLimited: false, unauthorized: false };
  if (apiRes.ok) return { text: await apiRes.text(), rateLimited: false, unauthorized: false };
  if (apiRes.status === 401) return { text: null, rateLimited: false, unauthorized: true };
  if (apiRes.status === 403 || apiRes.status === 429) {
    return { text: null, rateLimited: true, unauthorized: false };
  }
  return { text: null, rateLimited: false, unauthorized: false };
}

type RepoFileResult = {
  text: string | null;
  /** Git blob SHA of the fetched file — used for idempotent re-sync. */
  sha: string | null;
  notFound: boolean;
  rateLimited: boolean;
  unauthorized: boolean;
};

function decodeBase64Utf8(b64: string): string {
  const bytes = Uint8Array.from(atob(b64.replace(/\n/g, "")), (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Fetch a single file from a repository via the contents API (JSON accept so
 * we also get the blob SHA for idempotent sync). Path segments are encoded
 * individually so spaces and slashes survive. Binary content (NUL byte after
 * decode) is rejected with text=null rather than surfaced as garbage.
 */
export async function fetchRepoFile(
  fullName: string,
  path: string,
  ref?: string,
  token?: string,
): Promise<RepoFileResult> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const search = new URLSearchParams();
  if (ref) search.set("ref", ref);
  const qs = search.size ? `?${search.toString()}` : "";

  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response | null;
  try {
    res = await fetchWithTimeout(
      `https://api.github.com/repos/${fullName}/contents/${encodedPath}${qs}`,
      { headers },
    );
  } catch {
    res = null;
  }
  if (!res)
    return { text: null, sha: null, notFound: false, rateLimited: false, unauthorized: false };
  if (res.status === 404)
    return { text: null, sha: null, notFound: true, rateLimited: false, unauthorized: false };
  if (res.status === 401)
    return { text: null, sha: null, notFound: false, rateLimited: false, unauthorized: true };
  if (res.status === 403 || res.status === 429)
    return { text: null, sha: null, notFound: false, rateLimited: true, unauthorized: false };
  if (!res.ok)
    return { text: null, sha: null, notFound: false, rateLimited: false, unauthorized: false };

  try {
    const json = (await res.json()) as { content?: string; encoding?: string; sha?: string };
    if (json.encoding !== "base64" || typeof json.content !== "string")
      return {
        text: null,
        sha: json.sha ?? null,
        notFound: false,
        rateLimited: false,
        unauthorized: false,
      };
    const text = decodeBase64Utf8(json.content);
    const binary = text.includes("\u0000");
    return {
      text: binary ? null : text,
      sha: json.sha ?? null,
      notFound: false,
      rateLimited: false,
      unauthorized: false,
    };
  } catch {
    return { text: null, sha: null, notFound: false, rateLimited: false, unauthorized: false };
  }
}

export type GithubCommitLite = {
  sha: string;
  message: string;
  html_url: string;
  committed_at: string;
  author_login: string | null;
  author_name: string | null;
};

/** Fetch recent commits for a linked repository, or an empty list on failure. */
export async function fetchRepoCommits(
  fullName: string,
  token?: string,
  perPage = 20,
): Promise<GithubCommitLite[]> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchWithTimeout(
    `https://api.github.com/repos/${fullName}/commits?per_page=${Math.min(Math.max(perPage, 1), 30)}`,
    { headers },
  );
  if (!res?.ok) return [];
  const json = (await res.json()) as {
    sha?: string;
    html_url?: string;
    commit?: {
      message?: string;
      author?: { name?: string | null; date?: string | null } | null;
    } | null;
    author?: { login?: string | null } | null;
  }[];
  return json.flatMap((row) => {
    if (!row.sha || !row.html_url || !row.commit?.message) return [];
    return [
      {
        sha: row.sha,
        message: row.commit.message.split("\\n")[0].trim(),
        html_url: row.html_url,
        committed_at: row.commit.author?.date ?? new Date().toISOString(),
        author_login: row.author?.login ?? null,
        author_name: row.commit.author?.name ?? null,
      },
    ];
  });
}

/** Fetch a repo's metadata (stars, language, description, …), or null. */
export async function fetchRepoMeta(
  owner: string,
  repo: string,
  token?: string,
): Promise<RepoMeta | null> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetchWithTimeout(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
    });
    if (!res?.ok) return null;
    const json = (await res.json()) as {
      full_name?: string;
      description?: string | null;
      language?: string | null;
      stargazers_count?: number;
      forks_count?: number;
      updated_at?: string;
      topics?: string[];
      private?: boolean;
      default_branch?: string;
      homepage?: string | null;
      open_issues_count?: number;
      created_at?: string;
      license?: { spdx_id?: string | null } | null;
    };
    return {
      full_name: json.full_name,
      description: json.description,
      language: json.language,
      stargazers_count: json.stargazers_count,
      forks_count: json.forks_count,
      updated_at: json.updated_at,
      topics: json.topics,
      private: json.private,
      default_branch: json.default_branch,
      homepage: json.homepage,
      license:
        json.license?.spdx_id && json.license.spdx_id !== "NOASSERTION"
          ? json.license.spdx_id
          : null,
      open_issues_count: json.open_issues_count,
      created_at: json.created_at,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch the repo's last 52 weeks of commit activity (GitHub's stats API).
 * The first call for a rarely-queried repo returns 202 while GitHub computes
 * the stats — the caller should treat that as "try again later" and keep the
 * previous cached value rather than hammering the endpoint.
 */
export async function fetchRepoCommitActivity(
  fullName: string,
  token?: string,
): Promise<CommitActivityResult> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetchWithTimeout(
      `https://api.github.com/repos/${fullName}/stats/commit_activity`,
      { headers },
    );
    if (!res) return { weeks: null, pending: false, notFound: false, rateLimited: false };
    if (res.status === 202)
      return { weeks: null, pending: true, notFound: false, rateLimited: false };
    if (res.status === 404)
      return { weeks: null, pending: false, notFound: true, rateLimited: false };
    if (res.status === 403 || res.status === 429)
      return { weeks: null, pending: false, notFound: false, rateLimited: true };
    if (!res.ok) return { weeks: null, pending: false, notFound: false, rateLimited: false };
    const json = (await res.json()) as { week?: number; total?: number; days?: number[] }[];
    if (!Array.isArray(json))
      return { weeks: null, pending: false, notFound: false, rateLimited: false };
    const weeks = json
      .filter((w) => typeof w.week === "number" && Array.isArray(w.days))
      .map((w) => ({
        week: w.week as number,
        total: w.total ?? 0,
        days: (w.days ?? []).slice(0, 7),
      }));
    return { weeks: weeks.slice(-52), pending: false, notFound: false, rateLimited: false };
  } catch {
    return { weeks: null, pending: false, notFound: false, rateLimited: false };
  }
}

export type GithubRepoLite = {
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  private: boolean;
};

/**
 * List a user's public (and, with a token, private) repositories.
 * Without a token this uses the unauthenticated /users/:username/repos
 * endpoint (subject to the usual 60 req/hr rate limit); with a token it uses
 * the authenticated /user/repos endpoint which includes private repos.
 */
export async function fetchUserRepos(
  username: string,
  token?: string,
  /** A public-only token for the named user's list (rate limits only). */
  publicToken?: string,
): Promise<GithubRepoLite[]> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  const auth = token ?? publicToken;
  if (auth) headers.Authorization = `Bearer ${auth}`;

  // With a token, /user/repos returns the authenticated user's own repos
  // (including private ones) regardless of the username argument.
  const url = token
    ? "https://api.github.com/user/repos?per_page=30&sort=updated"
    : `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=30&sort=updated`;

  const res = await fetchWithTimeout(url, { headers });
  if (!res?.ok) return [];
  const json = (await res.json()) as {
    full_name: string;
    html_url: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    private: boolean;
  }[];
  return json.map((r) => ({
    full_name: r.full_name,
    html_url: r.html_url,
    description: r.description,
    language: r.language,
    stargazers_count: r.stargazers_count ?? 0,
    private: r.private ?? false,
  }));
}

type TokenValidation =
  | { ok: true; username: string }
  | { ok: false; reason: "unauthorized" | "network" | "empty" | "storage" };

/** Validate a GitHub token by calling the /user endpoint. */
export async function validateGitHubToken(token: string): Promise<TokenValidation> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  try {
    const res = await fetchWithTimeout("https://api.github.com/user", {
      headers: { Accept: "application/vnd.github.v3+json", Authorization: `Bearer ${trimmed}` },
    });
    if (!res) return { ok: false, reason: "network" };
    if (res.status === 401) return { ok: false, reason: "unauthorized" };
    if (!res.ok) return { ok: false, reason: "network" };
    const json = (await res.json()) as { login?: string };
    return { ok: true, username: String(json.login ?? "") };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** Human-readable message for a TokenValidation failure reason. */
export function githubTokenErrorMessage(
  reason: "unauthorized" | "network" | "empty" | "storage",
): string {
  if (reason === "unauthorized") return "GitHub rejected that token — check it and try again";
  if (reason === "network") return "Couldn't reach GitHub to validate the token — try again";
  if (reason === "storage") return "We couldn't save the token on our end — try again";
  return "Enter a GitHub token to save it";
}
