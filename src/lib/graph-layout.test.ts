import { describe, expect, it } from "vitest";
import { createGraphEdge, createGraphNode, normalizeGraph } from "./graph-model";
import { computeRadialLayout } from "./graph-layout";

function starGraph(spokes: number) {
  const nodes = [
    createGraphNode({ id: "project:atlas", type: "project", label: "Atlas" }),
    ...Array.from({ length: spokes }, (_, i) =>
      createGraphNode({ id: `person:p${i}`, type: "person", label: `Member ${i}` }),
    ),
  ];
  const edges = Array.from({ length: spokes }, (_, i) =>
    createGraphEdge({ type: "contributed_to", from: `person:p${i}`, to: "project:atlas" }),
  );
  return normalizeGraph({ nodes, edges });
}

describe("computeRadialLayout", () => {
  it("places the root at the centre and direct connections on ring 1", () => {
    const graph = starGraph(6);
    const layout = computeRadialLayout(graph, "project:atlas", { ringGap: 100 });

    expect(layout).not.toBeNull();
    const root = layout!.nodes.find((entry) => entry.node.id === "project:atlas");
    expect(root).toMatchObject({ ring: 0, x: 0, y: 0 });

    const ring1 = layout!.nodes.filter((entry) => entry.ring === 1);
    expect(ring1).toHaveLength(6);
    for (const entry of ring1) {
      const radius = Math.hypot(entry.x, entry.y);
      expect(radius).toBeCloseTo(100, 5);
    }
    // Angles spread evenly around the ring (odd rings staggered half a step).
    const angles = ring1.map((entry) => entry.angle).sort((a, b) => a - b);
    const step = (Math.PI * 2) / 6;
    for (let i = 1; i < angles.length; i += 1) {
      expect(angles[i] - angles[i - 1]).toBeCloseTo(step, 5);
    }
  });

  it("is deterministic for the same graph", () => {
    const graph = starGraph(8);
    const first = computeRadialLayout(graph, "project:atlas");
    const second = computeRadialLayout(graph, "project:atlas");
    expect(second).toEqual(first);
  });

  it("caps placed nodes and reports the rest as omitted (spec §45)", () => {
    const graph = starGraph(50);
    const layout = computeRadialLayout(graph, "project:atlas", { maxNodes: 40 });

    expect(layout!.nodes).toHaveLength(40);
    expect(layout!.omitted).toBe(11);
  });

  it("returns only edges whose endpoints were both placed", () => {
    const graph = starGraph(50);
    const layout = computeRadialLayout(graph, "project:atlas", { maxNodes: 10 });

    const placedIds = new Set(layout!.nodes.map((entry) => entry.node.id));
    for (const edge of layout!.edges) {
      expect(placedIds.has(edge.from)).toBe(true);
      expect(placedIds.has(edge.to)).toBe(true);
    }
    expect(layout!.edges.length).toBeLessThanOrEqual(placedIds.size);
  });

  it("returns null when the root is not in the graph", () => {
    const graph = starGraph(3);
    expect(computeRadialLayout(graph, "project:missing")).toBeNull();
  });

  it("splits rings by relationship depth, not node type", () => {
    // person -> skill edges make skills ring 2 from the project root.
    const nodes = [
      createGraphNode({ id: "project:atlas", type: "project", label: "Atlas" }),
      createGraphNode({ id: "person:ari", type: "person", label: "Ari" }),
      createGraphNode({ id: "skill:react", type: "skill", label: "React" }),
    ];
    const graph = normalizeGraph({
      nodes,
      edges: [
        createGraphEdge({ type: "contributed_to", from: "person:ari", to: "project:atlas" }),
        createGraphEdge({ type: "demonstrated_skill", from: "person:ari", to: "skill:react" }),
      ],
    });

    const layout = computeRadialLayout(graph, "project:atlas");
    const ringOf = (id: string) => layout!.nodes.find((entry) => entry.node.id === id)?.ring;
    expect(ringOf("person:ari")).toBe(1);
    expect(ringOf("skill:react")).toBe(2);
  });
});
