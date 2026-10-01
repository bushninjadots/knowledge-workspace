import { describe, it, expect, vi, afterEach } from "vitest";
import {
  absolutizeRelativeLinks,
  getRepoFullName,
  fetchRepoReadme,
  fetchRepoFile,
  fetchRepoMeta,
  fetchRepoCommits,
  fetchRepoCommitActivity,
  validateGitHubToken,
  githubTokenErrorMessage,
  repoFullNameToTitle,
  buildContributionCalendar,
  mergeCommitActivity,
  githubDisplayShows,
} from "./github";

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  const fn = vi.fn(handler);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getRepoFullName", () => {
  it("prefers the stored metadata full_name", () => {
    expect(
      getRepoFullName({
        metadata: { full_name: "owner/repo" },
        url: "https://github.com/other/x",
      }),
    ).toBe("owner/repo");
  });

  it("parses plain GitHub URLs", () => {
    expect(getRepoFullName({ url: "https://github.com/owner/repo" })).toBe("owner/repo");
  });

  it("strips scheme, www, trailing slash, and .git suffix", () => {
    expect(getRepoFullName({ url: "https://www.github.com/owner/repo.git/" })).toBe("owner/repo");
    expect(getRepoFullName({ url: "http://github.com/owner/repo/" })).toBe("owner/repo");
  });
});

describe("fetchRepoReadme", () => {
  it("uses raw.githubusercontent.com for public repos (no token)", async () => {
    const fetch = mockFetch(async (url) => {
      if (url.startsWith("https://raw.githubusercontent.com/")) {
        return new Response("# Hello", { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });
    const result = await fetchRepoReadme("owner/repo");
    expect(result).toEqual({
      text: "# Hello",
      rateLimited: false,
      unauthorized: false,
    });
    expect(String(fetch.mock.calls[0][0])).toContain("raw.githubusercontent.com");
  });

  it("falls back to the GitHub API when every raw branch misses", async () => {
    mockFetch(async (url) => {
      if (url.startsWith("https://raw.githubusercontent.com/")) {
        return new Response("nf", { status: 404 });
      }
      if (url.includes("api.github.com")) return new Response("# API readme", { status: 200 });
      return new Response("nf", { status: 404 });
    });
    const result = await fetchRepoReadme("owner/repo");
    expect(result.text).toBe("# API readme");
  });

  it("skips raw and calls the API directly with the token when one is supplied", async () => {
    const fetch = mockFetch(async (url) => {
      if (url.includes("api.github.com")) return new Response("# Private", { status: 200 });
      return new Response("nf", { status: 404 });
    });
    const result = await fetchRepoReadme("owner/repo", "ghp_secret");
    expect(result.text).toBe("# Private");
    // Only one fetch: the API (no raw attempts with a token).
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((fetch.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe(
      "Bearer ghp_secret",
    );
  });

  it("flags a rejected token as unauthorized (401)", async () => {
    mockFetch(async (url) =>
      url.includes("api.github.com")
        ? new Response("bad token", { status: 401 })
        : new Response("nf", { status: 404 }),
    );
    const result = await fetchRepoReadme("owner/repo", "ghp_bad");
    expect(result).toEqual({
      text: null,
      rateLimited: false,
      unauthorized: true,
    });
  });

  it("flags 403/429 as rate-limited", async () => {
    mockFetch(async (url) =>
      url.includes("api.github.com")
        ? new Response("limit", { status: 403 })
        : new Response("nf", { status: 404 }),
    );
    const result = await fetchRepoReadme("owner/repo", "ghp_ok");
    expect(result).toEqual({
      text: null,
      rateLimited: true,
      unauthorized: false,
    });
  });

  it("returns not-found when everything misses", async () => {
    mockFetch(async () => new Response("nf", { status: 404 }));
    const result = await fetchRepoReadme("owner/repo");
    expect(result).toEqual({
      text: null,
      rateLimited: false,
      unauthorized: false,
    });
  });

  it("surfaces a network failure as a generic miss", async () => {
    mockFetch(async () => {
      throw new TypeError("down");
    });
    const result = await fetchRepoReadme("owner/repo");
    expect(result).toEqual({
      text: null,
      rateLimited: false,
      unauthorized: false,
    });
  });
});

describe("absolutizeRelativeLinks", () => {
  it("points relative images at raw.githubusercontent.com", () => {
    const out = absolutizeRelativeLinks(
      "![Dashboard](docs/screenshots/dashboard.png)",
      "owner/repo",
      "main",
    );
    expect(out).toBe(
      "![Dashboard](https://raw.githubusercontent.com/owner/repo/main/docs/screenshots/dashboard.png)",
    );
  });

  it("points relative links at the file on github.com", () => {
    const out = absolutizeRelativeLinks(
      "See [DEPLOYMENT.md](DEPLOYMENT.md) and [LICENSE](LICENSE).",
      "owner/repo",
      "main",
    );
    expect(out).toBe(
      "See [DEPLOYMENT.md](https://github.com/owner/repo/blob/main/DEPLOYMENT.md) and [LICENSE](https://github.com/owner/repo/blob/main/LICENSE).",
    );
  });

  it("falls back to HEAD when no branch is given", () => {
    const out = absolutizeRelativeLinks("[X](docs/x.md)", "owner/repo");
    expect(out).toBe("[X](https://github.com/owner/repo/blob/HEAD/docs/x.md)");
  });

  it("resolves root-relative paths and keeps alt text and titles", () => {
    const out = absolutizeRelativeLinks('![Logo](/assets/logo.png "Logo")', "owner/repo", "main");
    expect(out).toBe(
      '![Logo](https://raw.githubusercontent.com/owner/repo/main/assets/logo.png "Logo")',
    );
  });

  it("leaves absolute URLs, anchors, data URIs, and mailto links untouched", () => {
    const md =
      "![Badge](https://img.shields.io/badge/x-y) ![Anchor](#features) ![Pixel](data:image/png;base64,abc) [mail](mailto:a@b.c)";
    expect(absolutizeRelativeLinks(md, "owner/repo", "main")).toBe(md);
  });

  it("rewrites both links and images in the same document", () => {
    const out = absolutizeRelativeLinks(
      "[DEPLOYMENT.md](DEPLOYMENT.md) and ![shot](shot.png)",
      "owner/repo",
      "main",
    );
    expect(out).toBe(
      "[DEPLOYMENT.md](https://github.com/owner/repo/blob/main/DEPLOYMENT.md) and ![shot](https://raw.githubusercontent.com/owner/repo/main/shot.png)",
    );
  });
});

describe("fetchRepoMeta — extended snapshot", () => {
  it("captures license (spdx), homepage, open issues and created date", async () => {
    mockFetch(async () =>
      Response.json({
        full_name: "owner/repo",
        homepage: "https://example.com",
        open_issues_count: 9,
        created_at: "2024-03-01T00:00:00Z",
        license: { spdx_id: "MIT" },
      }),
    );
    const meta = await fetchRepoMeta("owner", "repo");
    expect(meta).toMatchObject({
      homepage: "https://example.com",
      open_issues_count: 9,
      created_at: "2024-03-01T00:00:00Z",
      license: "MIT",
    });
  });

  it("maps NOASSERTION and missing licenses to null", async () => {
    mockFetch(async () => Response.json({ license: { spdx_id: "NOASSERTION" } }));
    expect((await fetchRepoMeta("owner", "repo"))?.license).toBeNull();

    mockFetch(async () => Response.json({}));
    expect((await fetchRepoMeta("owner", "repo"))?.license).toBeNull();
  });
});

describe("fetchRepoCommitActivity", () => {
  it("returns the last 52 weeks of the stats response", async () => {
    const week = (n: number, total: number) => ({
      week: 1_700_000_000 + n * 604_800,
      total,
      days: [0, 1, 2, 0, 0, 0, 0],
    });
    mockFetch(async () => Response.json(Array.from({ length: 60 }, (_, i) => week(i, i))));
    const result = await fetchRepoCommitActivity("owner/repo");
    expect(result.pending).toBe(false);
    expect(result.weeks).toHaveLength(52);
    expect(result.weeks?.[0].total).toBe(8); // 60 - 52
  });

  it("flags 202 as pending and keeps the caller's cache decision with it", async () => {
    mockFetch(async () => new Response("", { status: 202 }));
    const result = await fetchRepoCommitActivity("owner/repo");
    expect(result).toEqual({ weeks: null, pending: true, notFound: false, rateLimited: false });
  });

  it("marks 404 repos as notFound and 403 as rate-limited", async () => {
    mockFetch(async () => new Response("", { status: 404 }));
    expect((await fetchRepoCommitActivity("owner/gone")).notFound).toBe(true);

    mockFetch(async () => new Response("", { status: 403 }));
    expect((await fetchRepoCommitActivity("owner/repo")).rateLimited).toBe(true);
  });
});

describe("buildContributionCalendar", () => {
  it("builds one column of 7 cells per week and totals commits", () => {
    const weeks = [
      { week: 0, total: 4, days: [0, 0, 0, 0, 1, 1, 2] },
      { week: 7 * 24 * 60 * 60, total: 6, days: [2, 2, 2, 0, 0, 0, 0] },
    ];
    const calendar = buildContributionCalendar(weeks);
    expect(calendar.weeks).toHaveLength(52);
    expect(calendar.weeks.at(-2)).toHaveLength(7);
    expect(calendar.weeks.at(-1)).toHaveLength(7);
    expect(calendar.total).toBe(10);
  });

  it("bands levels by quartiles of the busiest day", () => {
    const weeks = [{ week: 0, total: 10, days: [0, 2, 4, 6, 8, 0, 0] }];
    const calendar = buildContributionCalendar(weeks);
    const levels = calendar.weeks.at(-1)?.map((c) => c.level);
    // dayMax = 8 → bands at 2/4/6; 0→0, 2→1, 4→2, 6→3, 8→4.
    expect(levels).toEqual([0, 1, 2, 3, 4, 0, 0]);
  });

  it("stays level 0 for an all-empty history", () => {
    const calendar = buildContributionCalendar([
      { week: 0, total: 0, days: [0, 0, 0, 0, 0, 0, 0] },
    ]);
    expect(calendar.total).toBe(0);
    expect(calendar.weeks).toHaveLength(52);
    expect(calendar.weeks.every((week) => week.every((c) => c.level === 0))).toBe(true);
  });
});

describe("mergeCommitActivity", () => {
  it("sums per-day across repos, aligned by week timestamp", () => {
    const merged = mergeCommitActivity([
      [{ week: 100, total: 3, days: [1, 2, 0, 0, 0, 0, 0] }],
      [{ week: 100, total: 4, days: [0, 2, 2, 0, 0, 0, 0] }],
    ]);
    expect(merged).toEqual([{ week: 100, total: 7, days: [1, 4, 2, 0, 0, 0, 0] }]);
  });

  it("unions weeks only one repo has and sorts chronologically", () => {
    const merged = mergeCommitActivity([
      [{ week: 200, total: 1, days: [1, 0, 0, 0, 0, 0, 0] }],
      [
        { week: 100, total: 2, days: [2, 0, 0, 0, 0, 0, 0] },
        { week: 200, total: 1, days: [0, 1, 0, 0, 0, 0, 0] },
      ],
    ]);
    expect(merged.map((w) => w.week)).toEqual([100, 200]);
    expect(merged[0].total).toBe(2);
    expect(merged[1].days).toEqual([1, 1, 0, 0, 0, 0, 0]);
  });

  it("returns an empty list for nothing cached", () => {
    expect(mergeCommitActivity([])).toEqual([]);
  });
});

describe("buildContributionCalendar sparse histories", () => {
  it("keeps a 52-week window and fills missing columns with empty days", () => {
    const calendar = buildContributionCalendar([
      { week: 100, total: 2, days: [2, 0, 0, 0, 0, 0, 0] },
      { week: 100 + 51 * 7 * 24 * 60 * 60, total: 1, days: [0, 1] },
    ]);

    expect(calendar.weeks).toHaveLength(52);
    expect(calendar.weeks[1].every((cell) => cell.count === 0)).toBe(true);
    expect(calendar.weeks[0][0].count).toBe(2);
    expect(calendar.weeks.at(-1)?.[1].count).toBe(1);
    expect(calendar.total).toBe(3);
  });
});

describe("githubDisplayShows", () => {
  it("defaults to shown when the column is null or the key is absent", () => {
    expect(githubDisplayShows(null, "show_graph")).toBe(true);
    expect(githubDisplayShows({}, "show_graph")).toBe(true);
    expect(githubDisplayShows(undefined, "show_stats")).toBe(true);
  });

  it("respects explicit opt-outs", () => {
    expect(githubDisplayShows({ show_graph: false }, "show_graph")).toBe(false);
    expect(githubDisplayShows({ show_graph: false }, "show_stats")).toBe(true);
  });
});

describe("fetchRepoMeta", () => {
  it("maps the API response into cached metadata", async () => {
    mockFetch(async (url) => {
      if (url.includes("api.github.com")) {
        return Response.json({
          full_name: "owner/repo",
          description: "A repo",
          language: "TypeScript",
          stargazers_count: 42,
          forks_count: 7,
          updated_at: "2026-01-01",
          topics: ["a", "b"],
          private: false,
          default_branch: "main",
        });
      }
      return new Response("nf", { status: 404 });
    });
    const meta = await fetchRepoMeta("owner", "repo");
    expect(meta).toMatchObject({
      full_name: "owner/repo",
      language: "TypeScript",
      stargazers_count: 42,
      topics: ["a", "b"],
      private: false,
      default_branch: "main",
    });
  });

  it("returns null on non-OK responses and network failures", async () => {
    mockFetch(async () => new Response("nf", { status: 404 }));
    expect(await fetchRepoMeta("owner", "missing")).toBeNull();

    mockFetch(async () => {
      throw new TypeError("network down");
    });
    expect(await fetchRepoMeta("owner", "repo")).toBeNull();
  });
});

describe("fetchRepoCommits", () => {
  it("maps commit activity into concise evidence records", async () => {
    const fetch = mockFetch(async () =>
      Response.json([
        {
          sha: "abcdef1234567890",
          html_url: "https://github.com/owner/repo/commit/abcdef1",
          commit: {
            message: "Ship the new flow\\n\\nDetails",
            author: { name: "A Builder", date: "2026-08-20T10:00:00Z" },
          },
          author: { login: "builder" },
        },
      ]),
    );
    await expect(fetchRepoCommits("owner/repo")).resolves.toEqual([
      {
        sha: "abcdef1234567890",
        message: "Ship the new flow",
        html_url: "https://github.com/owner/repo/commit/abcdef1",
        committed_at: "2026-08-20T10:00:00Z",
        author_login: "builder",
        author_name: "A Builder",
      },
    ]);
    expect(String(fetch.mock.calls[0][0])).toContain("repos/owner/repo/commits");
  });

  it("returns an empty list for an unavailable repository", async () => {
    mockFetch(async () => new Response("nope", { status: 404 }));
    await expect(fetchRepoCommits("owner/missing")).resolves.toEqual([]);
  });
});

describe("validateGitHubToken", () => {
  it("rejects empty input", async () => {
    expect(await validateGitHubToken("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("returns the login for a valid token", async () => {
    mockFetch(async (url) =>
      url.includes("api.github.com/user")
        ? Response.json({ login: "octocat" })
        : new Response("nf", { status: 404 }),
    );
    expect(await validateGitHubToken("ghp_good")).toEqual({ ok: true, username: "octocat" });
  });

  it("flags a 401 as unauthorized", async () => {
    mockFetch(async () => new Response("nope", { status: 401 }));
    expect(await validateGitHubToken("ghp_bad")).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("flags network errors", async () => {
    mockFetch(async () => {
      throw new TypeError("down");
    });
    expect(await validateGitHubToken("ghp_x")).toEqual({ ok: false, reason: "network" });
  });
});

describe("githubTokenErrorMessage", () => {
  it("returns a distinct message per reason", () => {
    expect(githubTokenErrorMessage("unauthorized")).toContain("rejected");
    expect(githubTokenErrorMessage("network")).toContain("GitHub");
    expect(githubTokenErrorMessage("empty")).toContain("token");
    expect(githubTokenErrorMessage("storage")).toContain("save");
  });
});

describe("fetchRepoFile", () => {
  it("fetches raw content and sha via the contents API", async () => {
    const content = btoa("# Hello file");
    const fetch = mockFetch(async (url) =>
      url.includes("api.github.com/repos/owner/repo/contents/README.md")
        ? Response.json({ content, encoding: "base64", sha: "abc123" })
        : new Response("nf", { status: 404 }),
    );
    const result = await fetchRepoFile("owner/repo", "README.md");
    expect(result).toEqual({
      text: "# Hello file",
      sha: "abc123",
      notFound: false,
      rateLimited: false,
      unauthorized: false,
    });
    expect(String(fetch.mock.calls[0][0])).toContain("repos/owner/repo/contents/README.md");
  });

  it("passes the ref as a query param and the token as a header", async () => {
    const fetch = mockFetch(async () =>
      Response.json({ content: btoa("x"), encoding: "base64", sha: "s" }),
    );
    await fetchRepoFile("owner/repo", "docs/a b.md", "dev", "ghp_secret");
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toContain("docs/a%20b.md");
    expect(String(url)).toContain("ref=dev");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer ghp_secret");
  });

  it("decodes multi-byte UTF-8 correctly", async () => {
    mockFetch(async () =>
      Response.json({
        content: btoa(String.fromCharCode(...new TextEncoder().encode("# héllo ✓"))),
        encoding: "base64",
        sha: "s",
      }),
    );
    const result = await fetchRepoFile("owner/repo", "README.md");
    expect(result.text).toBe("# héllo ✓");
  });

  it("flags missing files as notFound", async () => {
    mockFetch(async () => new Response("nf", { status: 404 }));
    const result = await fetchRepoFile("owner/repo", "missing.md");
    expect(result.notFound).toBe(true);
    expect(result.text).toBeNull();
  });

  it("flags 401 as unauthorized and 403/429 as rate-limited", async () => {
    mockFetch(async () => new Response("nope", { status: 401 }));
    expect((await fetchRepoFile("owner/repo", "f", undefined, "bad")).unauthorized).toBe(true);

    mockFetch(async () => new Response("limit", { status: 403 }));
    expect((await fetchRepoFile("owner/repo", "f")).rateLimited).toBe(true);
  });

  it("flags binary content via null bytes after decoding", async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x00, 0x03]); // PK zip header w/ NUL
    mockFetch(async () =>
      Response.json({
        content: btoa(String.fromCharCode(...bytes)),
        encoding: "base64",
        sha: "s",
      }),
    );
    const result = await fetchRepoFile("owner/repo", "file.zip");
    expect(result.text).toBeNull();
    expect(result.notFound).toBe(false);
    expect(result.rateLimited).toBe(false);
    expect(result.unauthorized).toBe(false);
  });

  it("surfaces network failures as a generic miss", async () => {
    mockFetch(async () => {
      throw new TypeError("down");
    });
    const result = await fetchRepoFile("owner/repo", "README.md");
    expect(result).toEqual({
      text: null,
      sha: null,
      notFound: false,
      rateLimited: false,
      unauthorized: false,
    });
  });
});

describe("repoFullNameToTitle", () => {
  it("uses the repo segment, not the owner", () => {
    expect(repoFullNameToTitle("maya/threadline-app")).toBe("Threadline App");
  });

  it("spaces underscore and repeated separators, collapsing runs", () => {
    expect(repoFullNameToTitle("o/my_cool--tool")).toBe("My Cool Tool");
  });

  it("keeps dots as part of a word (node.js-style names keep their identity)", () => {
    expect(repoFullNameToTitle("o/js.web.app")).toBe("Js.web.app");
    expect(repoFullNameToTitle("o/node.js")).toBe("Node.js");
  });

  it("leaves already-capitalized words alone", () => {
    expect(repoFullNameToTitle("o/iOS-Tools")).toBe("iOS Tools");
  });

  it("returns empty for an empty name", () => {
    expect(repoFullNameToTitle("")).toBe("");
  });
});
