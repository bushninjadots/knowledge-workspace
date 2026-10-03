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
      contributions: [
        {
          id: "commit-1",
          label: "Build the map view",
          authorProfileId: "ari",
          date: "2026-10-03T12:00:00Z",
          evidence: "https://github.com/example/atlas/commit/commit-1",
        },
      ],
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
        "contribution:commit-1",
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
        expect.objectContaining({
          type: "produced",
          from: "contribution:commit-1",
          to: "project:atlas",
        }),
        expect.objectContaining({
          type: "produced",
          from: "person:ari",
          to: "contribution:commit-1",
        }),
      ]),
    );
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
