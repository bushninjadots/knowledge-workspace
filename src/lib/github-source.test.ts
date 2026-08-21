import { describe, it, expect } from "vitest";
import { parseGithubSource } from "./github-source";

describe("parseGithubSource", () => {
  it("parses a valid source object", () => {
    expect(
      parseGithubSource({
        repo: "owner/repo",
        path: "README.md",
        branch: "main",
        synced_at: "2026-08-21T00:00:00Z",
        sha: "abc123",
      }),
    ).toEqual({
      repo: "owner/repo",
      path: "README.md",
      branch: "main",
      synced_at: "2026-08-21T00:00:00Z",
      sha: "abc123",
    });
  });

  it("allows null branch/synced_at/sha (linked but not yet synced)", () => {
    expect(parseGithubSource({ repo: "o/r", path: "docs/x.md" })).toEqual({
      repo: "o/r",
      path: "docs/x.md",
      branch: null,
      synced_at: null,
      sha: null,
    });
  });

  it("returns null for non-objects and missing required fields", () => {
    expect(parseGithubSource(null)).toBeNull();
    expect(parseGithubSource("nope")).toBeNull();
    expect(parseGithubSource({ path: "README.md" })).toBeNull();
    expect(parseGithubSource({ repo: "", path: "README.md" })).toBeNull();
    expect(parseGithubSource({ repo: "o/r" })).toBeNull();
  });

  it("coerces unknown extras away and rejects wrong types", () => {
    expect(parseGithubSource({ repo: "o/r", path: "p", extra: 1 })?.repo).toBe("o/r");
    expect(parseGithubSource({ repo: 42, path: "p" })).toBeNull();
  });
});
