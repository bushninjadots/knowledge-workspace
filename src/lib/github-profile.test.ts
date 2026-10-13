import { describe, expect, it } from "vitest";
import { calendarToWeeks, pickRepos, summarizeEvents, summarizeRepos } from "./github-profile";

const repo = (name: string, over: Record<string, unknown> = {}) => ({
  full_name: `me/${name}`,
  name,
  description: null,
  language: "TypeScript",
  stargazers_count: 0,
  forks_count: 0,
  topics: [],
  homepage: null,
  pushed_at: "2026-10-01T00:00:00Z",
  archived: false,
  fork: false,
  private: false,
  size: 100,
  ...over,
});

describe("summarizeRepos", () => {
  it("drops forks and private repos, totals stars, sorts by stars", () => {
    const s = summarizeRepos([
      repo("a", { stargazers_count: 2 }),
      repo("b", { stargazers_count: 9, forks_count: 3 }),
      repo("forked", { fork: true, stargazers_count: 100 }),
      repo("secret", { private: true, stargazers_count: 100 }),
    ]);
    expect(s.repos.map((r) => r.name)).toEqual(["b", "a"]);
    expect(s.total_stars).toBe(11);
    expect(s.total_forks).toBe(3);
  });
  it("weights languages by repo size", () => {
    const s = summarizeRepos([
      repo("big", { language: "Rust", size: 10_000 }),
      repo("small1", { language: "Go", size: 1 }),
      repo("small2", { language: "Go", size: 1 }),
    ]);
    expect(s.languages[0].language).toBe("Rust");
    expect(s.languages.find((l) => l.language === "Go")?.repos).toBe(2);
  });
});

describe("summarizeEvents", () => {
  const now = Date.parse("2026-10-13T00:00:00Z");
  const ev = (
    type: string,
    payload: Record<string, unknown>,
    repo = "me/a",
    at = "2026-10-10T00:00:00Z",
  ) => ({
    type,
    repo: { name: repo },
    created_at: at,
    payload,
  });
  it("counts activity and folds pushes to one repo into one line", () => {
    const { activity, recent } = summarizeEvents(
      [
        ev("PushEvent", { distinct_size: 2 }),
        ev("PushEvent", { distinct_size: 3 }),
        ev("PullRequestEvent", {
          action: "opened",
          pull_request: { title: "Add X", html_url: "u" },
        }),
        ev("PullRequestEvent", {
          action: "closed",
          pull_request: { merged: true, title: "Add X" },
        }),
        ev("ReleaseEvent", { action: "published", release: { tag_name: "v1" } }),
        ev("CreateEvent", { ref_type: "repository" }, "me/new"),
        ev("PushEvent", { distinct_size: 5 }, "me/a", "2026-01-01T00:00:00Z"),
      ],
      now,
    );
    expect(activity).toMatchObject({
      commits: 5,
      pull_requests: 1,
      merged: 1,
      releases: 1,
      repos_created: 1,
      active_repos: 2,
    });
    expect(recent[0]).toMatchObject({ kind: "push", count: 5, pushes: 2 });
    expect(recent.map((r) => r.kind)).toEqual([
      "push",
      "pr_opened",
      "pr_merged",
      "release",
      "repo_created",
    ]);
  });
  it("groups interleaved pushes by repo", () => {
    const { recent } = summarizeEvents(
      [ev("PushEvent", {}, "me/a"), ev("PushEvent", {}, "me/b"), ev("PushEvent", {}, "me/a")],
      now,
    );
    expect(recent.map((r) => `${r.repo}:${r.pushes}`)).toEqual(["me/a:2", "me/b:1"]);
  });
  it("keeps a push without a commit count", () => {
    const { recent, activity } = summarizeEvents([ev("PushEvent", {})], now);
    expect(recent[0].kind).toBe("push");
    expect(recent[0].count).toBeUndefined();
    expect(activity.commits).toBe(0);
  });
});

describe("calendarToWeeks", () => {
  it("maps days to Sunday-first slots and dates the week from its Sunday", () => {
    const [week] = calendarToWeeks([
      {
        contributionDays: [
          { date: "2026-10-05", contributionCount: 2 },
          { date: "2026-10-06", contributionCount: 1 },
        ],
      },
    ]);
    expect(week.days).toEqual([0, 2, 1, 0, 0, 0, 0]);
    expect(new Date(week.week * 1000).toISOString().slice(0, 10)).toBe("2026-10-04");
    expect(week.total).toBe(3);
  });
});

describe("pickRepos", () => {
  const snap = {
    repos: [
      {
        ...summarizeRepos([
          repo("star", { stargazers_count: 5, pushed_at: "2026-01-01T00:00:00Z" }),
        ]).repos[0],
      },
      { ...summarizeRepos([repo("fresh", { pushed_at: "2026-10-12T00:00:00Z" })]).repos[0] },
      { ...summarizeRepos([repo("old", { archived: true })]).repos[0] },
    ],
    pinned: ["me/fresh"],
  };
  it("picks by mode", () => {
    expect(pickRepos(snap, "top", [], 4).map((r) => r.name)).toEqual(["star", "fresh"]);
    expect(pickRepos(snap, "recent", [], 1).map((r) => r.name)).toEqual(["fresh"]);
    expect(pickRepos(snap, "pinned", [], 4).map((r) => r.name)).toEqual(["fresh"]);
    expect(pickRepos(snap, "chosen", ["me/OLD", "me/star"], 4).map((r) => r.name)).toEqual([
      "old",
      "star",
    ]);
  });
  it("falls back to top when nothing is pinned", () => {
    expect(pickRepos({ ...snap, pinned: null }, "pinned", [], 1).map((r) => r.name)).toEqual([
      "star",
    ]);
  });
});
