import { describe, expect, it } from "vitest";
import { rankReplies } from "./project-community-posts";

const reply = (
  id: string,
  over: Partial<{ is_best_answer: boolean; thanks: number; created_at: string }> = {},
) => ({
  id,
  is_best_answer: false,
  thanks: 0,
  created_at: "2026-10-01T00:00:00Z",
  ...over,
});

describe("rankReplies", () => {
  it("puts the solution first, then the most thanked, then the newest", () => {
    const ranked = rankReplies([
      reply("old"),
      reply("new", { created_at: "2026-10-05T00:00:00Z" }),
      reply("thanked", { thanks: 3 }),
      reply("solution", { is_best_answer: true }),
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["solution", "thanked", "new", "old"]);
  });
});
