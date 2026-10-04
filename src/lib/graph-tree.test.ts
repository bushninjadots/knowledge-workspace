import { describe, expect, it } from "vitest";
import { buildGraphTree } from "./graph-tree";
import type { TethyrGraph } from "./graph-model";

const graph: TethyrGraph = {
  nodes: [
    { id: "project:atlas", type: "project", label: "Atlas" },
    { id: "person:ari", type: "person", label: "Ari" },
    { id: "skill:react", type: "skill", label: "React" },
    { id: "person:sam", type: "person", label: "Sam" },
  ],
  edges: [
    { id: "e1", type: "contributed_to", from: "person:ari", to: "project:atlas" },
    { id: "e2", type: "used_in", from: "skill:react", to: "project:atlas" },
    { id: "e3", type: "demonstrated_skill", from: "person:sam", to: "skill:react" },
  ],
};

describe("buildGraphTree", () => {
  it("roots at the requested node and phrases each relationship", () => {
    const tree = buildGraphTree(graph, "project:atlas");
    expect(tree).not.toBeNull();
    expect(tree!.root.node.id).toBe("project:atlas");
    expect(tree!.root.phrase).toBeUndefined();
    expect(tree!.nodeCount).toBe(4);

    const people = tree!.root.children.find((child) => child.node.id === "person:ari");
    // Ari -> Atlas is traversed backwards, so the phrase reads from the project.
    expect(people!.phrase).toBe("was contributed to by");

    const skill = tree!.root.children.find((child) => child.node.id === "skill:react");
    expect(skill!.phrase).toBe("used");
  });

  it("nests deeper relationships up to maxDepth", () => {
    const tree = buildGraphTree(graph, "project:atlas", { maxDepth: 2 });
    const skill = tree!.root.children.find((child) => child.node.id === "skill:react");
    expect(skill!.children.map((child) => child.node.id)).toEqual(["person:sam"]);
  });

  it("stops at maxDepth", () => {
    const tree = buildGraphTree(graph, "project:atlas", { maxDepth: 1 });
    const skill = tree!.root.children.find((child) => child.node.id === "skill:react");
    expect(skill!.children).toEqual([]);
  });

  it("caps large graphs and reports truncation", () => {
    const tree = buildGraphTree(graph, "project:atlas", { maxDepth: 3, maxNodes: 2 });
    expect(tree!.truncated).toBe(true);
    expect(tree!.nodeCount).toBe(2);
  });

  it("returns null for a missing root", () => {
    expect(buildGraphTree(graph, "project:missing")).toBeNull();
  });
});
