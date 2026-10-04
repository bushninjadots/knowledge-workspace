import { useMemo, useState } from "react";
import { computeRadialLayout } from "@/lib/graph-layout";
import { GRAPH_NODE_TYPE_LABELS, type GraphNode, type TethyrGraph } from "@/lib/graph-model";
import { GraphNodeGlyph } from "./graph-node-glyph";
import { cn } from "@/lib/utils";

/**
 * Phase 9 of the Tethyr Graph spec — the spatial map for "Connections" mode
 * (spec §8 VIEW 1, §11 Radial). SVG draws the relationships; the nodes
 * themselves are real buttons, so the map is keyboard-operable and reads the
 * same glyph language as every other graph view (spec §21, §47).
 *
 * Interaction follows the spec's selection rules (§23, §26): hovering or
 * selecting a node highlights its own relationships and dims everything
 * unrelated — with quiet opacity transitions only (spec §44), no physics, no
 * glow. Search and type filters dim their non-matches instead of removing
 * them, so the map keeps its spatial context while the list view removes.
 */

/** Weak/derived relationships draw dashed; structural ones draw solid (§23). */
const WEAK_EDGE_TYPES = new Set([
  "related_to",
  "derived_from",
  "forked_from",
  "needs",
  "referenced_by",
  "references",
]);

const NODE_SIZES = ["h-14 w-14", "h-11 w-11", "h-9 w-9"] as const;

export function GraphNetworkView({
  graph,
  rootId,
  maxNodes = 40,
  isMatch,
  selectedId,
  onSelect,
}: {
  graph: TethyrGraph;
  rootId: string;
  maxNodes?: number;
  /** When set, non-matching nodes dim instead of disappearing (spec §26). */
  isMatch?: (node: GraphNode) => boolean;
  selectedId?: string | null;
  onSelect?: (nodeId: string) => void;
}) {
  const layout = useMemo(
    () => computeRadialLayout(graph, rootId, { maxNodes }),
    [graph, rootId, maxNodes],
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const focusId = hoveredId ?? selectedId ?? null;

  const neighboursOf = useMemo(() => {
    if (!focusId) return null;
    const ids = new Set<string>([focusId]);
    for (const edge of layout?.edges ?? []) {
      if (edge.from === focusId) ids.add(edge.to);
      if (edge.to === focusId) ids.add(edge.from);
    }
    return ids;
  }, [focusId, layout]);

  if (!layout || layout.nodes.length <= 1) return null;

  const size = layout.radius * 2;
  const percent = (value: number) => `${50 + (value / size) * 100}%`;

  return (
    <div className="mt-4">
      <div
        role="group"
        aria-label="Network map"
        className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden"
      >
        <svg
          viewBox={`${-layout.radius} ${-layout.radius} ${size} ${size}`}
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {layout.edges.map((edge) => {
            const from = layout.nodes.find((entry) => entry.node.id === edge.from);
            const to = layout.nodes.find((entry) => entry.node.id === edge.to);
            if (!from || !to) return null;
            const weak = WEAK_EDGE_TYPES.has(edge.type);
            const active = neighboursOf?.has(edge.from) && neighboursOf?.has(edge.to);
            const dimmed = focusId !== null && !active;
            return (
              <line
                key={edge.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={cn(
                  "transition-opacity duration-200",
                  weak ? "stroke-border" : "stroke-foreground/40",
                  active ? "stroke-2 opacity-100" : "stroke-1",
                  dimmed && "opacity-25",
                )}
                strokeWidth={weak ? 1 : 1.5}
                strokeDasharray={weak ? "5 6" : undefined}
              />
            );
          })}
        </svg>

        {layout.nodes.map(({ node, ring, x, y }) => {
          const dimmed =
            (neighboursOf !== null && !neighboursOf.has(node.id)) ||
            (isMatch ? !isMatch(node) : false);
          const selected = selectedId === node.id;
          const isRoot = ring === 0;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect?.(node.id)}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(node.id)}
              onBlur={() => setHoveredId(null)}
              aria-pressed={selected || undefined}
              aria-label={`${node.label} — ${GRAPH_NODE_TYPE_LABELS[node.type]}`}
              className={cn(
                "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 transition-opacity duration-200 focus-visible:outline-none",
                dimmed && !selected && "opacity-25",
                dimmed && selected && "opacity-60",
              )}
              style={{ left: percent(x), top: percent(y) }}
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-full border bg-background transition-colors",
                  NODE_SIZES[Math.min(ring, NODE_SIZES.length - 1)],
                  isRoot
                    ? "border-[var(--user-accent,var(--trust))] text-foreground"
                    : ring === 1
                      ? "border-border-strong text-foreground"
                      : "border-border/70 text-muted-foreground",
                  selected &&
                    "border-[var(--user-accent,var(--trust))] ring-2 ring-[var(--user-accent,var(--trust))]/30",
                )}
              >
                <GraphNodeGlyph
                  type={node.type}
                  className={cn(
                    isRoot ? "h-5 w-5" : ring === 1 ? "h-4 w-4" : "h-3.5 w-3.5",
                    ring === 2 && "opacity-80",
                  )}
                />
              </span>
              <span
                className={cn(
                  "max-w-[96px] truncate text-[10px] leading-tight",
                  isRoot ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {node.label}
              </span>
            </button>
          );
        })}
      </div>
      {layout.omitted > 0 ? (
        <p className="mt-2 text-center text-xs text-muted-foreground" role="status">
          {layout.omitted} further {layout.omitted === 1 ? "connection is" : "connections are"} on
          the list view — the map shows the closest {layout.nodes.length}.
        </p>
      ) : null}
    </div>
  );
}

export default GraphNetworkView;
