// Shared GitHub→Tethyr README import. Every "Import from GitHub" / "Sync from
// GitHub" for a README — the profile README and About blocks, the project
// README tab and the code panel's one-click sync — goes through here, so
// failure copy and relative-link rewriting stay in one place.
import { fetchRepoReadmeServer } from "@/lib/github-server";
import { absolutizeRelativeLinks, getRepoFullName } from "@/lib/github";
import type { ProjectRepo } from "@/hooks/use-project-repos";

export type ReadmeSourceFailure =
  "no_repo" | "unauthorized" | "rate_limited" | "not_found" | "network";

export type ReadmeSourceResult =
  { ok: true; text: string; fullName: string } | { ok: false; reason: ReadmeSourceFailure };

export function readmeSourceMessage(reason: ReadmeSourceFailure): string {
  switch (reason) {
    case "no_repo":
      return "Link a repository first — the README is imported from there";
    case "unauthorized":
      return "GitHub rejected the saved token — check it and try again";
    case "rate_limited":
      return "GitHub is rate-limited right now — try again in a minute";
    case "not_found":
      return "No README found in that repository";
    case "network":
      return "Couldn't reach GitHub — try again";
  }
}

/** A repository named as `owner/name` (also accepts a github.com URL). */
export function parseRepoFullName(value: string): string | null {
  const cleaned = value
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  const match = /^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/.exec(cleaned);
  return match ? `${match[1]}/${match[2]}` : null;
}

/**
 * Fetch a repo's README on the server, rewriting relative links and
 * screenshots so they resolve against the source repo on Tethyr.
 */
export async function fetchReadmeFrom(
  fullName: string,
  branch = "HEAD",
): Promise<ReadmeSourceResult> {
  try {
    const { text, rateLimited, unauthorized } = await fetchRepoReadmeServer({
      data: { fullName },
    });
    if (unauthorized) return { ok: false, reason: "unauthorized" };
    if (rateLimited) return { ok: false, reason: "rate_limited" };
    if (text === null) return { ok: false, reason: "not_found" };
    return { ok: true, text: absolutizeRelativeLinks(text, fullName, branch), fullName };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** The primary linked repo's README, for a project. */
export async function fetchProjectReadmeSource(
  repo: ProjectRepo | undefined,
): Promise<ReadmeSourceResult> {
  if (!repo) return { ok: false, reason: "no_repo" };
  return fetchReadmeFrom(getRepoFullName(repo), repo.metadata?.default_branch ?? "HEAD");
}
