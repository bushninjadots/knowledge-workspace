import { describe, it, expect } from "vitest";
import { compileProjectCredits, creditTextFor, normalizeRole } from "./credits";

const PROFILES = [
  { id: "u1", display_name: "Maya Chen", handle: "maya" },
  { id: "u2", display_name: "Devon Okafor", handle: "devon" },
  { id: "u3", display_name: "Alex Ruiz", handle: "alex" },
  { id: "u4", display_name: null, handle: "sam" },
];

describe("normalizeRole", () => {
  it("keeps known roles and folds unknowns into contributor", () => {
    expect(normalizeRole("creator")).toBe("creator");
    expect(normalizeRole("mentor")).toBe("mentor");
    expect(normalizeRole("contributor")).toBe("contributor");
    expect(normalizeRole("lead")).toBe("contributor");
  });
});

describe("creditTextFor", () => {
  it("wraps update titles, passes through full-sentence kinds", () => {
    expect(creditTextFor({ kind: "update", title: "Beta launch" })).toBe(
      "Posted update “Beta launch”",
    );
    expect(creditTextFor({ kind: "discussion", title: "Started discussion: API design" })).toBe(
      "Started discussion: API design",
    );
    expect(creditTextFor({ kind: "contributor_joined", title: "x" })).toBe(
      "Joined the project as a contributor",
    );
    expect(creditTextFor({ kind: "role_filled", title: "Filled the role: Illustrator" })).toBe(
      "Filled the role: Illustrator",
    );
  });
});

describe("compileProjectCredits", () => {
  const project = { profile_id: "u1", created_at: "2026-01-01T00:00:00Z" };
  const contributors = [
    { profile_id: "u1", role: "creator" },
    { profile_id: "u2", role: "mentor" },
    { profile_id: "u3", role: "contributor" },
    { profile_id: "u4", role: "contributor" },
  ];

  it("always credits the creator with 'Created the project'", () => {
    const result = compileProjectCredits({
      contributors,
      activity: [],
      project,
      profiles: PROFILES,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      profile_id: "u1",
      role: "creator",
      credit_text: "Created the project",
      handle: "maya",
    });
  });

  it("groups by actor, keeps strongest role and orders role → chronology", () => {
    const result = compileProjectCredits({
      contributors,
      project,
      profiles: PROFILES,
      activity: [
        {
          actor_id: "u3",
          kind: "need_filled",
          title: "Filled a need: motion",
          created_at: "2026-04-01T00:00:00Z",
        },
        {
          actor_id: "u2",
          kind: "discussion",
          title: "Started discussion: API design",
          created_at: "2026-02-01T00:00:00Z",
        },
        { actor_id: "u1", kind: "update", title: "Week 8", created_at: "2026-03-01T00:00:00Z" },
      ],
    });

    expect(result.map((c) => c.role)).toEqual(["creator", "mentor", "contributor"]);
    // Within a role, chronological (oldest first).
    expect(result[0].profile_id).toBe("u1");
    expect(result[1].profile_id).toBe("u2");
    expect(result[2].profile_id).toBe("u3");

    // The creator's headline stays "Created the project" while count grows.
    expect(result[0].credit_text).toBe("Created the project");
    expect(result[0].credit_count).toBe(2);

    // A non-creator shows their latest credit text and date.
    expect(result[1].credit_text).toBe("Started discussion: API design");
  });

  it("keeps the latest credit for an actor with several events", () => {
    const result = compileProjectCredits({
      contributors: [{ profile_id: "u3", role: "contributor" }],
      project,
      profiles: PROFILES,
      activity: [
        {
          actor_id: "u3",
          kind: "file_added",
          title: "Added logo.svg",
          created_at: "2026-02-01T00:00:00Z",
        },
        {
          actor_id: "u3",
          kind: "need_filled",
          title: "Filled a need: motion",
          created_at: "2026-05-01T00:00:00Z",
        },
      ],
    });

    const u3 = result.find((c) => c.profile_id === "u3");
    expect(u3?.credit_text).toBe("Filled a need: motion");
    expect(u3?.credit_count).toBe(2);
  });

  it("falls back to the handle when display_name is missing", () => {
    const result = compileProjectCredits({
      contributors: [{ profile_id: "u4", role: "contributor" }],
      project,
      profiles: PROFILES,
      activity: [
        {
          actor_id: "u4",
          kind: "contributor_joined",
          title: "x",
          created_at: "2026-02-01T00:00:00Z",
        },
      ],
    });

    const u4 = result.find((c) => c.profile_id === "u4");
    expect(u4?.display_name).toBe("sam");
  });

  it("skips actorless events and returns an empty roll when nothing is attributable", () => {
    const result = compileProjectCredits({
      contributors: [],
      project: null,
      profiles: [],
      activity: [
        {
          actor_id: null,
          kind: "milestone_done",
          title: "Completed milestone: Beta",
          created_at: "2026-02-01T00:00:00Z",
        },
      ],
    });
    expect(result).toEqual([]);
  });
});
