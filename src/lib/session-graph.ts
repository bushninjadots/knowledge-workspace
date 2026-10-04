import {
  createGraphEdge,
  createGraphNode,
  normalizeGraph,
  type GraphEdge,
  type GraphNode,
  type TethyrGraph,
} from "./graph-model";

type SessionGraphSession = {
  id: string;
  title: string;
  description?: string | null;
  session_type?: string | null;
  status?: string | null;
};

type SessionGraphParticipant = {
  profile_id: string;
  role?: string | null;
  status?: string | null;
  profile?: { display_name?: string | null; handle?: string | null } | null;
};

type SessionGraphSkill = { id?: string; name: string };
type SessionGraphProject = { id: string; title: string };
type SessionGraphCommunity = { id: string; name: string };

export type SessionGraphInput = {
  session: SessionGraphSession;
  organizer?: { profile_id: string; display_name?: string | null; handle?: string | null } | null;
  participants?: SessionGraphParticipant[];
  skill?: SessionGraphSkill | null;
  project?: SessionGraphProject | null;
  community?: SessionGraphCommunity | null;
};

function personLabel(person: {
  display_name?: string | null;
  handle?: string | null;
  profile_id: string;
}) {
  return person.display_name || person.handle || person.profile_id;
}

function addNode(nodes: GraphNode[], node: GraphNode) {
  nodes.push(node);
}

function addEdge(edges: GraphEdge[], edge: GraphEdge) {
  edges.push(edge);
}

/** Builds the Phase 7 session graph from already-loaded session data.
 *
 *  Connects the session to its organizer, participants, skill, project, and
 *  community — the relationships the spec defines (§3):
 *    PERSON → PARTICIPATED_IN → SESSION
 *    SESSION → USES → SKILL
 *    PROJECT → CONTAINS → SESSION
 *    COMMUNITY → CONTAINS → SESSION
 */
export function buildSessionGraph(input: SessionGraphInput): TethyrGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const sessionId = `session:${input.session.id}`;

  addNode(
    nodes,
    createGraphNode({
      id: sessionId,
      type: "session",
      label: input.session.title,
      description: input.session.description ?? undefined,
      metadata: {
        sessionType: input.session.session_type,
        status: input.session.status,
      },
    }),
  );

  if (input.organizer) {
    const organizerId = `person:${input.organizer.profile_id}`;
    addNode(
      nodes,
      createGraphNode({
        id: organizerId,
        type: "person",
        label: personLabel(input.organizer),
        metadata: { role: "organizer" },
      }),
    );
    addEdge(
      edges,
      createGraphEdge({
        type: "produced",
        from: organizerId,
        to: sessionId,
        metadata: { role: "organizer" },
      }),
    );
  }

  for (const participant of input.participants ?? []) {
    // The organizer is already connected via "produced"; don't duplicate them
    // as a participant node with a second edge to the same session.
    if (input.organizer && participant.profile_id === input.organizer.profile_id) continue;

    const personId = `person:${participant.profile_id}`;
    addNode(
      nodes,
      createGraphNode({
        id: personId,
        type: "person",
        label: personLabel({
          display_name: participant.profile?.display_name,
          handle: participant.profile?.handle,
          profile_id: participant.profile_id,
        }),
        metadata: { role: participant.role },
      }),
    );
    addEdge(
      edges,
      createGraphEdge({
        type: "participated_in",
        from: personId,
        to: sessionId,
        metadata: {
          role: participant.role ?? undefined,
          status: participant.status ?? undefined,
        },
      }),
    );
  }

  if (input.skill) {
    const skillId = `skill:${input.skill.id ?? input.skill.name.trim().toLowerCase()}`;
    addNode(nodes, createGraphNode({ id: skillId, type: "skill", label: input.skill.name }));
    addEdge(edges, createGraphEdge({ type: "uses", from: sessionId, to: skillId }));
  }

  if (input.project) {
    const projectId = `project:${input.project.id}`;
    addNode(nodes, createGraphNode({ id: projectId, type: "project", label: input.project.title }));
    addEdge(edges, createGraphEdge({ type: "contains", from: projectId, to: sessionId }));
  }

  if (input.community) {
    const communityId = `community:${input.community.id}`;
    addNode(
      nodes,
      createGraphNode({ id: communityId, type: "community", label: input.community.name }),
    );
    addEdge(edges, createGraphEdge({ type: "contains", from: communityId, to: sessionId }));
  }

  return normalizeGraph({ nodes, edges });
}

export function getSessionGraphCounts(graph: TethyrGraph) {
  return graph.nodes.reduce<Record<string, number>>((counts, node) => {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
    return counts;
  }, {});
}

export function sessionGraphHasConnections(graph: TethyrGraph) {
  return graph.nodes.some((node) => node.type !== "session");
}
