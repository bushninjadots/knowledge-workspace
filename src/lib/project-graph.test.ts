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

  it("represents chronological project history as typed nodes with dated edges", () => {
    const graph = buildProjectGraph({
      project: { id: "atlas", title: "Atlas" },
      history: [
        { id: "idea", label: "Initial idea", date: "2026-09-01" },
        { id: "prototype", label: "Prototype built", kind: "contribution", date: "2026-09-12" },
      ],
    });

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "milestone:idea", type: "milestone" }),
        expect.objectContaining({ id: "contribution:prototype", type: "contribution" }),
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "has_milestone",
          from: "project:atlas",
          to: "milestone:idea",
          metadata: { date: "2026-09-01" },
        }),
        expect.objectContaining({
          type: "produced",
          from: "project:atlas",
          to: "contribution:prototype",
          metadata: { date: "2026-09-12" },
        }),
      ]),
    );
  });

  it("connects an imported repository's technologies as skills (spec §7)", () => {
    const graph = buildProjectGraph({
      project: { id: "atlas", title: "Atlas" },
      repositories: [
        {
          id: "repo",
          name: "ari/atlas",
          provider: "github",
          fullName: "ari/atlas",
          language: "TypeScript",
          topics: ["graph", "TypeScript"],
        },
      ],
    });

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "skill:typescript", type: "skill", label: "TypeScript" }),
        expect.objectContaining({ id: "skill:graph", type: "skill", label: "graph" }),
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "uses", from: "repository:repo", to: "skill:typescript" }),
        expect.objectContaining({ type: "uses", from: "repository:repo", to: "skill:graph" }),
      ]),
    );
    // A language repeated as a topic is one skill with one edge, not two.
    expect(
      graph.edges.filter((edge) => edge.type === "uses" && edge.to === "skill:typescript"),
    ).toHaveLength(1);
  });

  it("connects imported commits to their repository and named author (spec §7)", () => {
    const graph = buildProjectGraph({
      project: { id: "atlas", title: "Atlas" },
      repositories: [{ id: "repo", name: "ari/atlas", provider: "github", fullName: "ari/atlas" }],
      importedCommits: [
        {
          id: "sha-1",
          label: "Add the map view",
          authorLogin: "octo-dev",
          date: "2026-10-01T10:00:00Z",
          url: "https://github.com/ari/atlas/commit/sha-1",
          repository: "ari/atlas",
        },
      ],
    });

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "contribution:sha-1", type: "contribution" }),
        expect.objectContaining({ id: "person:github:octo-dev", type: "person" }),
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "contributed_to",
          from: "contribution:sha-1",
          to: "repository:repo",
        }),
        expect.objectContaining({
          type: "produced",
          from: "person:github:octo-dev",
          to: "contribution:sha-1",
        }),
        expect.objectContaining({
          type: "contributed_to",
          from: "person:github:octo-dev",
          to: "repository:repo",
        }),
      ]),
    );
  });

  it("falls back to the project when a commit names no repository, and invents no author", () => {
    const graph = buildProjectGraph({
      project: { id: "atlas", title: "Atlas" },
      repositories: [{ id: "repo", name: "ari/atlas", provider: "github" }],
      importedCommits: [{ id: "sha-2", label: "Tidy the README" }],
    });

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "contributed_to",
          from: "contribution:sha-2",
          to: "project:atlas",
        }),
      ]),
    );
    expect(graph.nodes.filter((node) => node.type === "person")).toHaveLength(0);
  });
});
