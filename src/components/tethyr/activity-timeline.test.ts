import { describe, it, expect } from "vitest";
import { buildTimelineGroups } from "./activity-timeline";

const iso = (s: string) => new Date(s).toISOString();
const base = "2026-01-05T12:00:00.000Z";

function event(overrides: Partial<Parameters<typeof buildTimelineGroups>[0][number]> = {}) {
  return {
    id: "e1",
    kind: "community_post_created",
    metadata: { project_id: "p1" },
    created_at: base,
    source: "contribution" as const,
    ...overrides,
  };
}

describe("buildTimelineGroups", () => {
  it("merges mirrored rows with the same identity within the mirror window", () => {
    const groups = buildTimelineGroups([
      event({
        id: "a",
        kind: "project_update_posted",
        metadata: { project_id: "p1", points: 3 },
        created_at: iso("2026-01-05T12:00:00Z"),
      }),
      event({
        id: "b",
        kind: "project_update_posted",
        metadata: { project_id: "p1", points: 3 },
        created_at: iso("2026-01-05T12:00:02Z"),
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].metadata.points).toBe(3);
  });

  it("groups repeated actions in the rolling window and sums points", () => {
    const groups = buildTimelineGroups([
      event({
        id: "a",
        kind: "community_post_created",
        metadata: { project_id: "p1", points: 2 },
        created_at: iso("2026-01-05T12:00:00Z"),
      }),
      event({
        id: "b",
        kind: "community_post_created",
        metadata: { project_id: "p1", points: 2 },
        created_at: iso("2026-01-05T12:05:00Z"),
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(2);
    expect(groups[0].metadata.points).toBe(4);
  });

  it("keeps different identities separate", () => {
    const groups = buildTimelineGroups([
      event({ id: "a", kind: "community_post_created", metadata: { project_id: "p1" } }),
      event({ id: "b", kind: "community_post_created", metadata: { project_id: "p2" } }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it("splits the same identity into separate groups beyond the rolling window", () => {
    const groups = buildTimelineGroups([
      event({
        id: "a",
        kind: "community_post_created",
        metadata: { project_id: "p1" },
        created_at: iso("2026-01-05T12:00:00Z"),
      }),
      event({
        id: "b",
        kind: "community_post_created",
        metadata: { project_id: "p1" },
        created_at: iso("2026-01-05T13:00:00Z"),
      }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it("sorts newest first", () => {
    const groups = buildTimelineGroups([
      event({ id: "older", created_at: iso("2026-01-04T12:00:00Z") }),
      event({ id: "newer", created_at: iso("2026-01-05T12:00:00Z") }),
    ]);

    expect(groups[0].id).toBe("newer");
    expect(groups[1].id).toBe("older");
  });
});
