// ── Project → journal sync ────────────────────────────────────────────────────
// "Where it lives" pays off: for each project a member owns that links a
// GitHub or GitLab repo, their recent feat/fix commits (and anything tagged
// [log]) become private journal entries under that project. Runs on the
// server with the service role; idempotent through the unique
// (author_id, source_url) index — each commit's URL is stored once.
//
// GitHub: commits by the member's connected GitHub login (all commits when no
// account is connected). GitLab: public projects on gitlab.com.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { fetchRepoCommits, fetchWithTimeout } from "./github";
import { parseCommitMessage } from "./journal";

type Admin = SupabaseClient<Database>;

const MAX_REPOS = 10;
const SINCE_DAYS = 30;

type Commit = { url: string; message: string; at: string; author: string | null };

/** "https://github.com/acme/app(.git)" → "acme/app" (or null). */
export function repoPath(url: string, host: "github.com" | "gitlab.com"): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.replace(/^www\./, "") !== host) return null;
    const parts = u.pathname
      .replace(/\.git$/, "")
      .split("/")
      .filter(Boolean);
    // GitLab groups nest; stop at "/-/" (tree, issues…).
    const end = parts.indexOf("-");
    const path = (end === -1 ? parts : parts.slice(0, end)).join("/");
    if (host === "github.com") return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
    return parts.length >= 2 ? path : null;
  } catch {
    return null;
  }
}

async function gitlabCommits(path: string): Promise<Commit[]> {
  const since = new Date(Date.now() - SINCE_DAYS * 86_400_000).toISOString();
  const res = await fetchWithTimeout(
    `https://gitlab.com/api/v4/projects/${encodeURIComponent(path)}/repository/commits?per_page=30&since=${since}`,
  );
  if (!res?.ok) return [];
  const rows = (await res.json()) as {
    message?: string;
    title?: string;
    web_url?: string;
    authored_date?: string;
    author_name?: string;
  }[];
  return rows.flatMap((r) =>
    r.web_url && (r.message || r.title)
      ? [
          {
            url: r.web_url,
            message: r.message ?? r.title ?? "",
            at: r.authored_date ?? new Date().toISOString(),
            author: r.author_name ?? null,
          },
        ]
      : [],
  );
}

type JournalSyncResult = { added: number; checked: number; repos: number };

export async function syncProjectsToJournal(
  admin: Admin,
  userId: string,
  options: { projectId?: string; githubToken?: string } = {},
): Promise<JournalSyncResult> {
  let query = admin.from("projects").select("id, links").eq("profile_id", userId).limit(50);
  if (options.projectId) query = query.eq("id", options.projectId);
  const { data: projects } = await query;
  if (!projects?.length) return { added: 0, checked: 0, repos: 0 };

  const ids = projects.map((p) => p.id);
  const [{ data: repoRows }, { data: account }] = await Promise.all([
    admin
      .from("project_repositories")
      .select("project_id, url, provider")
      .in("project_id", ids)
      .limit(50),
    admin
      .from("connected_accounts")
      .select("username")
      .eq("user_id", userId)
      .eq("provider", "github")
      .maybeSingle(),
  ]);
  const login = (account?.username as string | undefined)?.toLowerCase() ?? null;

  // Every repo a project points at, once: linked repositories + "Where it lives".
  const sources = new Map<
    string,
    { projectId: string; host: "github.com" | "gitlab.com"; path: string }
  >();
  const addSource = (projectId: string, url: unknown) => {
    if (typeof url !== "string") return;
    for (const host of ["github.com", "gitlab.com"] as const) {
      const path = repoPath(url, host);
      if (path) sources.set(`${host}/${path.toLowerCase()}`, { projectId, host, path });
    }
  };
  for (const row of repoRows ?? []) addSource(row.project_id, row.url);
  for (const p of projects) {
    const links = (p.links ?? {}) as Record<string, unknown>;
    addSource(p.id, links.github);
    addSource(p.id, links.gitlab);
  }

  const since = Date.now() - SINCE_DAYS * 86_400_000;
  let checked = 0;
  let added = 0;
  for (const source of [...sources.values()].slice(0, MAX_REPOS)) {
    const commits: Commit[] =
      source.host === "github.com"
        ? (await fetchRepoCommits(source.path, options.githubToken, 30))
            .filter((c) => !login || c.author_login?.toLowerCase() === login)
            .map((c) => ({
              url: c.html_url,
              message: c.message,
              at: c.committed_at,
              author: c.author_login,
            }))
        : await gitlabCommits(source.path);
    const rows = commits.flatMap((c) => {
      if (Date.parse(c.at) < since || !/^https:\/\//.test(c.url)) return [];
      if (c.author && /\[bot\]$|^(renovate|dependabot)/i.test(c.author)) return [];
      const parsed = parseCommitMessage(c.message);
      return parsed
        ? [
            {
              author_id: userId,
              kind: parsed.kind,
              body: parsed.body,
              project_id: source.projectId,
              source: source.host === "github.com" ? "github" : "gitlab",
              source_url: c.url,
              occurred_at: new Date(c.at).toISOString(),
              is_public: false,
            },
          ]
        : [];
    });
    checked += commits.length;
    if (!rows.length) continue;
    // Only commits not logged yet (the unique index is the backstop).
    const { data: existing } = await admin
      .from("journal_entries")
      .select("source_url")
      .eq("author_id", userId)
      .in(
        "source_url",
        rows.map((r) => r.source_url),
      );
    const seen = new Set((existing ?? []).map((r) => r.source_url));
    const fresh = rows.filter((r) => !seen.has(r.source_url));
    if (!fresh.length) continue;
    const { data, error } = await admin.from("journal_entries").insert(fresh).select("id");
    // 23505: a parallel sync got there first — nothing lost.
    if (!error) added += data?.length ?? 0;
  }
  return { added, checked, repos: sources.size };
}
