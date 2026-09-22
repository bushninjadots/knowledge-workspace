import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProjectRepo } from "@/hooks/use-project-repos";

/**
 * Shared by the README tab and the code panel's "Sync README", so a wrong
 * branch or a swallowed failure reason shows up as broken images in a public
 * README with no explanation. The error codes are what the toasts report.
 */
const fetchRepoReadmeServer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/github-server", () => ({ fetchRepoReadmeServer }));

const { readmeSourceMessage, fetchProjectReadmeSource } =
  await import("@/lib/project-readme-source");

const repo = (overrides: Partial<ProjectRepo> = {}): ProjectRepo =>
  ({
    id: "repo-1",
    project_id: "project-1",
    url: "https://github.com/acme/widget",
    provider: "github",
    metadata: { full_name: "acme/widget", default_branch: "develop" },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }) as ProjectRepo;

beforeEach(() => {
  fetchRepoReadmeServer.mockReset();
});

describe("readmeSourceMessage", () => {
  it("has user-facing copy for every failure reason", () => {
    const reasons = ["no_repo", "unauthorized", "rate_limited", "not_found", "network"] as const;
    for (const reason of reasons) {
      expect(readmeSourceMessage(reason).length, reason).toBeGreaterThan(10);
    }
    expect(new Set(reasons.map(readmeSourceMessage)).size).toBe(reasons.length);
  });
});

describe("fetchProjectReadmeSource", () => {
  it("fails fast when no repository is linked", async () => {
    await expect(fetchProjectReadmeSource(undefined)).resolves.toEqual({
      ok: false,
      reason: "no_repo",
    });
    expect(fetchRepoReadmeServer).not.toHaveBeenCalled();
  });

  it("maps each server outcome to its own reason", async () => {
    const cases = [
      [{ text: null, rateLimited: false, unauthorized: true }, "unauthorized"],
      [{ text: null, rateLimited: true, unauthorized: false }, "rate_limited"],
      [{ text: null, rateLimited: false, unauthorized: false }, "not_found"],
    ] as const;

    for (const [response, reason] of cases) {
      fetchRepoReadmeServer.mockResolvedValueOnce(response);
      await expect(fetchProjectReadmeSource(repo())).resolves.toEqual({ ok: false, reason });
    }
  });

  it("reports a thrown request as a network failure rather than crashing", async () => {
    fetchRepoReadmeServer.mockRejectedValueOnce(new Error("offline"));
    await expect(fetchProjectReadmeSource(repo())).resolves.toEqual({
      ok: false,
      reason: "network",
    });
  });

  it("absolutizes relative links against the repo's default branch", async () => {
    fetchRepoReadmeServer.mockResolvedValueOnce({
      text: "![Shot](./docs/shot.png)\n\n[Guide](docs/guide.md)",
      rateLimited: false,
      unauthorized: false,
    });

    const result = await fetchProjectReadmeSource(repo());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fullName).toBe("acme/widget");
    // The branch matters: a README on a non-default branch resolves to 404s.
    expect(result.text).toContain("https://raw.githubusercontent.com/acme/widget/develop/");
    expect(result.text).toContain("docs/shot.png");
    expect(result.text).toContain("https://github.com/acme/widget/blob/develop/docs/guide.md");
  });

  it("asks GitHub for the repo derived from the URL when metadata is missing", async () => {
    fetchRepoReadmeServer.mockResolvedValueOnce({
      text: "# Widget",
      rateLimited: false,
      unauthorized: false,
    });

    await fetchProjectReadmeSource(repo({ metadata: undefined }));
    expect(fetchRepoReadmeServer).toHaveBeenCalledWith({ data: { fullName: "acme/widget" } });
  });
});
