import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionGraphSummary } from "./session-graph-summary";
import type { SessionGraphInput } from "@/lib/session-graph";

const connected: SessionGraphInput = {
  session: { id: "s-1", title: "Map reading basics" },
  organizer: { profile_id: "u-1", display_name: "Bryce" },
  participants: [
    { profile_id: "u-2", profile: { display_name: "Nia" } },
    { profile_id: "u-3", profile: { display_name: "Ari" } },
  ],
  skill: { name: "Cartography" },
};

describe("SessionGraphSummary", () => {
  it("renders connection counts and connected chips", () => {
    render(<SessionGraphSummary input={connected} />);

    expect(screen.getByRole("region", { name: "In the graph" })).toBeInTheDocument();
    // Scope to the counts list — labels also appear inside the outline below.
    const counts = within(screen.getByRole("region", { name: "In the graph" }).querySelector("dl")!);
    const valueFor = (label: string) => counts.getByText(label).nextElementSibling?.textContent;
    expect(valueFor("People")).toBe("3");
    expect(valueFor("Skills")).toBe("1");
    expect(valueFor("Relationships")).toBe("4");
    // The skill appears as a chip and again inside the outline.
    expect(screen.getAllByText("Cartography").length).toBeGreaterThanOrEqual(2);
  });

  it("exposes an accessible connections outline that describes relationships in words (spec §47–§48)", () => {
    render(<SessionGraphSummary input={connected} />);

    expect(screen.getByRole("list", { name: "Relationship tree" })).toBeInTheDocument();
    // The outline walks outward from the session, so it reads the reverse of
    // the stored edges: the organizer "was produced by" the session, and the
    // session "had participant" Nia and Ari.
    expect(screen.getAllByText("was produced by").length).toBeGreaterThan(0);
    expect(screen.getAllByText("had participant")).toHaveLength(2);
    expect(screen.getAllByText("Bryce").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nia").length).toBeGreaterThan(0);
  });

  it("renders nothing when the session has no connections beyond itself", () => {
    const { container } = render(
      <SessionGraphSummary input={{ session: { id: "s-9", title: "Solo work session" } }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
