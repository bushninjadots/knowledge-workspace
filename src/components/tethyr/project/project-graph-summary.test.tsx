import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectGraphSummary, isMeaningfulProjectGraph } from "./project-graph-summary";
import type { ProjectGraphInput } from "@/lib/project-graph";

const rich: ProjectGraphInput = {
  project: { id: "atlas", title: "Atlas" },
  contributors: [{ profile_id: "ari", role: "creator", profile: { display_name: "Ari" } }],
  skills: [{ name: "TypeScript" }],
  milestones: [{ id: "launch", title: "Launch" }],
};

const sparse: ProjectGraphInput = {
  project: { id: "solo", title: "Solo" },
};

describe("ProjectGraphSummary", () => {
  it("renders people, skill, milestone, and relationship counts", () => {
    render(<ProjectGraphSummary input={rich} />);

    expect(screen.getByRole("region", { name: "Connected work" })).toBeInTheDocument();
    const valueFor = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
    expect(valueFor("People")).toBe("1");
    expect(valueFor("Skills")).toBe("1");
    expect(valueFor("Milestones")).toBe("1");
    // Graph-internal counts and raw type words ("person Ari") are not shown;
    // each node carries its kind as an icon plus a screen-reader label.
    expect(screen.queryByText("Relationships")).toBeNull();
    const nodes = screen.getByRole("list", { name: "Connected nodes" });
    expect(nodes).toHaveTextContent("People: Ari");
    expect(nodes).toHaveTextContent("Skills: TypeScript");
    expect(nodes).not.toHaveTextContent("person Ari");
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
