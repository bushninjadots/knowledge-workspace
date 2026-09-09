// Shared GitHub→Tethyr README import. Both the README tab's "Preview from
// GitHub" / "Pull from GitHub" and the code panel's one-click "Sync README" go
// through here so failure copy and relative-link rewriting stay in one place.
import { fetchRepoReadmeServer } from "@/lib/github-server";
import { absolutizeRelativeLinks, getRepoFullName } from "@/lib/github";
import type { ProjectRepo } from "@/hooks/use-project-repos";

type ReadmeSourceFailure = "no_repo" | "unauthorized" | "rate_limited" | "not_found" | "network";

type ReadmeSourceResult =
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
      return "No README found in the linked repository";
    case "network":
      return "Couldn't reach GitHub — try again";
  }
}

/**
 * Fetch the primary linked repo's README on the server, rewriting relative
 * links and screenshots so they resolve against the source repo on Tethyr.
 * Returns the absolutized markdown, or an error code for structured toasts.
 */
export async function fetchProjectReadmeSource(
  repo: ProjectRepo | undefined,
): Promise<ReadmeSourceResult> {
  if (!repo) return { ok: false, reason: "no_repo" };
  const fullName = getRepoFullName(repo);
  try {
    const { text, rateLimited, unauthorized } = await fetchRepoReadmeServer({
      data: { fullName },
    });
    if (unauthorized) return { ok: false, reason: "unauthorized" };
    if (rateLimited) return { ok: false, reason: "rate_limited" };
    if (text === null) return { ok: false, reason: "not_found" };
    const branch = repo.metadata?.default_branch ?? "HEAD";
    return { ok: true, text: absolutizeRelativeLinks(text, fullName, branch), fullName };
  } catch {
    return { ok: false, reason: "network" };
  }
}
