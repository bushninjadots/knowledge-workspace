import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectGraphExplorer } from "./project-graph-explorer";
import type { ProjectGraphInput } from "@/lib/project-graph";

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

  it("explains an empty filter result instead of showing nothing", () => {
    renderExpanded();

    fireEvent.change(screen.getByLabelText("Search connections"), {
      target: { value: "nothing-here" },
    });

    expect(screen.getByText(/No connections match these filters/)).toBeInTheDocument();
  });
});
