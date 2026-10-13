// ── A member's GitHub account, as a cached public snapshot ───────────────────
// What the Studio's GitHub block shows about a connected account: who they
// are on GitHub, their contribution calendar, the languages they build in,
// their pinned / most-starred / most-recent public repositories and what they
// have been doing lately. Built on the server (syncGithubProfile, the daily
// job) and stored in profile_github, so profile views never call GitHub.
//
// PUBLIC DATA ONLY: everything comes from the named user's public endpoints
// (/users/:login, /users/:login/repos, /users/:login/events/public) and the
// public parts of GraphQL `user(login:)`. A token, when there is one, only
// lifts rate limits and unlocks GraphQL — private repos never reach this.

import { fetchWithTimeout, type CommitActivityWeek } from "./github";

export type GithubProfileRepo = {
  full_name: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  topics: string[];
  homepage: string | null;
  pushed_at: string | null;
  archived: boolean;
};

export type GithubRecentEvent = {
  kind: "push" | "pr_opened" | "pr_merged" | "release" | "repo_created" | "issue" | "review";
  repo: string;
  title: string;
  url: string;
  created_at: string;
  /** Commits pushed (when GitHub reports them). */
  count?: number;
  /** Pushes folded into this line (same repo, same day). */
  pushes?: number;
};

export type GithubProfileSnapshot = {
  login: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  html_url: string;
  created_at: string | null;
  followers: number;
  following: number;
  public_repos: number;
  total_stars: number;
  total_forks: number;
  languages: { language: string; share: number; repos: number }[];
  /** Public, non-fork repos, most starred first (up to 30). */
  repos: GithubProfileRepo[];
  /** Repos they forked from someone else (newest activity first, up to 10). */
  forked: { full_name: string; name: string; parent: string | null; pushed_at: string | null }[];
  forked_count: number;
  /** How many repos they've starred, and the most recent few. */
  starred_count: number | null;
  starred: {
    full_name: string;
    description: string | null;
    language: string | null;
    stars: number;
  }[];
  /** Pinned repo full names, when GitHub could tell us (needs a token). */
  pinned: string[] | null;
  /** The year's contribution calendar, when available (needs a token). */
  contributions: { total: number; weeks: CommitActivityWeek[] } | null;
  /** The last 90 days of public activity, counted. */
  activity: {
    pushes: number;
    commits: number;
    pull_requests: number;
    merged: number;
    issues: number;
    reviews: number;
    releases: number;
    repos_created: number;
    active_repos: number;
  };
  recent: GithubRecentEvent[];
  synced_at: string;
};

type RawRepo = {
  full_name: string;
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics?: string[];
  homepage: string | null;
  pushed_at: string | null;
  archived: boolean;
  fork: boolean;
  private: boolean;
  size: number;
};

type RawEvent = {
  type: string;
  repo: { name: string };
  created_at: string;
  payload: Record<string, unknown>;
};

const RECENT_DAYS = 90;

/** Public, non-fork repos; total stars/forks; language shares weighted by size. */
export function summarizeRepos(raw: RawRepo[]) {
  const own = raw.filter((r) => !r.fork && !r.private);
  const repos: GithubProfileRepo[] = own
    .map((r) => ({
      full_name: r.full_name,
      name: r.name,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count ?? 0,
      forks: r.forks_count ?? 0,
      topics: (r.topics ?? []).slice(0, 6),
      homepage: r.homepage || null,
      pushed_at: r.pushed_at,
      archived: !!r.archived,
    }))
    .sort(
      (a, b) =>
        b.stars - a.stars ||
        (Date.parse(b.pushed_at ?? "") || 0) - (Date.parse(a.pushed_at ?? "") || 0),
    );

  // Weight each repo's primary language by its size (at least 1), so one big
  // project counts for more than a pile of tiny experiments.
  const weight = new Map<string, { w: number; repos: number }>();
  for (const r of own) {
    if (!r.language) continue;
    const cur = weight.get(r.language) ?? { w: 0, repos: 0 };
    cur.w += Math.max(1, Math.sqrt(r.size || 1));
    cur.repos += 1;
    weight.set(r.language, cur);
  }
  const total = [...weight.values()].reduce((n, v) => n + v.w, 0);
  const languages = [...weight.entries()]
    .map(([language, v]) => ({
      language,
      share: total ? Math.round((v.w / total) * 100) : 0,
      repos: v.repos,
    }))
    .sort((a, b) => b.share - a.share || a.language.localeCompare(b.language))
    .filter((l) => l.share > 0)
    .slice(0, 8);

  const forked = raw
    .filter((r) => r.fork && !r.private)
    .sort((a, b) => (Date.parse(b.pushed_at ?? "") || 0) - (Date.parse(a.pushed_at ?? "") || 0))
    .map((r) => ({
      full_name: r.full_name,
      name: r.name,
      parent: null as string | null,
      pushed_at: r.pushed_at,
    }));

  return {
    forked: forked.slice(0, 10),
    forked_count: forked.length,
    repos: repos.slice(0, 30),
    total_stars: own.reduce((n, r) => n + (r.stargazers_count ?? 0), 0),
    total_forks: own.reduce((n, r) => n + (r.forks_count ?? 0), 0),
    languages,
  };
}

/** Count the last 90 days of public events and keep the notable ones. */
export function summarizeEvents(raw: RawEvent[], now = Date.now()) {
  const since = now - RECENT_DAYS * 24 * 60 * 60_000;
  const activity = {
    pushes: 0,
    commits: 0,
    pull_requests: 0,
    merged: 0,
    issues: 0,
    reviews: 0,
    releases: 0,
    repos_created: 0,
    active_repos: 0,
  };
  const recent: GithubRecentEvent[] = [];
  const repos = new Set<string>();
  const repoUrl = (name: string) => `https://github.com/${name}`;

  for (const e of raw) {
    if (Date.parse(e.created_at) < since) continue;
    const p = e.payload ?? {};
    const repo = e.repo?.name ?? "";
    repos.add(repo);
    if (e.type === "PushEvent") {
      // GitHub has stopped sending commit counts on some public push events;
      // pushes are counted either way, commits only when GitHub says.
      const count = Number(p.distinct_size ?? p.size ?? 0) || 0;
      activity.commits += count;
      activity.pushes += 1;
      // One line per repo (at its latest push), however the pushes interleave.
      const same = recent.find((r) => r.kind === "push" && r.repo === repo);
      if (same) {
        same.pushes = (same.pushes ?? 1) + 1;
        if (count) same.count = (same.count ?? 0) + count;
      } else
        recent.push({
          kind: "push",
          repo,
          title: `Pushed to ${repo.split("/")[1] ?? repo}`,
          url: repoUrl(repo),
          created_at: e.created_at,
          pushes: 1,
          ...(count ? { count } : {}),
        });
    } else if (e.type === "PullRequestEvent") {
      const pr = (p.pull_request ?? {}) as { title?: string; html_url?: string; merged?: boolean };
      if (p.action === "opened") {
        activity.pull_requests += 1;
        recent.push({
          kind: "pr_opened",
          repo,
          title: pr.title ?? "Opened a pull request",
          url: pr.html_url ?? repoUrl(repo),
          created_at: e.created_at,
        });
      } else if (p.action === "closed" && pr.merged) {
        activity.merged += 1;
        recent.push({
          kind: "pr_merged",
          repo,
          title: pr.title ?? "Merged a pull request",
          url: pr.html_url ?? repoUrl(repo),
          created_at: e.created_at,
        });
      }
    } else if (e.type === "IssuesEvent" && p.action === "opened") {
      activity.issues += 1;
      const issue = (p.issue ?? {}) as { title?: string; html_url?: string };
      recent.push({
        kind: "issue",
        repo,
        title: issue.title ?? "Opened an issue",
        url: issue.html_url ?? repoUrl(repo),
        created_at: e.created_at,
      });
    } else if (e.type === "PullRequestReviewEvent") {
      activity.reviews += 1;
    } else if (e.type === "ReleaseEvent" && p.action === "published") {
      activity.releases += 1;
      const release = (p.release ?? {}) as { name?: string; tag_name?: string; html_url?: string };
      recent.push({
        kind: "release",
        repo,
        title: release.name || release.tag_name || "Published a release",
        url: release.html_url ?? repoUrl(repo),
        created_at: e.created_at,
      });
    } else if (e.type === "CreateEvent" && p.ref_type === "repository") {
      activity.repos_created += 1;
      recent.push({
        kind: "repo_created",
        repo,
        title: `Created ${repo.split("/")[1] ?? repo}`,
        url: repoUrl(repo),
        created_at: e.created_at,
      });
    }
  }
  activity.active_repos = repos.size;
  return { activity, recent: recent.slice(0, 8) };
}

type CalendarWeek = { contributionDays: { date: string; contributionCount: number }[] };

/** GraphQL's contribution calendar in CommitGraph's week shape (Sunday-first). */
export function calendarToWeeks(weeks: CalendarWeek[]): CommitActivityWeek[] {
  return weeks
    .filter((w) => w.contributionDays.length > 0)
    .map((w) => {
      const first = new Date(`${w.contributionDays[0].date}T00:00:00Z`);
      const sunday = new Date(first.getTime() - first.getUTCDay() * 24 * 60 * 60_000);
      const days = [0, 0, 0, 0, 0, 0, 0];
      for (const d of w.contributionDays) {
        days[new Date(`${d.date}T00:00:00Z`).getUTCDay()] = d.contributionCount;
      }
      return {
        week: Math.floor(sunday.getTime() / 1000),
        total: days.reduce((n, c) => n + c, 0),
        days,
      };
    });
}

const GRAPHQL_QUERY = `query($login: String!) {
  user(login: $login) {
    pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { nameWithOwner isPrivate } } }
    starredRepositories { totalCount }
    repositories(first: 10, isFork: true, privacy: PUBLIC, orderBy: { field: PUSHED_AT, direction: DESC }) {
      totalCount
      nodes { nameWithOwner parent { nameWithOwner } }
    }
    contributionsCollection {
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
    }
  }
}`;

/** The last page number in GitHub's Link header, or null when it all fit on one page. */
export function lastPageFromLink(link: string | null): number | null {
  const last = link ? /[?&]page=(\d+)>;\s*rel="last"/.exec(link) : null;
  return last ? Number(last[1]) : null;
}

export type GithubProfileFetch =
  | { ok: true; snapshot: GithubProfileSnapshot }
  | { ok: false; reason: "not_found" | "rate_limited" | "unreachable" };

/** Build a member's public GitHub snapshot (server only — may use a token). */
export async function fetchGithubProfileSnapshot(
  login: string,
  token?: string,
): Promise<GithubProfileFetch> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const user = encodeURIComponent(login);

  const userRes = await fetchWithTimeout(`https://api.github.com/users/${user}`, { headers });
  if (!userRes) return { ok: false, reason: "unreachable" };
  // An expired or revoked token: everything here is public, so go without.
  if (userRes.status === 401 && token) return fetchGithubProfileSnapshot(login);
  if (userRes.status === 404) return { ok: false, reason: "not_found" };
  if (userRes.status === 403 || userRes.status === 429)
    return { ok: false, reason: "rate_limited" };
  if (!userRes.ok) return { ok: false, reason: "unreachable" };
  const u = (await userRes.json()) as Record<string, unknown>;

  const [reposRes, eventsRes, starredRes, graphRes] = await Promise.all([
    fetchWithTimeout(`https://api.github.com/users/${user}/repos?per_page=100&sort=pushed`, {
      headers,
    }),
    fetchWithTimeout(`https://api.github.com/users/${user}/events/public?per_page=100`, {
      headers,
    }),
    fetchWithTimeout(`https://api.github.com/users/${user}/starred?per_page=6`, { headers }),
    token
      ? fetchWithTimeout("https://api.github.com/graphql", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ query: GRAPHQL_QUERY, variables: { login } }),
        })
      : Promise.resolve(null),
  ]);

  const rawRepos = reposRes?.ok ? ((await reposRes.json()) as RawRepo[]) : [];
  const rawEvents = eventsRes?.ok ? ((await eventsRes.json()) as RawEvent[]) : [];
  const repoSummary = summarizeRepos(rawRepos);
  const events = summarizeEvents(rawEvents);

  type RawStar = {
    full_name: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    private?: boolean;
  };
  const rawStars = starredRes?.ok ? ((await starredRes.json()) as RawStar[]) : [];
  const starred = rawStars
    .filter((r) => !r.private)
    .map((r) => ({
      full_name: r.full_name,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count ?? 0,
    }));
  // Exact count: GraphQL's totalCount when there's a token (below); else the
  // full pages before the last one plus what's on the last.
  let starredCount: number | null = null;
  if (starredRes?.ok) {
    const lastPage = lastPageFromLink(starredRes.headers.get("link"));
    if (lastPage === null) starredCount = rawStars.length;
    else if (!token) {
      const tail = await fetchWithTimeout(
        `https://api.github.com/users/${user}/starred?per_page=6&page=${lastPage}`,
        { headers },
      );
      if (tail?.ok) starredCount = (lastPage - 1) * 6 + ((await tail.json()) as unknown[]).length;
    }
  }

  let pinned: string[] | null = null;
  let contributions: GithubProfileSnapshot["contributions"] = null;
  if (graphRes?.ok) {
    const graph = (await graphRes.json()) as {
      data?: {
        user?: {
          pinnedItems?: { nodes?: { nameWithOwner?: string; isPrivate?: boolean }[] };
          starredRepositories?: { totalCount: number };
          repositories?: {
            totalCount: number;
            nodes?: { nameWithOwner: string; parent?: { nameWithOwner: string } | null }[];
          };
          contributionsCollection?: {
            contributionCalendar?: { totalContributions: number; weeks: CalendarWeek[] };
          };
        } | null;
      };
    };
    const g = graph.data?.user;
    if (g) {
      pinned = (g.pinnedItems?.nodes ?? [])
        .filter((n) => n.nameWithOwner && !n.isPrivate)
        .map((n) => n.nameWithOwner as string);
      if (typeof g.starredRepositories?.totalCount === "number") {
        starredCount = g.starredRepositories.totalCount;
      }
      const parents = new Map(
        (g.repositories?.nodes ?? []).map((n) => [
          n.nameWithOwner,
          n.parent?.nameWithOwner ?? null,
        ]),
      );
      repoSummary.forked = repoSummary.forked.map((f) => ({
        ...f,
        parent: parents.get(f.full_name) ?? f.parent,
      }));
      const cal = g.contributionsCollection?.contributionCalendar;
      if (cal) contributions = { total: cal.totalContributions, weeks: calendarToWeeks(cal.weeks) };
    }
  }

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  return {
    ok: true,
    snapshot: {
      login: str(u.login) ?? login,
      name: str(u.name),
      avatar_url: str(u.avatar_url),
      bio: str(u.bio),
      company: str(u.company),
      location: str(u.location),
      blog: str(u.blog),
      html_url: str(u.html_url) ?? `https://github.com/${login}`,
      created_at: str(u.created_at),
      followers: num(u.followers),
      following: num(u.following),
      public_repos: num(u.public_repos),
      ...repoSummary,
      starred_count: starredCount,
      starred,
      pinned,
      contributions,
      ...events,
      synced_at: new Date().toISOString(),
    },
  };
}

/** Which repos a block shows, for its "Repositories" setting. */
export function pickRepos(
  snapshot: Pick<GithubProfileSnapshot, "repos" | "pinned">,
  mode: string,
  chosen: string[],
  limit: number,
): GithubProfileRepo[] {
  const byName = new Map(snapshot.repos.map((r) => [r.full_name.toLowerCase(), r]));
  const named = (names: string[]) =>
    names.map((n) => byName.get(n.toLowerCase())).filter((r): r is GithubProfileRepo => !!r);
  let list: GithubProfileRepo[];
  if (mode === "chosen") list = named(chosen);
  else if (mode === "pinned" && snapshot.pinned?.length) list = named(snapshot.pinned);
  else if (mode === "recent")
    list = [...snapshot.repos].sort(
      (a, b) => (Date.parse(b.pushed_at ?? "") || 0) - (Date.parse(a.pushed_at ?? "") || 0),
    );
  else list = snapshot.repos; // "top" — most starred
  return list.filter((r) => mode === "chosen" || !r.archived).slice(0, limit);
}
