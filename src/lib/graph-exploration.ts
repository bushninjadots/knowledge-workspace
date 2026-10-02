import type { GraphNode } from "./graph-model";

/** Phase 6 graph exploration — a reusable filter over any node list, so search
 *  and type filtering work the same on project, profile, skill, community, and
 *  library graphs without a second implementation. */
export interface GraphNodeFilter {
  /** Free-text match against a node's label and description. */
  query?: string;
  /** Node types to keep. An empty or omitted list keeps every type. */
  types?: GraphNode["type"][];
}

export function graphNodeMatches(node: GraphNode, filter: GraphNodeFilter): boolean {
  const query = filter.query?.trim().toLowerCase() ?? "";
  if (query) {
    const haystack = `${node.label} ${node.description ?? ""}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (filter.types && filter.types.length > 0 && !filter.types.includes(node.type)) return false;
  return true;
}

export function filterGraphNodes(nodes: GraphNode[], filter: GraphNodeFilter): GraphNode[] {
  return nodes.filter((node) => graphNodeMatches(node, filter));
}

/** The node types present in a list, with counts, for filter facets. */
export function graphTypeFacets(
  nodes: GraphNode[],
): Array<{ type: GraphNode["type"]; count: number }> {
  const counts = new Map<GraphNode["type"], number>();
  for (const node of nodes) counts.set(node.type, (counts.get(node.type) ?? 0) + 1);

  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}
