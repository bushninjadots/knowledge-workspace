import { describe, expect, it } from "vitest";
import { APPS, detectApp, getApp, groupApps, isLaunchableUrl, PROJECT_APPS } from "./app-catalog";

describe("app catalog", () => {
  it("has unique ids", () => {
    expect(new Set(APPS.map((a) => a.id)).size).toBe(APPS.length);
  });

  it("detects apps from links, most specific host first", () => {
    expect(detectApp("https://github.com/acme/repo")?.id).toBe("github");
    expect(detectApp("https://github.com/users/me/projects/1")?.id).toBe("github-projects");
    expect(detectApp("https://www.figma.com/design/abc")?.id).toBe("figma");
    expect(detectApp("https://my-app.vercel.app")?.id).toBe("vercel");
    expect(detectApp("https://acme.atlassian.net/wiki/spaces/X")?.id).toBe("confluence");
    expect(detectApp("https://acme.atlassian.net/jira/software")?.id).toBe("jira");
    expect(detectApp("https://example.com")).toBeNull();
    expect(detectApp("obsidian://open?vault=Work")?.id).toBe("obsidian");
    expect(detectApp("not a url")).toBeNull();
  });

  it("builds deep links that open desktop apps", () => {
    expect(getApp("obsidian")!.deepLink!.build("Work notes")).toBe(
      "obsidian://open?vault=Work%20notes",
    );
    expect(getApp("vscode")!.deepLink!.build("/Users/me/code/my app")).toBe(
      "vscode://file/Users/me/code/my%20app",
    );
    expect(getApp("cursor")!.deepLink!.build("C:/code/app")).toBe("cursor://file/C:/code/app");
  });

  it("only launches https or the app's own scheme", () => {
    expect(isLaunchableUrl("https://x.com")).toBe(true);
    expect(isLaunchableUrl("http://x.com")).toBe(false);
    expect(isLaunchableUrl("javascript:alert(1)", getApp("obsidian"))).toBe(false);
    expect(isLaunchableUrl("obsidian://open?vault=A", getApp("obsidian"))).toBe(true);
    expect(isLaunchableUrl("obsidian://open?vault=A", getApp("notion"))).toBe(false);
  });

  it("keeps personal tools off projects, and groups by category", () => {
    expect(PROJECT_APPS.some((a) => a.id === "linkedin" || a.id === "vscode")).toBe(false);
    expect(getApp("twitter")?.id).toBe("x");
    const groups = groupApps(APPS, "git");
    expect(groups.flatMap((g) => g.apps.map((a) => a.id))).toContain("gitlab");
    expect(groups.every((g) => g.apps.length > 0)).toBe(true);
  });
});
