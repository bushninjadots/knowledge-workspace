import {
  createGraphEdge,
  createGraphNode,
  normalizeGraph,
  type GraphEdge,
  type GraphNode,
  type TethyrGraph,
} from "./graph-model";

export type ProjectGraphProject = {
  id: string;
  title: string;
  description?: string | null;
  visibility?: "public" | "private";
  profile_id?: string | null;
  status?: string | null;
  stage?: string | null;
};

export type ProjectGraphContributor = {
  profile_id: string;
  role?: string | null;
  profile?: { display_name?: string | null; handle?: string | null } | null;
  skills_used?: string[] | null;
};

export type ProjectGraphSkill = { id?: string; name: string };
export type ProjectGraphMilestone = {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
};
export type ProjectGraphRole = {
  id: string;
  title: string;
  is_filled?: boolean;
  filled_by?: string | null;
};
export type ProjectGraphRepository = { id: string; name: string; url?: string | null };
export type ProjectGraphDiscussion = { id: string; title: string };
export type ProjectGraphNeed = { id: string; title: string };

export type ProjectGraphInput = {
  project: ProjectGraphProject;
  contributors?: ProjectGraphContributor[];
  skills?: ProjectGraphSkill[];
  milestones?: ProjectGraphMilestone[];
  roles?: ProjectGraphRole[];
  repositories?: ProjectGraphRepository[];
  discussions?: ProjectGraphDiscussion[];
  needs?: ProjectGraphNeed[];
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

  addNode(nodes, createGraphNode({
    id: projectId,
    type: "project",
    label: input.project.title,
    description: input.project.description ?? undefined,
    visibility: input.project.visibility,
    metadata: { status: input.project.status, stage: input.project.stage },
  }));

  for (const contributor of input.contributors ?? []) {
    const personId = `person:${contributor.profile_id}`;
    addNode(nodes, createGraphNode({ id: personId, type: "person", label: personLabel(contributor) }));
    addEdge(edges, createGraphEdge({
      type: contributor.role === "creator" ? "produced" : "contributed_to",
      from: personId,
      to: projectId,
      metadata: { role: contributor.role },
    }));

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
    addNode(nodes, createGraphNode({
      id: milestoneId,
      type: "milestone",
      label: milestone.title,
      description: milestone.description ?? undefined,
      metadata: { status: milestone.status },
    }));
    addEdge(edges, createGraphEdge({ type: "has_milestone", from: projectId, to: milestoneId }));
  }

  for (const role of input.roles ?? []) {
    const roleId = `role:${role.id}`;
    addNode(nodes, createGraphNode({ id: roleId, type: "role", label: role.title, metadata: { isFilled: role.is_filled } }));
    addEdge(edges, createGraphEdge({ type: "has_role", from: projectId, to: roleId }));
    if (role.filled_by) addEdge(edges, createGraphEdge({ type: "filled_role", from: `person:${role.filled_by}`, to: roleId }));
  }

  for (const repository of input.repositories ?? []) {
    const repositoryId = `repository:${repository.id}`;
    addNode(nodes, createGraphNode({ id: repositoryId, type: "repository", label: repository.name, metadata: { url: repository.url } }));
    addEdge(edges, createGraphEdge({ type: "imported_from", from: projectId, to: repositoryId, metadata: { repositoryId: repository.id } }));
  }

  for (const discussion of input.discussions ?? []) {
    const discussionId = `discussion:${discussion.id}`;
    addNode(nodes, createGraphNode({ id: discussionId, type: "discussion", label: discussion.title }));
    addEdge(edges, createGraphEdge({ type: "contains", from: projectId, to: discussionId }));
  }

  for (const need of input.needs ?? []) {
    const needId = `need:${need.id}`;
    addNode(nodes, createGraphNode({ id: needId, type: "need", label: need.title }));
    addEdge(edges, createGraphEdge({ type: "needs", from: projectId, to: needId }));
  }

  return normalizeGraph({ nodes, edges });
}
