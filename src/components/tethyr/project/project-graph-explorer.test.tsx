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

describe("ProjectGraphExplorer", () => {
  it("filters the grouped connections by search text", () => {
    renderExpanded();
    expect(screen.getByRole("heading", { name: "People" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search connections"), { target: { value: "launch" } });

    expect(screen.getByRole("heading", { name: "Milestones" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "People" })).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 3 connections/)).toBeInTheDocument();
  });

  it("filters by node type and clears back to every connection", () => {
    renderExpanded();

    fireEvent.click(screen.getByRole("button", { name: /^People/ }));

    expect(screen.getByRole("heading", { name: "People" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Skills" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Milestones" })).toBeInTheDocument();
  });

  it("traces how two connected objects are related", () => {
    renderExpanded();
    fireEvent.click(screen.getByRole("button", { name: /how are these connected/i }));

    expect(
      screen.getByText(/Choose two objects to see how they are connected/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Path from node"));
    fireEvent.click(screen.getByRole("option", { name: "Ari" }));
    fireEvent.click(screen.getByLabelText("Path to node"));
    fireEvent.click(screen.getByRole("option", { name: "Atlas" }));

    expect(screen.getByText("Ari produced Atlas")).toBeInTheDocument();
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

    // The page is capped (density-aware), so the furthest connection is not yet rendered.
    expect(screen.queryByText("Person 29")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show 6 more connections/i }));

    expect(screen.getByText("Person 29")).toBeInTheDocument();
  });

  it("opens a node inspector with its relationships from a connection", async () => {
    const user = userEvent.setup();
    renderExpanded();

    await user.click(screen.getByRole("button", { name: "Ari" }));

    expect(await screen.findByRole("dialog", { name: "Ari" })).toBeInTheDocument();
    // Ari's relationship to the project is spelled out, not just implied.
    expect(screen.getByRole("button", { name: /produced\s*Atlas/i })).toBeInTheDocument();
  });

  it("explains an empty filter result instead of showing nothing", () => {
    renderExpanded();

    fireEvent.change(screen.getByLabelText("Search connections"), {
      target: { value: "nothing-here" },
    });

    expect(screen.getByText(/No connections match these filters/)).toBeInTheDocument();
  });
});
