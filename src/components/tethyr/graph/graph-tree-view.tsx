import { useMemo } from "react";
import { GRAPH_NODE_TYPE_LABELS, type TethyrGraph } from "@/lib/graph-model";
import { buildGraphTree, type GraphTreeNode } from "@/lib/graph-tree";
import { GraphNodeGlyph } from "./graph-node-glyph";

/** Phase 9 graph accessibility — the list/tree alternative to the visual graph
 *  (spec §47–§48). Renders any Tethyr graph as a nested, keyboard-operable
 *  outline where every relationship carries its human-readable phrase, so the
 *  graph is understandable without reading a canvas. */
export function GraphTreeView({
  graph,
  rootId,
  maxDepth = 2,
  maxNodes = 60,
  onSelectNode,
}: {
  graph: TethyrGraph;
  rootId: string;
  maxDepth?: number;
  maxNodes?: number;
  onSelectNode?: (nodeId: string) => void;
}) {
  const tree = useMemo(
    () => buildGraphTree(graph, rootId, { maxDepth, maxNodes }),
    [graph, rootId, maxDepth, maxNodes],
  );

  if (!tree) return null;

  return (
    <div className="mt-4">
      <ul className="space-y-1 text-sm" aria-label="Relationship tree">
        <TreeItem node={tree.root} depth={0} onSelectNode={onSelectNode} />
      </ul>
      {tree.truncated ? (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          Showing {tree.nodeCount} connections. Choose a smaller depth to focus on the closest
          relationships.
        </p>
      ) : null}
    </div>
  );
}

function TreeItem({
  node,
  depth,
  onSelectNode,
}: {
  node: GraphTreeNode;
  depth: number;
  onSelectNode?: (nodeId: string) => void;
}) {
  const typeLabel = GRAPH_NODE_TYPE_LABELS[node.node.type] ?? node.node.type;
  const heading = (
    <span className="flex flex-wrap items-baseline gap-x-2">
      {node.phrase ? <span className="text-xs text-muted-foreground">{node.phrase}</span> : null}
      <GraphNodeGlyph type={node.node.type} className="shrink-0 self-center" />
      <span className="font-medium">{node.node.label}</span>
      <span className="text-xs text-muted-foreground">{typeLabel}</span>
    </span>
  );

  if (node.children.length === 0) {
    return (
      <li className="px-1 py-0.5">
        {onSelectNode ? (
          <button
            type="button"
            onClick={() => onSelectNode(node.node.id)}
            className="w-full rounded-md px-1 py-0.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Inspect ${node.node.label}`}
          >
            {heading}
          </button>
        ) : (
          heading
        )}
      </li>
    );
  }

  return (
    <li>
      <details open={depth < 1}>
        <summary
          className="cursor-pointer rounded-md px-1 py-0.5 marker:text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onSelectNode?.(node.node.id)}
        >
          {heading}
        </summary>
        <ul className="mt-1 space-y-1 border-l border-border/60 pl-4">
          {node.children.map((child) => (
            <TreeItem
              key={child.node.id}
              node={child}
              depth={depth + 1}
              onSelectNode={onSelectNode}
            />
          ))}
        </ul>
      </details>
    </li>
  );
}

export default GraphTreeView;
