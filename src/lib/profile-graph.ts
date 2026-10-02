import {
  createGraphEdge,
  createGraphNode,
  normalizeGraph,
  type GraphEdge,
  type GraphNode,
  type TethyrGraph,
} from "./graph-model";

export type ProfileGraphProject = {
  id: string;
  title: string;
  role?: string | null;
  description?: string | null;
  status?: string | null;
};
export type ProfileGraphSkill = { id?: string; name: string };
export type ProfileGraphCollaborator = {
  profile_id: string;
  display_name?: string | null;
  handle?: string | null;
  sharedProjectCount?: number;
};
export type ProfileGraphContribution = {
  id: string;
  label: string;
  projectId?: string;
  description?: string | null;
};
export type ProfileGraphInput = {
  profile: { id: string; displayName?: string | null; handle?: string | null };
  projects?: ProfileGraphProject[];
  skills?: ProfileGraphSkill[];
  collaborators?: ProfileGraphCollaborator[];
  contributions?: ProfileGraphContribution[];
};

function addNode(nodes: GraphNode[], node: GraphNode) {
  nodes.push(node);
}
function addEdge(edges: GraphEdge[], edge: GraphEdge) {
  edges.push(edge);
}

/** Builds the Phase 3 profile graph from already-loaded public profile evidence. */
export function buildProfileGraph(input: ProfileGraphInput): TethyrGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const personId = `person:${input.profile.id}`;
  const personLabel = input.profile.displayName || input.profile.handle || input.profile.id;
  addNode(
    nodes,
    createGraphNode({
      id: personId,
      type: "person",
      label: personLabel,
      metadata: { handle: input.profile.handle },
    }),
  );

  for (const project of input.projects ?? []) {
    const projectId = `project:${project.id}`;
    addNode(
      nodes,
      createGraphNode({
        id: projectId,
        type: "project",
        label: project.title,
        description: project.description ?? undefined,
        metadata: { status: project.status, role: project.role },
      }),
    );
    addEdge(
      edges,
      createGraphEdge({
        type: project.role === "creator" ? "produced" : "contributed_to",
        from: personId,
        to: projectId,
        metadata: { role: project.role ?? undefined },
      }),
    );
  }

  for (const skill of input.skills ?? []) {
    const skillId = `skill:${skill.id ?? skill.name.trim().toLowerCase()}`;
    addNode(nodes, createGraphNode({ id: skillId, type: "skill", label: skill.name }));
    addEdge(edges, createGraphEdge({ type: "has_skill", from: personId, to: skillId }));
  }

  for (const collaborator of input.collaborators ?? []) {
    const collaboratorId = `person:${collaborator.profile_id}`;
    addNode(
      nodes,
      createGraphNode({
        id: collaboratorId,
        type: "person",
        label: collaborator.display_name || collaborator.handle || collaborator.profile_id,
        metadata: { handle: collaborator.handle },
      }),
    );
    addEdge(
      edges,
      createGraphEdge({
        type: "collaborated_with",
        from: personId,
        to: collaboratorId,
        metadata: { sharedProjectCount: collaborator.sharedProjectCount ?? 1 },
      }),
    );
  }

  for (const contribution of input.contributions ?? []) {
    const contributionId = `contribution:${contribution.id}`;
    addNode(
      nodes,
      createGraphNode({
        id: contributionId,
        type: "contribution",
        label: contribution.label,
        description: contribution.description ?? undefined,
      }),
    );
    addEdge(edges, createGraphEdge({ type: "produced", from: personId, to: contributionId }));
    if (contribution.projectId) {
      addEdge(
        edges,
        createGraphEdge({ type: "contributed_to", from: contributionId, to: `project:${contribution.projectId}` }),
      );
    }
  }

  return normalizeGraph({ nodes, edges });
}

export function getProfileGraphCounts(graph: TethyrGraph) {
  return graph.nodes.reduce<Record<string, number>>((counts, node) => {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
    return counts;
  }, {});
}

export function getProfileProjectNodes(graph: TethyrGraph) {
  return graph.nodes.filter((node) => node.type === "project");
}

export function getProfileCollaborators(graph: TethyrGraph) {
  return graph.edges
    .filter((edge) => edge.type === "collaborated_with")
    .map((edge) => graph.nodes.find((node) => node.id === edge.to))
    .filter((node): node is GraphNode => Boolean(node));
}

export function profileGraphHasWork(graph: TethyrGraph) {
  return graph.nodes.some((node) => node.type !== "person");
}

export function profileGraphSummary(input: ProfileGraphInput) {
  const graph = buildProfileGraph(input);
  return { graph, counts: getProfileGraphCounts(graph), hasWork: profileGraphHasWork(graph) };
}

export type ProfileGraph = TethyrGraph;
export type { TethyrGraph };
