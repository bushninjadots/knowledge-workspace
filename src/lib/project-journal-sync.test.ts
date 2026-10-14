import { describe, expect, it } from "vitest";
import { repoPath } from "./project-journal-sync";

describe("repoPath", () => {
  it("reads GitHub and GitLab repo paths", () => {
    expect(repoPath("https://github.com/acme/app.git", "github.com")).toBe("acme/app");
    expect(repoPath("https://www.github.com/acme/app/tree/main", "github.com")).toBe("acme/app");
    expect(repoPath("https://github.com/acme", "github.com")).toBeNull();
    expect(repoPath("https://gitlab.com/group/sub/app/-/tree/main", "gitlab.com")).toBe(
      "group/sub/app",
    );
    expect(repoPath("https://gitlab.com/acme/app", "github.com")).toBeNull();
    expect(repoPath("not a url", "gitlab.com")).toBeNull();
  });
});
