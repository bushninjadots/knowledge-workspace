import { describe, expect, it } from "vitest";
import { buildProfileGraph, getProfileCollaborators, profileGraphSummary } from "./profile-graph";

describe("buildProfileGraph", () => {
  it("connects a person to work, skills, collaborators, and contributions", () => {
    const graph = buildProfileGraph({
      profile: { id: "ari", displayName: "Ari", handle: "ari" },
      projects: [{ id: "atlas", title: "Atlas", role: "creator" }],
      skills: [{ name: "React" }],
      collaborators: [{ profile_id: "sam", display_name: "Sam", sharedProjectCount: 2 }],
      contributions: [{ id: "c1", label: "Navigation", projectId: "atlas" }],
    });

    expect(graph.nodes.map((node) => node.id)).toEqual([
      "person:ari", "project:atlas", "skill:react", "person:sam", "contribution:c1",
    ]);
    expect(graph.edges.map((edge) => edge.type)).toEqual([
      "produced", "has_skill", "collaborated_with", "produced", "contributed_to",
    ]);
    expect(graph.edges.find((edge) => edge.type === "collaborated_with")?.metadata?.sharedProjectCount).toBe(2);
  });

  it("drops contribution links to projects that are not in the visible graph", () => {
    const summary = profileGraphSummary({
      profile: { id: "ari" },
      contributions: [{ id: "c1", label: "Hidden project work", projectId: "private" }],
    });
    expect(summary.graph.nodes).toHaveLength(2);
    expect(summary.graph.edges).toHaveLength(1);
    expect(summary.hasWork).toBe(true);
  });

  it("returns only collaborator people from relationship edges", () => {
    const graph = buildProfileGraph({
      profile: { id: "ari" },
      collaborators: [{ profile_id: "sam", handle: "sam" }],
      projects: [{ id: "atlas", title: "Atlas" }],
    });
    expect(getProfileCollaborators(graph).map((node) => node.id)).toEqual(["person:sam"]);
  });
});
