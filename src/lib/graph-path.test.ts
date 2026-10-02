import { describe, expect, it } from "vitest";
import { describeGraphStep, findGraphPath } from "./graph-path";
import type { TethyrGraph } from "./graph-model";

const graph: TethyrGraph = {
  nodes: [
    { id: "person:ari", type: "person", label: "Ari" },
    { id: "project:atlas", type: "project", label: "Atlas" },
    { id: "skill:react", type: "skill", label: "React" },
    { id: "person:sam", type: "person", label: "Sam" },
    { id: "person:nia", type: "person", label: "Nia" },
  ],
  edges: [
    { id: "e1", type: "produced", from: "person:ari", to: "project:atlas" },
    { id: "e2", type: "used_in", from: "skill:react", to: "project:atlas" },
    { id: "e3", type: "demonstrated_skill", from: "person:sam", to: "skill:react" },
  ],
};

describe("findGraphPath", () => {
  it("finds the shortest path and explains each step", () => {
    const path = findGraphPath(graph, "person:sam", "person:ari");
    expect(path).not.toBeNull();
    expect(path!.nodes.map((node) => node.id)).toEqual([
      "person:sam",
      "skill:react",
      "project:atlas",
      "person:ari",
    ]);
    expect(path!.steps.map(describeGraphStep)).toEqual([
      "Sam demonstrated React",
      "React was used in Atlas",
      "Atlas was produced by Ari",
    ]);
  });

  it("treats relationships as undirected", () => {
    const forward = findGraphPath(graph, "person:ari", "skill:react");
    const backward = findGraphPath(graph, "skill:react", "person:ari");
    expect(forward!.nodes.map((n) => n.id)).toEqual(["person:ari", "project:atlas", "skill:react"]);
    expect(backward!.nodes.map((n) => n.id)).toEqual(["skill:react", "project:atlas", "person:ari"]);
    expect(backward!.steps.map(describeGraphStep)).toEqual([
      "React was used in Atlas",
      "Atlas was produced by Ari",
    ]);
  });

  it("returns an empty path for the same node and null when disconnected", () => {
    expect(findGraphPath(graph, "person:ari", "person:ari")!.steps).toEqual([]);
    expect(findGraphPath(graph, "person:nia", "person:ari")).toBeNull();
    expect(findGraphPath(graph, "person:ari", "missing")).toBeNull();
  });

  it("respects the depth limit", () => {
    expect(findGraphPath(graph, "person:sam", "person:ari", { maxDepth: 2 })).toBeNull();
    expect(findGraphPath(graph, "person:sam", "person:ari", { maxDepth: 3 })).not.toBeNull();
  });
});
