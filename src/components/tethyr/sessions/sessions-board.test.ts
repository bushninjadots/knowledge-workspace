import { describe, expect, it } from "vitest";
import { BOARD_COLUMNS, groupSessionsByColumn } from "./sessions-board";
import type { SessionStatus } from "@/hooks/use-sessions";

describe("groupSessionsByColumn", () => {
  it("creates a stable bucket per board column, in column order", () => {
    const keys = Object.keys(groupSessionsByColumn([]));
    expect(keys).toEqual(BOARD_COLUMNS.map((column) => column.status));
  });

  it("places each session in its status column", () => {
    const sessions = [
      { id: "a", status: "scheduled" as SessionStatus },
      { id: "b", status: "confirmed" as SessionStatus },
      { id: "c", status: "scheduled" as SessionStatus },
      { id: "d", status: "completed" as SessionStatus },
    ];
    const grouped = groupSessionsByColumn(sessions);
    expect(grouped.scheduled.map((s) => s.id)).toEqual(["a", "c"]);
    expect(grouped.confirmed.map((s) => s.id)).toEqual(["b"]);
    expect(grouped.completed.map((s) => s.id)).toEqual(["d"]);
    expect(grouped.in_progress).toEqual([]);
    expect(grouped.invitation_sent).toEqual([]);
  });

  it("drops statuses the board does not render (draft, cancelled)", () => {
    const sessions = [
      { id: "a", status: "draft" as SessionStatus },
      { id: "b", status: "cancelled" as SessionStatus },
      { id: "c", status: "confirmed" as SessionStatus },
    ];
    const grouped = groupSessionsByColumn(sessions);
    expect(
      Object.values(grouped)
        .flat()
        .map((s) => s.id),
    ).toEqual(["c"]);
  });
});
