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

    expect(screen.getByRole("region", { name: "How it connects" })).toBeInTheDocument();
    // The counts row (a <dt>), not the group label of the same name.
    const valueFor = (label: string) =>
      screen.getAllByText(label).find((el) => el.tagName === "DT")?.nextElementSibling?.textContent;
    expect(valueFor("People")).toBe("1");
    expect(valueFor("Skills")).toBe("1");
    expect(valueFor("Milestones")).toBe("1");
    // Graph-internal counts and raw type words ("person Ari") are not shown;
    // each node carries its kind as an icon plus a screen-reader label.
    expect(screen.queryByText("Relationships")).toBeNull();
    const nodes = screen.getByRole("list", { name: "Connected nodes" });
    // Milestones are counted, not repeated as chips.
    expect(nodes).not.toHaveTextContent("Launch");
    expect(nodes).toHaveTextContent("People: Ari");
    expect(nodes).toHaveTextContent("Skills: TypeScript");
    expect(nodes).not.toHaveTextContent("person Ari");
  });

  it("folds a long group behind +N more", async () => {
    const many: ProjectGraphInput = {
      ...rich,
      skills: Array.from({ length: 10 }, (_, i) => ({ name: `Skill ${i}` })),
    };
    render(<ProjectGraphSummary input={many} />);
    expect(screen.queryByText("Skill 9")).toBeNull();
    screen.getByRole("button", { name: "+4 more" }).click();
    expect(await screen.findByText("Skill 9")).toBeInTheDocument();
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
