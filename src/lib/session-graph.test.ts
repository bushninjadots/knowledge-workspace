import { describe, expect, it } from "vitest";
import {
  buildSessionGraph,
  getSessionGraphCounts,
  sessionGraphHasConnections,
  type SessionGraphInput,
} from "./session-graph";

function baseInput(overrides: Partial<SessionGraphInput> = {}): SessionGraphInput {
  return {
    session: { id: "s1", title: "React deep dive", description: "Pairing session" },
    organizer: { profile_id: "u1", display_name: "Maya" },
    participants: [
      {
        profile_id: "u2",
        role: "participant",
        status: "accepted",
        profile: { display_name: "Alex", handle: "alex" },
      },
    ],
    ...overrides,
  };
}

describe("buildSessionGraph", () => {
  it("connects the organizer and participants to the session", () => {
    const graph = buildSessionGraph(baseInput());

    const personNodes = graph.nodes.filter((n) => n.type === "person");
    expect(personNodes.map((n) => n.label).sort()).toEqual(["Alex", "Maya"]);

    const produced = graph.edges.find((e) => e.type === "produced");
    expect(produced?.from).toBe("person:u1");
    expect(produced?.to).toBe("session:s1");

    const participated = graph.edges.find((e) => e.type === "participated_in");
    expect(participated?.from).toBe("person:u2");
    expect(participated?.to).toBe("session:s1");
  });

  it("does not duplicate the organizer as a participant", () => {
    const graph = buildSessionGraph(
      baseInput({
        participants: [
          {
            profile_id: "u1",
            role: "participant",
            status: "accepted",
            profile: { display_name: "Maya" },
          },
          {
            profile_id: "u2",
            role: "participant",
            status: "accepted",
            profile: { display_name: "Alex" },
          },
        ],
      }),
    );

    const personNodes = graph.nodes.filter((n) => n.type === "person");
    expect(personNodes).toHaveLength(2);
  });

  it("connects the session to its skill, project, and community", () => {
    const graph = buildSessionGraph(
      baseInput({
        skill: { name: "React" },
        project: { id: "p1", title: "Atlas" },
        community: { id: "c1", name: "Frontend" },
      }),
    );

    expect(graph.nodes.find((n) => n.type === "skill")?.label).toBe("React");
    expect(graph.nodes.find((n) => n.type === "project")?.label).toBe("Atlas");
    expect(graph.nodes.find((n) => n.type === "community")?.label).toBe("Frontend");

    expect(graph.edges.find((e) => e.type === "uses")?.to).toBe("skill:react");
    expect(graph.edges.find((e) => e.type === "contains" && e.to === "session:s1")?.from).toBe(
      "project:p1",
    );
  });

  it("reports counts and detects connections", () => {
    const graph = buildSessionGraph(baseInput());
    const counts = getSessionGraphCounts(graph);
    expect(counts.session).toBe(1);
    expect(counts.person).toBe(2);
    expect(sessionGraphHasConnections(graph)).toBe(true);
  });

  it("has no connections when the session is alone", () => {
    const graph = buildSessionGraph({
      session: { id: "solo", title: "Solo session" },
    });
    expect(sessionGraphHasConnections(graph)).toBe(false);
    expect(graph.edges).toHaveLength(0);
  });
});
