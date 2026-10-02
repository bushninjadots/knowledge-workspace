import {
  createGraphEdge,
  createGraphNode,
  normalizeGraph,
  type GraphEdge,
  type GraphNode,
  type TethyrGraph,
} from "./graph-model";

type ProjectGraphProject = {
  id: string;
  title: string;
  description?: string | null;
  visibility?: "public" | "private";
  profile_id?: string | null;
  status?: string | null;
  stage?: string | null;
};

type ProjectGraphContributor = {
  profile_id: string;
  role?: string | null;
  profile?: { display_name?: string | null; handle?: string | null } | null;
  skills_used?: string[] | null;
};

type ProjectGraphSkill = { id?: string; name: string };
type ProjectGraphMilestone = {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
};
type ProjectGraphRole = {
  id: string;
  title: string;
  is_filled?: boolean;
  filled_by?: string | null;
};
type ProjectGraphRepository = {
  id: string;
  name: string;
  url?: string | null;
  provider?: string | null;
  importedAt?: string | null;
};
type ProjectGraphDiscussion = { id: string; title: string };
type ProjectGraphNeed = { id: string; title: string };
/** The project this one was forked from, resolved to just its identity. */
type ProjectGraphLineage = { id: string; title: string };

export type ProjectGraphInput = {
  project: ProjectGraphProject;
  contributors?: ProjectGraphContributor[];
  skills?: ProjectGraphSkill[];
  milestones?: ProjectGraphMilestone[];
  roles?: ProjectGraphRole[];
  repositories?: ProjectGraphRepository[];
  discussions?: ProjectGraphDiscussion[];
  needs?: ProjectGraphNeed[];
  forkedFrom?: ProjectGraphLineage | null;
};

function personLabel(contributor: ProjectGraphContributor) {
  return contributor.profile?.display_name || contributor.profile?.handle || contributor.profile_id;
}

function addNode(nodes: GraphNode[], node: GraphNode) {
  nodes.push(node);
  return node.id;
}

function addEdge(edges: GraphEdge[], edge: GraphEdge) {
  edges.push(edge);
}

/** Builds the Phase 2 project graph from already-loaded project workspace data. */
export function buildProjectGraph(input: ProjectGraphInput): TethyrGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const projectId = `project:${input.project.id}`;

  addNode(
    nodes,
    createGraphNode({
      id: projectId,
      type: "project",
      label: input.project.title,
      description: input.project.description ?? undefined,
      visibility: input.project.visibility ?? undefined,
      metadata: { status: input.project.status, stage: input.project.stage },
    }),
  );

  for (const contributor of input.contributors ?? []) {
    const personId = `person:${contributor.profile_id}`;
    addNode(
      nodes,
      createGraphNode({ id: personId, type: "person", label: personLabel(contributor) }),
    );
    addEdge(
      edges,
      createGraphEdge({
        type: contributor.role === "creator" ? "produced" : "contributed_to",
        from: personId,
        to: projectId,
        metadata: { role: contributor.role ?? undefined },
      }),
    );

    for (const skillName of contributor.skills_used ?? []) {
      const skillId = `skill:${skillName.trim().toLowerCase()}`;
      addNode(nodes, createGraphNode({ id: skillId, type: "skill", label: skillName.trim() }));
      addEdge(edges, createGraphEdge({ type: "demonstrated_skill", from: personId, to: skillId }));
      addEdge(edges, createGraphEdge({ type: "used_in", from: skillId, to: projectId }));
    }
  }

  for (const skill of input.skills ?? []) {
    const skillId = `skill:${skill.id ?? skill.name.trim().toLowerCase()}`;
    addNode(nodes, createGraphNode({ id: skillId, type: "skill", label: skill.name }));
    addEdge(edges, createGraphEdge({ type: "used_in", from: skillId, to: projectId }));
  }

  for (const milestone of input.milestones ?? []) {
    const milestoneId = `milestone:${milestone.id}`;
    addNode(
      nodes,
      createGraphNode({
        id: milestoneId,
        type: "milestone",
        label: milestone.title,
        description: milestone.description ?? undefined,
        metadata: { status: milestone.status },
      }),
    );
    addEdge(edges, createGraphEdge({ type: "has_milestone", from: projectId, to: milestoneId }));
  }

  for (const role of input.roles ?? []) {
    const roleId = `role:${role.id}`;
    addNode(
      nodes,
      createGraphNode({
        id: roleId,
        type: "role",
        label: role.title,
        metadata: { isFilled: role.is_filled },
      }),
    );
    addEdge(edges, createGraphEdge({ type: "has_role", from: projectId, to: roleId }));
    if (role.filled_by)
      addEdge(
        edges,
        createGraphEdge({ type: "filled_role", from: `person:${role.filled_by}`, to: roleId }),
      );
  }

  for (const repository of input.repositories ?? []) {
    const repositoryId = `repository:${repository.id}`;
    addNode(
      nodes,
      createGraphNode({
        id: repositoryId,
        type: "repository",
        label: repository.name,
        metadata: {
          url: repository.url,
          provider: repository.provider,
          importedAt: repository.importedAt,
        },
      }),
    );
    addEdge(
      edges,
      createGraphEdge({
        type: "imported_from",
        from: projectId,
        to: repositoryId,
        metadata: {
          repositoryId: repository.id,
          provider: repository.provider,
          date: repository.importedAt ?? undefined,
        },
      }),
    );
  }

  for (const discussion of input.discussions ?? []) {
    const discussionId = `discussion:${discussion.id}`;
    addNode(
      nodes,
      createGraphNode({ id: discussionId, type: "discussion", label: discussion.title }),
    );
    addEdge(edges, createGraphEdge({ type: "contains", from: projectId, to: discussionId }));
  }

  for (const need of input.needs ?? []) {
    const needId = `need:${need.id}`;
    addNode(nodes, createGraphNode({ id: needId, type: "need", label: need.title }));
    addEdge(edges, createGraphEdge({ type: "needs", from: projectId, to: needId }));
  }

  // Fork lineage (spec §6) — a forked_from edge to a parent project node, so
  // lineage is a real relationship in the model rather than a header-only note.
  if (input.forkedFrom) {
    const parentId = `project:${input.forkedFrom.id}`;
    addNode(
      nodes,
      createGraphNode({
        id: parentId,
        type: "project",
        label: input.forkedFrom.title,
      }),
    );
    addEdge(edges, createGraphEdge({ type: "forked_from", from: projectId, to: parentId }));
  }

  return normalizeGraph({ nodes, edges });
}
