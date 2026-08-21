// Shape of library_items.github_source (JSONB). Kept as a pure module so both
// client and server code share one parser with strict validation.
export type GithubSource = {
  repo: string;
  path: string;
  branch: string | null;
  synced_at: string | null;
  sha: string | null;
};

export function parseGithubSource(raw: unknown): GithubSource | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.repo !== "string" || !obj.repo.trim()) return null;
  if (typeof obj.path !== "string" || !obj.path.trim()) return null;
  return {
    repo: obj.repo,
    path: obj.path,
    branch: typeof obj.branch === "string" && obj.branch.trim() ? obj.branch : null,
    synced_at: typeof obj.synced_at === "string" && obj.synced_at ? obj.synced_at : null,
    sha: typeof obj.sha === "string" && obj.sha ? obj.sha : null,
  };
}
