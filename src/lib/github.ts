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
};

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
    const json = (await res.json()) as RepoMeta;
    return {
      full_name: json.full_name,
      description: json.description,
      language: json.language,
      stargazers_count: json.stargazers_count,
      forks_count: json.forks_count,
      updated_at: json.updated_at,
      topics: json.topics,
      private: json.private,
    };
  } catch {
    return null;
  }
}

export type TokenValidation =
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
