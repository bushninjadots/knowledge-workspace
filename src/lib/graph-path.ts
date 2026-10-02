import type { GraphEdge, GraphNode, TethyrGraph } from "./graph-model";

/** Phase 6 graph exploration — reusable path finding. Given any two nodes in a
 *  Tethyr graph, walk the relationships between them and explain each step in
 *  human language (spec §27, §43). Lives in the shared layer so the project,
 *  profile, skill, community, and library graphs can all ask "how are these
 *  connected?" without a second implementation. */
export interface GraphPathStep {
  edge: GraphEdge;
  from: GraphNode;
  to: GraphNode;
  /** Whether the traversal followed the edge's stored direction. */
  forward: boolean;
  /** Human-readable phrase for this step, e.g. "contributed to". */
  phrase: string;
}

export interface GraphPath {
  nodes: GraphNode[];
  steps: GraphPathStep[];
}

/** Relationship phrasing keyed by direction, so a step reads naturally whether
 *  the path follows an edge or crosses it backwards. */
const EDGE_PHRASES: Record<GraphEdge["type"], { forward: string; reverse: string }> = {
  contributed_to: { forward: "contributed to", reverse: "was contributed to by" },
  has_skill: { forward: "has skill", reverse: "is a skill of" },
  demonstrated_skill: { forward: "demonstrated", reverse: "was demonstrated by" },
  used_in: { forward: "was used in", reverse: "used" },
  has_milestone: { forward: "has milestone", reverse: "is a milestone of" },
  has_role: { forward: "has role", reverse: "is a role of" },
  filled_role: { forward: "filled the role", reverse: "was filled by" },
  collaborated_with: { forward: "collaborated with", reverse: "collaborated with" },
  related_to: { forward: "is related to", reverse: "is related to" },
  forked_from: { forward: "was forked from", reverse: "was forked into" },
  imported_from: { forward: "was imported from", reverse: "is the source of" },
  produced: { forward: "produced", reverse: "was produced by" },
  referenced_by: { forward: "is referenced by", reverse: "references" },
  supports: { forward: "supports", reverse: "is supported by" },
  earned: { forward: "earned", reverse: "was earned by" },
  participated_in: { forward: "participated in", reverse: "had participant" },
  uses: { forward: "uses", reverse: "is used by" },
  contains: { forward: "contains", reverse: "is part of" },
  needs: { forward: "needs", reverse: "is needed by" },
  offers: { forward: "offers", reverse: "is offered by" },
};

function edgePhrase(type: GraphEdge["type"], forward: boolean): string {
  const phrase = EDGE_PHRASES[type];
  return forward ? phrase.forward : phrase.reverse;
}

/** A single readable sentence for a path step, e.g. "Ari contributed to Atlas". */
export function describeGraphStep(step: GraphPathStep): string {
  return `${step.from.label} ${step.phrase} ${step.to.label}`;
}

/**
 * Shortest relationship path between two nodes, treated as an undirected walk
 * so a path can cross a relationship in either direction. Returns null when the
 * two nodes are not connected within `maxDepth`.
 */
export function findGraphPath(
  graph: TethyrGraph,
  fromId: string,
  toId: string,
  options: { maxDepth?: number } = {},
): GraphPath | null {
  const maxDepth = Math.max(1, options.maxDepth ?? 6);
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const start = nodeMap.get(fromId);
  const end = nodeMap.get(toId);
  if (!start || !end) return null;
  if (fromId === toId) return { nodes: [start], steps: [] };

  const cameFrom = new Map<string, { from: string; edge: GraphEdge; forward: boolean }>();
  const visited = new Set([fromId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: fromId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= maxDepth) continue;

    for (const edge of graph.edges) {
      let nextId: string | null = null;
      let forward = true;
      if (edge.from === current.id) {
        nextId = edge.to;
        forward = true;
      } else if (edge.to === current.id) {
        nextId = edge.from;
        forward = false;
      }
      if (!nextId || visited.has(nextId)) continue;

      visited.add(nextId);
      cameFrom.set(nextId, { from: current.id, edge, forward });
      if (nextId === toId) return reconstructPath(cameFrom, fromId, toId, nodeMap);
      queue.push({ id: nextId, depth: current.depth + 1 });
    }
  }

  return null;
}

function reconstructPath(
  cameFrom: Map<string, { from: string; edge: GraphEdge; forward: boolean }>,
  fromId: string,
  toId: string,
  nodeMap: Map<string, GraphNode>,
): GraphPath {
  const steps: GraphPathStep[] = [];
  let cursor = toId;

  while (cursor !== fromId) {
    const link = cameFrom.get(cursor);
    if (!link) break;
    const from = nodeMap.get(link.from);
    const to = nodeMap.get(cursor);
    if (!from || !to) break;
    steps.push({
      edge: link.edge,
      from,
      to,
      forward: link.forward,
      phrase: edgePhrase(link.edge.type, link.forward),
    });
    cursor = link.from;
  }

  steps.reverse();
  const startNode = nodeMap.get(fromId);
  const nodes = startNode ? [startNode, ...steps.map((step) => step.to)] : [];
  return { nodes, steps };
}
