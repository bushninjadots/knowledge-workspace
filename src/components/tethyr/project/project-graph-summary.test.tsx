import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectGraphSummary, isMeaningfulProjectGraph } from "./project-graph-summary";
import type { ProjectGraphInput } from "@/lib/project-graph";

vi.mock("@tanstack/react-router", async () => {
  const { reactRouterMock } = await import("@/test-utils/route-page");
  return reactRouterMock();
});

const rich: ProjectGraphInput = {
  project: { id: "atlas", title: "Atlas" },
  contributors: [{ profile_id: "ari", role: "creator", profile: { display_name: "Ari" } }],
  skills: [{ name: "TypeScript" }],
  milestones: [{ id: "launch", title: "Launch" }],
};

const sparse: ProjectGraphInput = { project: { id: "solo", title: "Solo" } };

describe("ProjectGraphSummary (the Tether)", () => {
  it("draws the project as the pole with a ball per connection", () => {
    render(<ProjectGraphSummary input={rich} />);
    expect(screen.getByRole("region", { name: "How it connects" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Atlas: \d+ connections/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "People: Ari" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skills: TypeScript" })).toBeInTheDocument();
    expect(screen.getByText(/Level \d · /)).toBeInTheDocument();
  });

  it("offers a list view for screen readers and small screens", async () => {
    render(<ProjectGraphSummary input={rich} />);
    screen.getByRole("button", { name: "List view" }).click();
    expect(await screen.findByRole("region", { name: "People" })).toHaveTextContent("Ari");
  });

  it("renders nothing for a project with no relationships", () => {
    const { container } = render(<ProjectGraphSummary input={sparse} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("isMeaningfulProjectGraph matches the render guard", () => {
    expect(isMeaningfulProjectGraph(rich)).toBe(true);
    expect(isMeaningfulProjectGraph(sparse)).toBe(false);
  });
});
