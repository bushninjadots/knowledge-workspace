import { describe, it, expect } from "vitest";
import { diffLines, diffStats } from "@/lib/line-diff";

/**
 * Backs the version-history view. The subtle part is that the output is a
 * *sequence* — removed lines before added ones at the same position — because
 * the renderer zips added and removed rows side by side.
 */
describe("diffLines", () => {
  it("marks an unchanged document as all same", () => {
    expect(diffLines("a\nb", "a\nb")).toEqual([
      { type: "same", text: "a" },
      { type: "same", text: "b" },
    ]);
  });

  it("reports an appended line as added", () => {
    expect(diffLines("a", "a\nb")).toEqual([
      { type: "same", text: "a" },
      { type: "add", text: "b" },
    ]);
  });

  it("reports a removed line as deleted", () => {
    expect(diffLines("a\nb", "a")).toEqual([
      { type: "same", text: "a" },
      { type: "del", text: "b" },
    ]);
  });

  it("keeps the surrounding lines in place when one line changes", () => {
    expect(diffLines("title\nold body\nend", "title\nnew body\nend")).toEqual([
      { type: "same", text: "title" },
      { type: "del", text: "old body" },
      { type: "add", text: "new body" },
      { type: "same", text: "end" },
    ]);
  });

  it("treats an emptied document as deletions plus the empty line it splits into", () => {
    // `"".split("\n")` is [""], so emptying a document is "both lines removed"
    // and "one empty line added" — whichever the renderer shows, the count is
    // what a version-history header reports, so it is pinned here.
    expect(diffLines("a\nb", "")).toEqual([
      { type: "del", text: "a" },
      { type: "del", text: "b" },
      { type: "add", text: "" },
    ]);
  });

  it("handles an empty document on both sides", () => {
    expect(diffLines("", "")).toEqual([{ type: "same", text: "" }]);
  });
});

describe("diffStats", () => {
  it("counts added and removed lines only", () => {
    expect(diffStats(diffLines("a\nold\nc", "a\nnew\nc"))).toEqual({ added: 1, removed: 1 });
    expect(diffStats(diffLines("a", "a\nb\nc"))).toEqual({ added: 2, removed: 0 });
    expect(diffStats([])).toEqual({ added: 0, removed: 0 });
  });
});
