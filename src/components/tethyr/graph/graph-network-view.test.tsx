import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createGraphEdge, createGraphNode, normalizeGraph } from "@/lib/graph-model";
import { GraphNetworkView } from "./graph-network-view";

function connectedGraph() {
  return normalizeGraph({
    nodes: [
      createGraphNode({ id: "project:atlas", type: "project", label: "Atlas" }),
      createGraphNode({ id: "person:ari", type: "person", label: "Ari" }),
      createGraphNode({ id: "person:nia", type: "person", label: "Nia" }),
      createGraphNode({ id: "skill:react", type: "skill", label: "React" }),
    ],
    edges: [
      createGraphEdge({ type: "contributed_to", from: "person:ari", to: "project:atlas" }),
      createGraphEdge({ type: "contributed_to", from: "person:nia", to: "project:atlas" }),
      createGraphEdge({ type: "demonstrated_skill", from: "person:ari", to: "skill:react" }),
    ],
  });
}

describe("GraphNetworkView", () => {
  it("renders the root and its connections as labelled, keyboard-operable nodes", () => {
    render(<GraphNetworkView graph={connectedGraph()} rootId="project:atlas" />);

    expect(screen.getByRole("group", { name: "Network map" })).toBeInTheDocument();
    for (const label of ["Atlas", "Ari", "Nia", "React"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("reports the selection when a node is chosen", async () => {
    const onSelect = vi.fn();
    render(
      <GraphNetworkView graph={connectedGraph()} rootId="project:atlas" onSelect={onSelect} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Ari — People/ }));
    expect(onSelect).toHaveBeenCalledWith("person:ari");
  });

  it("dims non-matching nodes when a filter is active instead of removing them (spec §26)", () => {
    render(
      <GraphNetworkView
        graph={connectedGraph()}
        rootId="project:atlas"
        isMatch={(node) => node.type === "person"}
      />,
    );

    const react = screen.getByRole("button", { name: /React — Skills/ });
    const ari = screen.getByRole("button", { name: /Ari — People/ });
    expect(react.className).toContain("opacity-25");
    expect(ari.className).not.toContain("opacity-25");
    // Dimmed nodes stay interactive — the filter narrows focus, not access.
    expect(react).toBeEnabled();
  });

  it("notes how many connections the cap left out (spec §45)", () => {
    const nodes = [
      createGraphNode({ id: "project:atlas", type: "project", label: "Atlas" }),
      ...Array.from({ length: 50 }, (_, i) =>
        createGraphNode({ id: `person:p${i}`, type: "person", label: `Member ${i}` }),
      ),
    ];
    const graph = normalizeGraph({
      nodes,
      edges: nodes
        .filter((node) => node.id !== "project:atlas")
        .map((node) =>
          createGraphEdge({ type: "contributed_to", from: node.id, to: "project:atlas" }),
        ),
    });

    render(<GraphNetworkView graph={graph} rootId="project:atlas" maxNodes={20} />);
    expect(screen.getByRole("status")).toHaveTextContent("31 further connections are");
  });

  it("renders nothing for a root without connections", () => {
    const graph = normalizeGraph({
      nodes: [createGraphNode({ id: "project:solo", type: "project", label: "Solo" })],
      edges: [],
    });
    const { container } = render(<GraphNetworkView graph={graph} rootId="project:solo" />);
    expect(container).toBeEmptyDOMElement();
  });
});
