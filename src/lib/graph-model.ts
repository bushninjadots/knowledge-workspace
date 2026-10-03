type GraphNodeType =
  | "person"
  | "project"
  | "skill"
  | "contribution"
  | "knowledge"
  | "milestone"
  | "repository"
  | "discussion"
  | "community"
  | "session"
  | "role"
  | "badge"
  | "library_item"
  | "challenge"
  | "credit"
  | "need";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
  visibility?: "public" | "private";
}

type GraphEdgeType =
  | "contributed_to"
  | "has_skill"
  | "demonstrated_skill"
  | "used_in"
  | "has_milestone"
  | "has_role"
  | "filled_role"
  | "collaborated_with"
  | "related_to"
  | "forked_from"
  | "imported_from"
  | "produced"
  | "referenced_by"
  | "supports"
  | "earned"
  | "participated_in"
  | "uses"
  | "contains"
  | "needs"
  | "offers";

export interface GraphEdge {
  id: string;
  type: GraphEdgeType;
  from: string;
  to: string;
  metadata?: {
    role?: string;
    date?: string;
    description?: string;
    milestoneId?: string;
    duration?: string;
    evidence?: string;
    repositoryId?: string;
    confirmationStatus?: "unconfirmed" | "pending" | "confirmed";
    [key: string]: unknown;
  };
  visibility?: "public" | "private";
}

export interface TethyrGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function createGraphNode(node: Omit<GraphNode, "id"> & { id?: string }): GraphNode {
  return { ...node, id: node.id ?? `${node.type}:${crypto.randomUUID()}` };
}

export function createGraphEdge(edge: Omit<GraphEdge, "id"> & { id?: string }): GraphEdge {
  return { ...edge, id: edge.id ?? `edge:${crypto.randomUUID()}` };
}

export function getConnectedNodes(
  graph: TethyrGraph,
  nodeId: string,
  options: { edgeType?: GraphEdgeType; depth?: number } = {},
): GraphNode[] {
  const maxDepth = Math.max(1, options.depth ?? 1);
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const visited = new Set([nodeId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];
  const connected: GraphNode[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= maxDepth) continue;

    for (const edge of graph.edges) {
      if (options.edgeType && edge.type !== options.edgeType) continue;
      const nextId = edge.from === current.id ? edge.to : edge.to === current.id ? edge.from : null;
      if (!nextId || visited.has(nextId)) continue;

      visited.add(nextId);
      const next = nodeMap.get(nextId);
      if (next) connected.push(next);
      queue.push({ id: nextId, depth: current.depth + 1 });
    }
  }

  return connected;
}

export function getProjectLineage(graph: TethyrGraph, startNodeId: string): GraphNode[] {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const lineage: GraphNode[] = [];
  const visited = new Set<string>();
  let currentId: string | undefined = startNodeId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const current = nodeMap.get(currentId);
    if (current) lineage.push(current);

    const parentEdge = graph.edges.find(
      (edge) => edge.from === currentId && edge.type === "forked_from",
    );
    currentId = parentEdge?.to;
  }

  return lineage.reverse();
}

export function getContributionTrail(graph: TethyrGraph, startNodeId: string): GraphNode[] {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const trail: GraphNode[] = [];
  const visited = new Set<string>();
  let currentId: string | undefined = startNodeId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const current = nodeMap.get(currentId);
    if (current) trail.push(current);

    const nextEdge = graph.edges.find(
      (edge) =>
        edge.from === currentId &&
        ["produced", "supports", "contributed_to", "has_milestone"].includes(edge.type),
    );
    currentId = nextEdge?.to;
  }

  return trail;
}

export function normalizeGraph(graph: TethyrGraph): TethyrGraph {
  const nodes = Array.from(new Map(graph.nodes.map((node) => [node.id, node])).values());
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.from(
    new Map(
      graph.edges
        .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
        .map((edge) => [edge.id, edge]),
    ).values(),
  );

  return { nodes, edges };
}
