import type { GraphEdge, GraphNode, TethyrGraph } from "./graph-model";
import { describeRelationship } from "./graph-path";

/** Phase 9 graph accessibility — a reusable relationship tree.
 *
 *  The spec (§47–§48) requires a list/tree alternative to the visual graph and
 *  accessible text for every relationship. This walks the graph outward from a
 *  root node and returns a depth-limited tree whose every edge carries a
 *  human-readable phrase, so any graph (project, profile, skill, community,
 *  library, session) can render the same accessible structure without a second
 *  implementation.
 *
 *  Large graphs are never dumped at once (§45): the walk stops at `maxNodes`
 *  and reports how many connections were left out. */
export interface GraphTreeNode {
  node: GraphNode;
  /** How this node connects to its parent, e.g. "contributed to". */
  phrase?: string;
  /** The relationship this node was reached through. */
  edgeId?: string;
  children: GraphTreeNode[];
}

interface GraphTree {
  root: GraphTreeNode;
  /** Whether the node cap stopped the walk before the graph was exhausted. */
  truncated: boolean;
  /** How many nodes the tree holds, including the root. */
  nodeCount: number;
}

interface GraphTreeOptions {
  maxDepth?: number;
  maxNodes?: number;
}

function linkFor(edge: GraphEdge, nodeId: string): { id: string; forward: boolean } | null {
  if (edge.from === nodeId) return { id: edge.to, forward: true };
  if (edge.to === nodeId) return { id: edge.from, forward: false };
  return null;
}

export function buildGraphTree(
  graph: TethyrGraph,
  rootId: string,
  options: GraphTreeOptions = {},
): GraphTree | null {
  const rootNode = graph.nodes.find((node) => node.id === rootId);
  if (!rootNode) return null;

  const maxDepth = Math.max(1, options.maxDepth ?? 2);
  const maxNodes = Math.max(1, options.maxNodes ?? 60);
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const visited = new Set<string>([rootId]);
  let nodeCount = 1;
  let truncated = false;

  const build = (nodeId: string, depth: number): GraphTreeNode => {
    const node = nodeMap.get(nodeId) ?? { id: nodeId, type: "person", label: nodeId };
    const children: GraphTreeNode[] = [];

    if (depth < maxDepth) {
      for (const edge of graph.edges) {
        const link = linkFor(edge, nodeId);
        if (!link || visited.has(link.id)) continue;
        if (nodeCount >= maxNodes) {
          truncated = true;
          break;
        }
        visited.add(link.id);
        nodeCount += 1;
        const child = build(link.id, depth + 1);
        child.phrase = describeRelationship(edge.type, link.forward);
        child.edgeId = edge.id;
        children.push(child);
      }
    }

    return { node, children };
  };

  return { root: build(rootId, 0), truncated, nodeCount };
}
