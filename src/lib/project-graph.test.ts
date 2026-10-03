import { describe, expect, it } from "vitest";
import {
  buildProjectGraph,
  projectContributionsFromActivity,
  projectHistoryFromActivity,
} from "./project-graph";

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
});

describe("project activity graph inputs", () => {
  const rows = [
    {
      id: "c1",
      kind: "contribution",
      title: "Built the map view",
      body: "Shipped it",
      actor_id: "ari",
      created_at: "2026-10-01T10:00:00Z",
      metadata: { evidence_url: "https://example.com/pr/1" },
    },
    {
      id: "w1",
      kind: "weekly_prompt",
      title: "Moved the work forward",
      body: null,
      actor_id: "sam",
      created_at: "2026-10-02T10:00:00Z",
      metadata: null,
    },
    {
      id: "u1",
      kind: "update",
      title: "Posted an update",
      body: "Notes",
      actor_id: "ari",
      created_at: "2026-10-03T10:00:00Z",
      metadata: null,
    },
    {
      id: "r1",
      kind: "repo_linked",
      title: "Linked repository",
      body: null,
      actor_id: null,
      created_at: "2026-10-04T10:00:00Z",
      metadata: null,
    },
  ];

  it("maps contribution activity to contribution nodes with author and evidence", () => {
    const contributions = projectContributionsFromActivity(rows);
    expect(contributions).toHaveLength(2);
    expect(contributions[0]).toMatchObject({
      id: "c1",
      label: "Built the map view",
      authorProfileId: "ari",
      evidence: "https://example.com/pr/1",
    });
  });

  it("maps every non-contribution event to dated history, without overlap", () => {
    const history = projectHistoryFromActivity(rows);
    expect(history.map((entry) => entry.id)).toEqual(["u1", "r1"]);
    expect(history[0]).toMatchObject({ kind: "milestone", date: "2026-10-03T10:00:00Z" });
    expect(projectContributionsFromActivity(rows).map((entry) => entry.id)).not.toContain("u1");
  });
});
