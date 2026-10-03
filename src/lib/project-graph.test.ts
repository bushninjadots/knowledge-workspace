import { describe, expect, it } from "vitest";
import { buildProjectGraph } from "./project-graph";

describe("buildProjectGraph", () => {
  it("projects workspace data into meaningful typed relationships", () => {
    const graph = buildProjectGraph({
      project: {
        id: "atlas",
        title: "Atlas",
        description: "A map",
        status: "active",
        stage: "building",
      },
      contributors: [
        {
          profile_id: "ari",
          role: "creator",
          profile: { display_name: "Ari" },
          skills_used: ["React"],
        },
        {
          profile_id: "sam",
          role: "contributor",
          profile: { handle: "sam" },
          skills_used: ["React"],
        },
      ],
      skills: [{ name: "TypeScript" }],
      milestones: [{ id: "launch", title: "Launch", status: "in_progress" }],
      roles: [{ id: "design", title: "Designer", is_filled: false }],
      repositories: [{ id: "repo", name: "atlas-web", url: "https://example.com" }],
      discussions: [{ id: "d1", title: "Feedback" }],
      needs: [{ id: "n1", title: "Research support" }],
    });

    expect(graph.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        "project:atlas",
        "person:ari",
        "person:sam",
        "skill:react",
        "skill:typescript",
        "milestone:launch",
        "role:design",
        "repository:repo",
        "discussion:d1",
        "need:n1",
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "produced", from: "person:ari", to: "project:atlas" }),
        expect.objectContaining({
          type: "contributed_to",
          from: "person:sam",
          to: "project:atlas",
        }),
        expect.objectContaining({
          type: "has_milestone",
          from: "project:atlas",
          to: "milestone:launch",
        }),
        expect.objectContaining({
          type: "imported_from",
          from: "project:atlas",
          to: "repository:repo",
        }),
      ]),
    );
  });

  it("removes duplicate nodes and dangling filled-role edges", () => {
    const graph = buildProjectGraph({
      project: { id: "atlas", title: "Atlas" },
      roles: [{ id: "role", title: "Engineer", filled_by: "missing" }],
    });
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
  });

  it("adds fork lineage as a forked_from edge to a parent project node", () => {
    const graph = buildProjectGraph({
      project: { id: "atlas-jr", title: "Atlas Jr" },
      forkedFrom: { id: "atlas", title: "Atlas" },
    });
    expect(graph.nodes.map((node) => node.id)).toContain("project:atlas");
    expect(graph.edges).toEqual([
      expect.objectContaining({
        type: "forked_from",
        from: "project:atlas-jr",
        to: "project:atlas",
      }),
    ]);
  });

  it("preserves related and derived project lineage in the graph", () => {
    const graph = buildProjectGraph({
      project: { id: "atlas", title: "Atlas" },
      relatedProjects: [
        { id: "atlas-labs", title: "Atlas Labs", relationship: "derived_from" },
        { id: "atlas-notes", title: "Atlas Notes", relationship: "related_to" },
      ],
    });

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "derived_from",
          from: "project:atlas",
          to: "project:atlas-labs",
        }),
        expect.objectContaining({
          type: "related_to",
          from: "project:atlas",
          to: "project:atlas-notes",
        }),
      ]),
    );
  });
});
