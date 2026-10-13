import { describe, expect, it } from "vitest";
import type { PostWithAuthor } from "@/hooks/use-community";
import { summarizePulse } from "./community-pulse";
import { findHelpMatches } from "./help-matches";
import { flairRepeatsType } from "./post-card";
import { skillKeyMap } from "@/lib/skill-key";

const NOW = Date.parse("2026-10-13T12:00:00Z");

function post(partial: Partial<PostWithAuthor> & { id: string }): PostWithAuthor {
  return {
    type: "discussion",
    title: "",
    body: "",
    author_id: "someone",
    created_at: new Date(NOW - 60_000).toISOString(),
    skills: [],
    myActions: [],
    stats: { likes: 0, helpful: 0, saves: 0, offers: 0, comment_count: 0, solved: false },
    author: { display_name: "Sam", handle: "sam", creator_title: null, avatar_url: null },
    ...partial,
  } as unknown as PostWithAuthor;
}

describe("summarizePulse", () => {
  it("counts the last day's posts and distinct people", () => {
    const pulse = summarizePulse(
      [
        post({ id: "1", author_id: "a" }),
        post({ id: "2", author_id: "a" }),
        post({ id: "3", author_id: "b" }),
        post({ id: "4", author_id: "c", created_at: new Date(NOW - 2 * 86_400_000).toISOString() }),
      ],
      NOW,
    );
    expect(pulse.postsToday).toBe(3);
    expect(pulse.people).toBe(2);
  });

  it("counts only help requests nobody has replied to", () => {
    const pulse = summarizePulse(
      [
        post({ id: "1", type: "help_request" }),
        post({
          id: "2",
          type: "help_request",
          stats: { likes: 0, helpful: 0, saves: 0, offers: 0, comment_count: 2, solved: false },
        }),
        post({ id: "3", type: "question" }),
      ],
      NOW,
    );
    expect(pulse.unanswered).toBe(1);
  });
});

describe("findHelpMatches", () => {
  const teach = skillKeyMap([{ name: "Figma" }, { name: "React" }, { name: "Tailwind CSS" }]);

  it("matches slug-tagged asks against the skill names I teach", () => {
    const matches = findHelpMatches(
      [post({ id: "slug", type: "question", skills: ["tailwind-css", "accessibility"] })],
      teach,
      "me",
    );
    expect(matches[0]?.skills).toEqual(["Tailwind CSS"]);
  });

  it("matches asks by others on skills I teach, case-insensitively", () => {
    const matches = findHelpMatches(
      [
        post({ id: "ask", type: "help_request", skills: ["React", "Go"] }),
        post({ id: "share", type: "showcase", skills: ["React"] }),
        post({ id: "mine", type: "question", skills: ["Figma"], author_id: "me" }),
      ],
      teach,
      "me",
    );
    expect(matches.map((m) => m.post.id)).toEqual(["ask"]);
    expect(matches[0].skills).toEqual(["React"]);
  });

  it("returns nothing when I teach nothing, and respects the limit", () => {
    const asks = ["1", "2", "3", "4"].map((id) =>
      post({ id, type: "question", skills: ["Figma"] }),
    );
    expect(findHelpMatches(asks, new Map(), "me")).toEqual([]);
    expect(findHelpMatches(asks, teach, "me", 2)).toHaveLength(2);
  });
});

describe("flairRepeatsType", () => {
  it("hides a flair that only repeats the type", () => {
    expect(flairRepeatsType("Update", "Project update")).toBe(true);
    expect(flairRepeatsType("Collab", "Collaboration request")).toBe(true);
    expect(flairRepeatsType("open role", "Open role")).toBe(true);
  });

  it("keeps a flair that adds information", () => {
    expect(flairRepeatsType("Career", "Showcase")).toBe(false);
    expect(flairRepeatsType("Helpful tip", "Help request")).toBe(false);
    expect(flairRepeatsType("Up", "Project update")).toBe(false);
  });
});
