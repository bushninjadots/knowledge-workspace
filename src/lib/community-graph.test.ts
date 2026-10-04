import { describe, expect, it } from "vitest";
import { buildCommunityGraph } from "./community-graph";

describe("buildCommunityGraph", () => {
  it("reuses the member node for a discussion author instead of duplicating them", () => {
    const graph = buildCommunityGraph({
      space: { id: "space-1", name: "Mapmakers" },
      members: [
        {
          user_id: "u-1",
          role: "member",
          profile: { display_name: "Bryce", handle: "bryce" },
        },
      ],
      discussions: [{ id: "d-1", title: "How do you map a river?", author_id: "u-1" }],
    });

    const bryceNodes = graph.nodes.filter((node) => node.id === "person:u-1");
    expect(bryceNodes).toHaveLength(1);
    expect(bryceNodes[0].label).toBe("Bryce");
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "produced", from: "person:u-1", to: "discussion:d-1" }),
      ]),
    );
  });

  it("creates a person node for a discussion author who is not a member, labeled honestly", () => {
    const graph = buildCommunityGraph({
      space: { id: "space-1", name: "Mapmakers" },
      members: [],
      discussions: [{ id: "d-2", title: "Hello from outside", author_id: "outsider-9" }],
    });

    const people = graph.nodes.filter((node) => node.type === "person");
    expect(people).toEqual([
      expect.objectContaining({ id: "person:outsider-9", label: "outsider-9" }),
    ]);
    // The author edge must survive normalization now that the node exists.
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "produced",
          from: "person:outsider-9",
          to: "discussion:d-2",
        }),
      ]),
    );
  });

  it("adds no person node when a discussion has no author", () => {
    const graph = buildCommunityGraph({
      space: { id: "space-1", name: "Mapmakers" },
      discussions: [{ id: "d-3", title: "Untitled origin" }],
    });

    expect(graph.nodes.filter((node) => node.type === "person")).toHaveLength(0);
    expect(graph.edges.filter((edge) => edge.to === "discussion:d-3")).toEqual([
      expect.objectContaining({ type: "contains", from: "community:space-1" }),
    ]);
  });
});
