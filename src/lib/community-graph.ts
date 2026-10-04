import {
  createGraphEdge,
  createGraphNode,
  normalizeGraph,
  type GraphEdge,
  type GraphNode,
  type TethyrGraph,
} from "./graph-model";

type CommunityGraphSpace = {
  id: string;
  name: string;
  description?: string | null;
};

type CommunityGraphMember = {
  user_id: string;
  role?: string | null;
  profile?: { display_name?: string | null; handle?: string | null } | null;
};

type CommunityGraphDiscussion = {
  id: string;
  title: string;
  author_id?: string | null;
};

type CommunityGraphProject = {
  id: string;
  title: string;
};

export type CommunityGraphInput = {
  space: CommunityGraphSpace;
  members?: CommunityGraphMember[];
  discussions?: CommunityGraphDiscussion[];
  projects?: CommunityGraphProject[];
};

function memberLabel(member: CommunityGraphMember) {
  return member.profile?.display_name || member.profile?.handle || member.user_id;
}

function addNode(nodes: GraphNode[], node: GraphNode) {
  nodes.push(node);
}

function addEdge(edges: GraphEdge[], edge: GraphEdge) {
  edges.push(edge);
}

/** Builds the Phase 7 community graph from already-loaded space data. */
export function buildCommunityGraph(input: CommunityGraphInput): TethyrGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const spaceId = `community:${input.space.id}`;
  /** Person nodes already in the graph, and the best label each has. A member
   *  enters once, named; a discussion author who is not a member still gets a
   *  person node so their "produced" edge survives normalization — honestly
   *  labeled with the id we actually have, never an invented name. */
  const personIds = new Set<string>();
  const personLabelById = new Map<string, string>();

  addNode(
    nodes,
    createGraphNode({
      id: spaceId,
      type: "community",
      label: input.space.name,
      description: input.space.description ?? undefined,
    }),
  );

  for (const member of input.members ?? []) {
    const personId = `person:${member.user_id}`;
    personIds.add(personId);
    personLabelById.set(personId, memberLabel(member));
    addNode(
      nodes,
      createGraphNode({
        id: personId,
        type: "person",
        label: memberLabel(member),
        metadata: { role: member.role },
      }),
    );
    addEdge(
      edges,
      createGraphEdge({
        type: "participated_in",
        from: personId,
        to: spaceId,
        metadata: { role: member.role ?? undefined },
      }),
    );
  }

  for (const discussion of input.discussions ?? []) {
    const discussionId = `discussion:${discussion.id}`;
    addNode(
      nodes,
      createGraphNode({ id: discussionId, type: "discussion", label: discussion.title }),
    );
    addEdge(edges, createGraphEdge({ type: "contains", from: spaceId, to: discussionId }));
    if (discussion.author_id) {
      const authorId = `person:${discussion.author_id}`;
      if (!personIds.has(authorId)) {
        personIds.add(authorId);
        addNode(
          nodes,
          createGraphNode({
            id: authorId,
            type: "person",
            label: personLabelById.get(authorId) ?? discussion.author_id,
          }),
        );
      }
      addEdge(
        edges,
        createGraphEdge({
          type: "produced",
          from: authorId,
          to: discussionId,
        }),
      );
    }
  }

  for (const project of input.projects ?? []) {
    const projectId = `project:${project.id}`;
    addNode(nodes, createGraphNode({ id: projectId, type: "project", label: project.title }));
    addEdge(edges, createGraphEdge({ type: "contains", from: spaceId, to: projectId }));
  }

  return normalizeGraph({ nodes, edges });
}

export function getCommunityGraphCounts(graph: TethyrGraph) {
  return graph.nodes.reduce<Record<string, number>>((counts, node) => {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
    return counts;
  }, {});
}

export function communityGraphHasConnections(graph: TethyrGraph) {
  return graph.nodes.some((node) => node.type !== "community");
}
