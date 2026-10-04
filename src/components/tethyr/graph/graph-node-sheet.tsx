import { useMemo } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { GRAPH_NODE_TYPE_LABELS, type GraphNode, type TethyrGraph } from "@/lib/graph-model";
import { describeRelationship } from "@/lib/graph-path";

/** Phase 9 graph mobile (spec §46, §42) — the node inspector.
 *
 *  Selecting a node opens a bottom sheet with its information, its
 *  relationships spelled out, and an action. The related nodes are themselves
 *  buttons, so a phone user can move through the graph by tapping instead of
 *  aiming at a canvas. Shared by every graph surface that renders a selectable
 *  node, not just the project explorer. */
interface NodeConnection {
  node: GraphNode;
  /** How the related node connects to the selected one, e.g. "was produced by". */
  phrase: string;
}

export function GraphNodeSheet({
  graph,
  node,
  open,
  onOpenChange,
  onSelectNode,
  onTrace,
}: {
  graph: TethyrGraph;
  node: GraphNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectNode: (nodeId: string) => void;
  onTrace?: (nodeId: string) => void;
}) {
  const connections = useMemo<NodeConnection[]>(() => {
    if (!node) return [];
    const nodeMap = new Map(graph.nodes.map((candidate) => [candidate.id, candidate]));
    const seen = new Set<string>();
    const result: NodeConnection[] = [];

    for (const edge of graph.edges) {
      const forward = edge.from === node.id;
      const otherId = forward ? edge.to : edge.to === node.id ? edge.from : null;
      if (!otherId || seen.has(otherId)) continue;
      const other = nodeMap.get(otherId);
      if (!other) continue;
      seen.add(otherId);
      result.push({ node: other, phrase: describeRelationship(edge.type, forward) });
    }

    return result;
  }, [graph, node]);

  const typeLabel = node ? (GRAPH_NODE_TYPE_LABELS[node.type] ?? node.type) : "";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {node ? (
          <>
            <DrawerHeader>
              <DrawerTitle>{node.label}</DrawerTitle>
              <DrawerDescription>{typeLabel}</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6">
              {node.description ? (
                <p className="text-sm text-muted-foreground">{node.description}</p>
              ) : null}

              {connections.length > 0 ? (
                <div className="mt-4">
                  <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Connections
                  </h3>
                  <ul className="mt-2 space-y-0.5">
                    {connections.map((connection) => (
                      <li key={connection.node.id}>
                        <button
                          type="button"
                          onClick={() => onSelectNode(connection.node.id)}
                          className="flex w-full flex-wrap items-baseline gap-x-2 rounded-md px-1 py-1 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="text-xs text-muted-foreground">{connection.phrase}</span>
                          <span className="font-medium">{connection.node.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  This object has no further connections in this graph.
                </p>
              )}

              {onTrace ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-5"
                  onClick={() => onTrace(node.id)}
                >
                  Trace a connection from here
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

export default GraphNodeSheet;
