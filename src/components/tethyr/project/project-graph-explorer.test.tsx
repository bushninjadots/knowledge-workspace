import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProjectGraphExplorer } from "./project-graph-explorer";
import type { ProjectGraphInput } from "@/lib/project-graph";

const baseInput: ProjectGraphInput = {
  project: { id: "p1", title: "Reverb" },
  contributors: [
    {
      profile_id: "u1",
      role: "creator",
      profile: { display_name: "Maya", handle: "maya" },
      skills_used: ["React"],
    },
    {
      profile_id: "u2",
      role: "contributor",
      profile: { display_name: "Alex", handle: "alex" },
    },
  ],
  skills: [{ name: "TypeScript" }, { name: "React" }],
  milestones: [{ id: "m1", title: "MVP", status: "completed" }],
  needs: [{ id: "n1", title: "Designer" }],
};

describe("ProjectGraphExplorer", () => {
  it("renders null when there are no connected nodes", () => {
    const { container } = render(
      <ProjectGraphExplorer input={{ project: { id: "p1", title: "Solo" } }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows a toggle button with connection count when collapsed", () => {
    render(<ProjectGraphExplorer input={baseInput} />);
    expect(screen.getByText(/Show \d+ connections/)).toBeDefined();
  });

  it("expands to show grouped nodes and depth control", () => {
    render(<ProjectGraphExplorer input={baseInput} />);
    fireEvent.click(screen.getByText(/Show \d+ connections/));

    // Group headings (h3) appear for each present type
    const headings = screen.getAllByRole("heading", { level: 3 });
    const headingTexts = headings.map((h) => h.textContent);
    expect(headingTexts).toContain("People");
    expect(headingTexts).toContain("Skills");
    expect(headingTexts).toContain("Milestones");
    expect(headingTexts).toContain("Needs");
    expect(screen.getByText("Direct connections")).toBeDefined();
  });

  it("renders node type filter toggles when expanded", () => {
    render(<ProjectGraphExplorer input={baseInput} />);
    fireEvent.click(screen.getByText(/Show \d+ connections/));

    // Filter buttons exist for each present type
    const peopleFilter = screen.getByRole("button", { name: "People" });
    expect(peopleFilter.getAttribute("aria-pressed")).toBe("true");
  });

  it("hides nodes of a type when its filter is toggled off", () => {
    render(<ProjectGraphExplorer input={baseInput} />);
    fireEvent.click(screen.getByText(/Show \d+ connections/));

    // Toggle off People
    fireEvent.click(screen.getByRole("button", { name: "People" }));

    // Maya and Alex should no longer appear in the grouped list
    const groups = screen.getAllByText("People");
    // The filter button still says "People" but the group heading should be gone
    const headings = screen.queryAllByRole("heading", { level: 3 });
    expect(headings.some((h) => h.textContent === "People")).toBe(false);
  });

  it("shows empty state message when all types are hidden", () => {
    render(<ProjectGraphExplorer input={baseInput} />);
    fireEvent.click(screen.getByText(/Show \d+ connections/));

    // Toggle off all present types
    const presentTypes = ["People", "Skills", "Milestones", "Needs"];
    for (const type of presentTypes) {
      fireEvent.click(screen.getByRole("button", { name: type }));
    }

    expect(screen.getByText(/All node types are hidden/)).toBeDefined();
  });

  it("does not show filters when only one type is present", () => {
    render(
      <ProjectGraphExplorer
        input={{
          project: { id: "p1", title: "Test" },
          skills: [{ name: "React" }],
        }}
      />,
    );
    fireEvent.click(screen.getByText(/Show \d+ connections/));

    // Only Skills type present — no filter group
    expect(screen.queryByRole("group", { name: "Filter by node type" })).toBeNull();
  });
});
