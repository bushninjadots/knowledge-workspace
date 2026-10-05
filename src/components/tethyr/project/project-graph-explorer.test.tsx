import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { ProjectGraphExplorer } from "./project-graph-explorer";
import type { ProjectGraphInput } from "@/lib/project-graph";

// jsdom lacks matchMedia — vaul uses it to detect the desktop breakpoint.
beforeAll(() => {
  window.matchMedia =
    window.matchMedia ??
    (((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia);
});

const input: ProjectGraphInput = {
  project: { id: "atlas", title: "Atlas" },
  contributors: [{ profile_id: "ari", role: "creator", profile: { display_name: "Ari" } }],
  skills: [{ name: "TypeScript" }],
  milestones: [{ id: "launch", title: "Launch" }],
};

function renderExpanded() {
  render(<ProjectGraphExplorer input={input} />);
  fireEvent.click(screen.getByRole("button", { name: /show .* connections/i }));
}

/** The list tests describe the grouped list; the map is the default view. */
function renderExpandedList() {
  renderExpanded();
  fireEvent.click(screen.getByRole("button", { name: "List" }));
}

describe("ProjectGraphExplorer", () => {
  it("opens on the network map, the spec's most expressive view (§8 VIEW 1)", () => {
    renderExpanded();

    expect(screen.getByRole("group", { name: "Network map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ari — People/ })).toBeInTheDocument();
  });

  it("dims map non-matches while filters narrow the list", () => {
    renderExpanded();

    fireEvent.change(screen.getByLabelText("Search connections"), { target: { value: "launch" } });

    // The map keeps its spatial context: matches stay full, the rest dim.
    const launch = screen.getByRole("button", { name: /Launch — Milestones/ });
    const ari = screen.getByRole("button", { name: /Ari — People/ });
    expect(launch.className).not.toContain("opacity-25");
    expect(ari.className).toContain("opacity-25");
    // Dimmed nodes remain clickable (spec §26: dim, don't remove).
    expect(ari).toBeEnabled();
  });

  it("filters the grouped connections by search text", () => {
    renderExpandedList();
    expect(screen.getByRole("heading", { name: "People" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search connections"), { target: { value: "launch" } });

    expect(screen.getByRole("heading", { name: "Milestones" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "People" })).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 3 connections/)).toBeInTheDocument();
  });

  it("filters by node type and clears back to every connection", () => {
    renderExpandedList();

    fireEvent.click(screen.getByRole("button", { name: /^People/ }));

    expect(screen.getByRole("heading", { name: "People" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Skills" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Milestones" })).toBeInTheDocument();
  });

  it("traces how two connected objects are related", async () => {
    renderExpanded();
    fireEvent.click(screen.getByRole("button", { name: /how are these connected/i }));

    expect(
      screen.getByText(/Choose two objects to see how they are connected/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Path from node"));
    fireEvent.click(screen.getByRole("option", { name: /^Ari/ }));
    fireEvent.click(screen.getByLabelText("Path to node"));
    fireEvent.click(screen.getByRole("option", { name: /^Atlas/ }));

    const pathStep = screen.getByRole("button", { name: "Inspect Atlas" });
    expect(pathStep).toHaveTextContent("Ari produced Atlas");

    fireEvent.click(pathStep);
    expect(await screen.findByRole("dialog", { name: "Atlas" })).toBeInTheDocument();
  });

  it("expands large connection lists progressively", () => {
    const contributors = Array.from({ length: 30 }, (_, index) => ({
      profile_id: `person-${index}`,
      role: "contributor",
      profile: { display_name: `Person ${index}` },
    }));
    render(
      <ProjectGraphExplorer
        input={{
          project: { id: "atlas", title: "Atlas" },
          contributors,
          skills: [],
          milestones: [],
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show 30 connections" }));
    fireEvent.click(screen.getByRole("button", { name: "List" }));

    // The page is capped (density-aware), so the furthest connection is not yet rendered.
    expect(screen.queryByText("Person 29")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show 6 more connections/i }));

    expect(screen.getByText("Person 29")).toBeInTheDocument();
  });

  it("opens a node inspector with its relationships from a connection", async () => {
    const user = userEvent.setup();
    renderExpandedList();

    await user.click(screen.getByRole("button", { name: "Ari" }));

    expect(await screen.findByRole("dialog", { name: "Ari" })).toBeInTheDocument();
    // Ari's relationship to the project is spelled out, not just implied.
    expect(screen.getByRole("button", { name: /produced\s*Atlas/i })).toBeInTheDocument();
  });

  it("renders a contribution trail with inspectable work (spec VIEW 6)", async () => {
    render(
      <ProjectGraphExplorer
        input={{
          ...input,
          contributions: [
            { id: "contribution-1", label: "Built the navigation", description: "Shipped the first working route." },
          ],
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /show .* connections/i }));
    fireEvent.click(screen.getByRole("button", { name: "Contribution trail" }));

    expect(screen.getByText("Built the navigation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Inspect Built the navigation" }));
    expect(await screen.findByRole("dialog", { name: "Built the navigation" })).toBeInTheDocument();
  });

  it("renders project history as a timeline with origins, events, and forks (spec VIEW 5)", () => {
    render(
      <ProjectGraphExplorer
        input={{
          ...input,
          forkedFrom: { id: "origin", title: "Atlas Origin" },
          history: [
            { id: "idea", label: "Initial idea", date: "2026-08-01" },
            { id: "launch", label: "Launch", date: "2026-09-01" },
          ],
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /show .* connections/i }));
    fireEvent.click(screen.getByRole("button", { name: /project lineage/i }));

    // The origin opens the story; dated events follow in order.
    const timelineItems = screen.getAllByRole("listitem");
    const titles = timelineItems.map((item) => item.textContent ?? "");
    expect(titles.some((text) => text.includes("Atlas Origin"))).toBe(true);
    expect(titles.findIndex((text) => text.includes("Initial idea"))).toBeLessThan(
      titles.findIndex((text) => text.includes("Launch")),
    );

    fireEvent.click(screen.getByRole("button", { name: "Inspect Initial idea" }));
    expect(screen.getByRole("dialog", { name: "Initial idea" })).toBeInTheDocument();
  });

  it("explains an empty filter result instead of showing nothing", () => {
    renderExpanded();

    fireEvent.change(screen.getByLabelText("Search connections"), {
      target: { value: "nothing-here" },
    });

    expect(screen.getByText(/No connections match these filters/)).toBeInTheDocument();
  });
});
