import { beforeEach, describe, expect, it, vi } from "vitest";

const github = vi.hoisted(() => ({
  fetchRepoMeta: vi.fn(),
  fetchRepoCommitActivity: vi.fn(),
  fetchUserRepos: vi.fn(),
  fetchRepoFile: vi.fn(),
}));
vi.mock("./github", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./github")>()),
  ...github,
}));

import { githubOrgFrom, refreshRepoSnapshots, refreshTeamSnapshot } from "./github-refresh";

/** A tiny stand-in for the service-role client: canned reads, recorded writes. */
function fakeAdmin(tables: Record<string, unknown[]>) {
  const writes: Array<{ table: string; patch: Record<string, unknown>; id: unknown }> = [];
  const admin = {
    from(table: string) {
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        not: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: (tables[table] ?? [])[0] ?? null }),
        then: (resolve: (value: { data: unknown[] }) => void) =>
          resolve({ data: tables[table] ?? [] }),
        update: (patch: Record<string, unknown>) => ({
          eq: async (_column: string, id: unknown) => {
            writes.push({ table, patch, id });
            return { error: null };
          },
        }),
      };
      return query;
    },
  };
  return { admin: admin as never, writes };
}

const week = { week: 1, total: 3, days: [0, 1, 2, 0, 0, 0, 0] };

beforeEach(() => {
  for (const fn of Object.values(github)) fn.mockReset();
});

describe("refreshing repo snapshots", () => {
  it("merges fresh stats and commits over the last good snapshot", async () => {
    const { admin, writes } = fakeAdmin({
      project_repositories: [
        {
          id: "r1",
          project_id: "p1",
          url: "https://github.com/a/b",
          metadata: { full_name: "a/b", topics: ["x"], commit_activity: [week] },
        },
      ],
      projects: [{ id: "p1", profile_id: "u1" }],
      user_github_tokens: [{ user_id: "u1", token: "own" }],
    });
    github.fetchRepoMeta.mockResolvedValue({ full_name: "a/b", stargazers_count: 5 });
    github.fetchRepoCommitActivity.mockResolvedValue({
      weeks: null,
      pending: true,
      notFound: false,
      rateLimited: false,
    });

    const summary = await refreshRepoSnapshots(admin);

    expect(github.fetchRepoMeta).toHaveBeenCalledWith("a", "b", "own");
    expect(summary).toEqual({ repos: 1, refreshed: 1, rateLimited: false });
    // Still computing: the cached commit graph stays.
    expect(writes[0].patch.metadata).toMatchObject({
      stargazers_count: 5,
      topics: ["x"],
      commit_activity: [week],
    });
  });

  it("stops when GitHub rate-limits, and skips nothing for an empty scope", async () => {
    const { admin, writes } = fakeAdmin({
      project_repositories: [
        { id: "r1", project_id: "p1", url: "https://github.com/a/b", metadata: null },
      ],
      projects: [],
    });
    github.fetchRepoMeta.mockResolvedValue(null);
    github.fetchRepoCommitActivity.mockResolvedValue({
      weeks: null,
      pending: false,
      notFound: false,
      rateLimited: true,
    });
    expect(await refreshRepoSnapshots(admin)).toMatchObject({ rateLimited: true, refreshed: 0 });
    expect(writes).toHaveLength(0);
    expect(await refreshRepoSnapshots(admin, { projectIds: [] })).toEqual({
      repos: 0,
      refreshed: 0,
      rateLimited: false,
    });
  });
});

describe("a crew's GitHub organisation", () => {
  it("reads the organisation from the crew's link", () => {
    expect(githubOrgFrom("https://github.com/octo-org")).toBe("octo-org");
    expect(githubOrgFrom("https://github.com/octo-org/repo?tab=1")).toBe("octo-org");
    expect(githubOrgFrom("@octo-org")).toBe("octo-org");
    expect(githubOrgFrom("https://evil.example/<script>")).toBeNull();
    expect(githubOrgFrom("")).toBeNull();
  });

  it("caches the most-starred public repos, and clears when the link goes", async () => {
    const { admin, writes } = fakeAdmin({});
    github.fetchUserRepos.mockResolvedValue([
      { full_name: "o/a", description: null, language: "Go", stargazers_count: 1, private: false },
      { full_name: "o/b", description: "B", language: null, stargazers_count: 9, private: false },
      { full_name: "o/c", description: null, language: null, stargazers_count: 99, private: true },
    ]);
    expect(
      await refreshTeamSnapshot(admin, {
        id: "t",
        social_links: { github: "https://github.com/o" },
      }),
    ).toBe(true);
    const snapshot = writes[0].patch.github_snapshot as {
      org: string;
      repos: Array<{ full_name: string }>;
    };
    expect(snapshot.org).toBe("o");
    expect(snapshot.repos.map((r) => r.full_name)).toEqual(["o/b", "o/a"]);

    await refreshTeamSnapshot(admin, { id: "t", social_links: {} });
    expect(writes[1].patch).toEqual({ github_snapshot: null });
  });
});
