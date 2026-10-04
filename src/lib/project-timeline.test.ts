import { describe, expect, it } from "vitest";
import { createGraphEdge, createGraphNode, normalizeGraph } from "./graph-model";
import { buildProjectTimeline } from "./project-timeline";

function historyGraph() {
  return normalizeGraph({
    nodes: [
      createGraphNode({ id: "project:origin", type: "project", label: "Atlas Origin" }),
      createGraphNode({ id: "project:atlas", type: "project", label: "Atlas" }),
      createGraphNode({
        id: "milestone:launch",
        type: "milestone",
        label: "Launch",
        metadata: { date: "2026-09-01" },
      }),
      createGraphNode({
        id: "milestone:idea",
        type: "milestone",
        label: "Initial idea",
        metadata: { date: "2026-08-01" },
      }),
      createGraphNode({
        id: "contribution:c1",
        type: "contribution",
        label: "Completed milestone: Map view",
        metadata: { date: "2026-08-20" },
      }),
      createGraphNode({
        id: "repository:repo",
        type: "repository",
        label: "ari/atlas",
        metadata: { importedAt: "2026-08-10" },
      }),
      createGraphNode({ id: "project:atlas-next", type: "project", label: "Atlas Next" }),
      createGraphNode({ id: "skill:react", type: "skill", label: "React" }),
    ],
    edges: [
      createGraphEdge({ type: "forked_from", from: "project:atlas", to: "project:origin" }),
      createGraphEdge({ type: "has_milestone", from: "project:atlas", to: "milestone:launch" }),
      createGraphEdge({ type: "has_milestone", from: "project:atlas", to: "milestone:idea" }),
      createGraphEdge({ type: "produced", from: "contribution:c1", to: "project:atlas" }),
      createGraphEdge({ type: "imported_from", from: "project:atlas", to: "repository:repo" }),
      createGraphEdge({ type: "derived_from", from: "project:atlas", to: "project:atlas-next" }),
      // Unrelated relationships must stay out of the timeline.
      createGraphEdge({ type: "used_in", from: "skill:react", to: "project:atlas" }),
    ],
  });
}

describe("buildProjectTimeline", () => {
  it("orders origins first, dated events chronologically, forks last", () => {
    const timeline = buildProjectTimeline(historyGraph(), "project:atlas")!;

    expect(timeline.entries.map((entry) => [entry.kind, entry.title])).toEqual([
      ["origin", "Atlas Origin"],
      ["milestone", "Initial idea"],
      ["import", "ari/atlas"],
      ["contribution", "Completed milestone: Map view"],
      ["milestone", "Launch"],
      ["fork", "Atlas Next"],
    ]);
    expect(timeline.omitted).toBe(0);
  });

  it("carries descriptions and dates from node metadata", () => {
    const graph = normalizeGraph({
      nodes: [
        createGraphNode({ id: "project:atlas", type: "project", label: "Atlas" }),
        createGraphNode({
          id: "milestone:idea",
          type: "milestone",
          label: "Initial idea",
          description: "The napkin sketch",
          metadata: { date: "2026-08-01" },
        }),
      ],
      edges: [
        createGraphEdge({ type: "has_milestone", from: "project:atlas", to: "milestone:idea" }),
      ],
    });

    const timeline = buildProjectTimeline(graph, "project:atlas")!;
    expect(timeline.entries[0]).toMatchObject({
      kind: "milestone",
      title: "Initial idea",
      description: "The napkin sketch",
      date: "2026-08-01",
    });
  });

  it("counts imported GitHub commits as dated contributions", () => {
    const graph = normalizeGraph({
      nodes: [
        createGraphNode({ id: "project:atlas", type: "project", label: "Atlas" }),
        createGraphNode({
          id: "contribution:sha-1",
          type: "contribution",
          label: "Add the map view",
          metadata: { date: "2026-10-01", provider: "github" },
        }),
      ],
      edges: [
        createGraphEdge({
          type: "contributed_to",
          from: "contribution:sha-1",
          to: "project:atlas",
          metadata: { provider: "github" },
        }),
      ],
    });

    const timeline = buildProjectTimeline(graph, "project:atlas")!;
    expect(timeline.entries).toEqual([
      expect.objectContaining({ kind: "contribution", title: "Add the map view" }),
    ]);
  });

  it("caps entries and reports the rest as omitted (spec §45)", () => {
    const graph = historyGraph();
    const timeline = buildProjectTimeline(graph, "project:atlas", { maxEntries: 2 });
    expect(timeline!.entries).toHaveLength(2);
    expect(timeline!.omitted).toBe(4);
  });

  it("returns null when the project is not in the graph", () => {
    expect(buildProjectTimeline(historyGraph(), "project:missing")).toBeNull();
  });
});
