import { describe, expect, it } from "vitest";
import { filterGraphNodes, graphNodeMatches, graphTypeFacets } from "./graph-exploration";
import type { GraphNode } from "./graph-model";

const nodes: GraphNode[] = [
  { id: "person:ari", type: "person", label: "Ari" },
  { id: "skill:react", type: "skill", label: "React", description: "UI library" },
  { id: "project:atlas", type: "project", label: "Atlas", description: "A React dashboard" },
  { id: "milestone:launch", type: "milestone", label: "Launch" },
];

describe("graph exploration", () => {
  it("matches a query against labels and descriptions, case-insensitively", () => {
    expect(filterGraphNodes(nodes, { query: "react" }).map((node) => node.id)).toEqual([
      "skill:react",
      "project:atlas",
    ]);
    expect(graphNodeMatches(nodes[0], { query: "  " })).toBe(true);
    expect(graphNodeMatches(nodes[0], { query: "berkeley" })).toBe(false);
  });

  it("keeps only the requested node types", () => {
    expect(filterGraphNodes(nodes, { types: ["skill", "milestone"] }).map((n) => n.id)).toEqual([
      "skill:react",
      "milestone:launch",
    ]);
    expect(filterGraphNodes(nodes, { types: [] })).toHaveLength(4);
  });

  it("combines query and type filters", () => {
    expect(filterGraphNodes(nodes, { query: "react", types: ["project"] })).toHaveLength(1);
    expect(filterGraphNodes(nodes, { query: "react", types: ["person"] })).toHaveLength(0);
  });

  it("reports type facets with counts, most common first", () => {
    expect(graphTypeFacets(nodes)).toEqual([
      { type: "milestone", count: 1 },
      { type: "person", count: 1 },
      { type: "project", count: 1 },
      { type: "skill", count: 1 },
    ]);
  });
});
