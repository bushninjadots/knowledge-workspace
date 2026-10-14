import { describe, expect, it } from "vitest";
import { groupCommitRuns } from "./activity-rows";

const at = (d: number, h: number) => new Date(2026, 9, d, h).toISOString();

describe("groupCommitRuns", () => {
  it("folds same-day commit runs and keeps everything else in order", () => {
    const rows = groupCommitRuns([
      { kind: "github", at: at(14, 18) },
      { kind: "github", at: at(14, 12) },
      { kind: "github", at: at(14, 9) },
      { kind: "update", at: at(14, 8) },
      { kind: "github", at: at(13, 20) },
      { kind: "github", at: at(12, 20) },
      { kind: "github", at: at(12, 10) },
    ]);
    expect(
      rows.map((r) => (r.type === "commits" ? `commits×${r.items.length}` : r.item.kind)),
    ).toEqual(["commits×3", "update", "github", "commits×2"]);
  });
});
