import { describe, expect, it } from "vitest";
import {
  createGraphEdge,
  createGraphNode,
  getConnectedNodes,
  getContributionTrail,
  normalizeGraph,
  type TethyrGraph,
} from "./graph-model";

function fixture(): TethyrGraph {
  return {
    nodes: [
      { id: "person:1", type: "person", label: "Ari" },
      { id: "skill:1", type: "skill", label: "React" },
      { id: "project:1", type: "project", label: "Atlas" },
      { id: "milestone:1", type: "milestone", label: "Launch" },
    ],
    edges: [
      { id: "edge:skill", type: "has_skill", from: "person:1", to: "skill:1" },
      { id: "edge:project", type: "used_in", from: "skill:1", to: "project:1" },
      { id: "edge:milestone", type: "has_milestone", from: "project:1", to: "milestone:1" },
    ],
  };
}

describe("graph model", () => {
  it("creates stable typed node and edge records", () => {
    expect(createGraphNode({ type: "person", label: "Ari", id: "person:1" })).toEqual({
      type: "person",
      label: "Ari",
      id: "person:1",
    });
    expect(
      createGraphEdge({ type: "has_skill", from: "person:1", to: "skill:1", id: "edge:1" }).id,
    ).toBe("edge:1");
  });

  it("finds connected nodes to a requested depth and edge type", () => {
    const graph = fixture();
    expect(getConnectedNodes(graph, "person:1", { depth: 2 }).map((node) => node.id)).toEqual([
      "skill:1",
      "project:1",
    ]);
    expect(
      getConnectedNodes(graph, "person:1", { edgeType: "has_skill" }).map((node) => node.id),
    ).toEqual(["skill:1"]);
  });

  it("follows a contribution-oriented trail without requiring a visual graph", () => {
    const graph = fixture();
    graph.edges.unshift({
      id: "edge:contribution",
      type: "contributed_to",
      from: "person:1",
      to: "project:1",
    });
    expect(getContributionTrail(graph, "person:1").map((node) => node.id)).toEqual([
      "person:1",
      "project:1",
      "milestone:1",
    ]);
  });

  it("deduplicates nodes and drops dangling relationships", () => {
    const graph = fixture();
    graph.nodes.push(graph.nodes[0]);
    graph.edges.push({ id: "dangling", type: "related_to", from: "project:1", to: "missing" });
    const normalized = normalizeGraph(graph);
    expect(normalized.nodes).toHaveLength(4);
    expect(normalized.edges).toHaveLength(3);
  });
});
