import { describe, it, expect, vi, afterEach } from "vitest";
import {
  absolutizeRelativeLinks,
  getRepoFullName,
  fetchRepoReadme,
  fetchRepoMeta,
  validateGitHubToken,
  githubTokenErrorMessage,
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
