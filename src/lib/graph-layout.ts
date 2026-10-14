import type { GraphEdge, GraphNode, TethyrGraph } from "./graph-model";

/**
 * Phase 9 of the Tethyr Graph spec — a layout layer, not a second graph model
 * (spec §60). Given any Tethyr graph, walks outward from a root node and places
 * every reachable node on concentric rings (spec §11 Radial): the root at the
 * centre, its direct connections on ring 1, and so on.
 *
 * Rules the views rely on:
 *  - Deterministic: the same graph always produces the same positions, so a
 *    re-render never reshuffles the map (spec §44 — the graph feels stable).
 *  - Capped: at most `maxNodes` nodes are placed, the rest are reported as
 *    `omitted` so the view can point at the list alternative (spec §45).
 *  - Honest: only edges whose both endpoints were placed are returned; no
 *    dangling relationships are invented (spec §59).
 *  - Uncrowded: a ring with more nodes than fit around it spills into extra
 *    bands just outside it, so nodes never sit on top of each other.
 */

interface GraphLayoutNode {
  node: GraphNode;
  /** 0 = root, 1 = direct connections, 2 = extended graph. */
  ring: number;
  /** Position relative to the root, in abstract units (ring gaps). */
  x: number;
  y: number;
  angle: number;
  /** Space to each neighbour along its band, in layout units — the view
   *  hides labels that would not fit in it. */
  arc: number;
}

interface GraphLayout {
  nodes: GraphLayoutNode[];
  edges: GraphEdge[];
  /** Distance from the centre to the edge of the layout, including padding. */
  radius: number;
  /** How many reachable nodes the cap left out (spec §45). */
  omitted: number;
}

const DEFAULT_RING_GAP = 120;
const DEFAULT_MAX_NODES = 40;
/** Extra space beyond the outermost ring so node labels are not clipped. */
const LABEL_PADDING = 0.35;
/** Closest two nodes may sit along a band, as a share of the ring gap. */
const MIN_ARC = 0.5;
/** Distance between the bands of one crowded ring, as a share of the ring gap. */
const BAND_GAP = 0.5;

/** Split `count` nodes over as few bands (starting at `radius`) as hold them,
 *  sharing them out by each band's room so the outer band isn't left sparse. */
function bandsFor(count: number, radius: number, ringGap: number) {
  const radii: number[] = [];
  const room: number[] = [];
  let total = 0;
  while (total < count) {
    const r = radius + radii.length * ringGap * BAND_GAP;
    const fits = Math.max(6, Math.floor((Math.PI * 2 * r) / (ringGap * MIN_ARC)));
    radii.push(r);
    room.push(fits);
    total += fits;
  }
  let left = count;
  return radii.map((r, i) => {
    const take =
      i === radii.length - 1 ? left : Math.min(left, Math.round((count * room[i]) / total));
    left -= take;
    return { radius: r, count: take };
  });
}

function ringSpread(count: number, index: number, ring: number): number {
  // Even angular spacing; odd rings are staggered by half a step so ring 2
  // nodes sit between their ring 1 neighbours instead of behind them.
  const step = (Math.PI * 2) / count;
  const stagger = ring % 2 === 0 ? 0 : step / 2;
  return index * step + stagger - Math.PI / 2;
}

export function computeRadialLayout(
  graph: TethyrGraph,
  rootId: string,
  options: { ringGap?: number; maxNodes?: number } = {},
): GraphLayout | null {
  const root = graph.nodes.find((node) => node.id === rootId);
  if (!root) return null;

  const ringGap = Math.max(60, options.ringGap ?? DEFAULT_RING_GAP);
  const maxNodes = Math.max(1, options.maxNodes ?? DEFAULT_MAX_NODES);

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const ringBy = new Map<string, number>([[rootId, 0]]);
  const rings: GraphNode[][] = [[root]];

  // Breadth-first walk, one ring at a time, stopping at the node cap.
  let frontier = [rootId];
  let placed = 1;
  let depth = 0;
  while (frontier.length > 0 && placed < maxNodes) {
    const next: string[] = [];
    for (const id of frontier) {
      if (placed >= maxNodes) break;
      for (const edge of graph.edges) {
        const other = edge.from === id ? edge.to : edge.to === id ? edge.from : null;
        if (!other || ringBy.has(other)) continue;
        const node = nodeById.get(other);
        if (!node) continue;
        ringBy.set(other, depth + 1);
        (rings[depth + 1] ??= []).push(node);
        next.push(other);
        placed += 1;
        if (placed >= maxNodes) break;
      }
    }
    frontier = next;
    depth += 1;
  }

  const layoutNodes: GraphLayoutNode[] = [];
  // Where the next ring starts: one gap beyond the previous ring's outer band.
  let nextRadius = ringGap;
  let outerRadius = 0;
  rings.forEach((members, ring) => {
    // Deterministic order: type, then label, then id — so identical graphs
    // always render identically (spec §44).
    const ordered = [...members].sort(
      (a, b) =>
        a.type.localeCompare(b.type) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id),
    );
    if (ring === 0) {
      layoutNodes.push({ node: ordered[0], ring, x: 0, y: 0, angle: 0, arc: ringGap });
      return;
    }
    let start = 0;
    bandsFor(ordered.length, nextRadius, ringGap).forEach((band, b) => {
      ordered.slice(start, start + band.count).forEach((node, index) => {
        // Alternate the stagger band to band so neighbouring bands interleave.
        const angle = ringSpread(band.count, index, ring + b);
        layoutNodes.push({
          node,
          ring,
          x: Math.cos(angle) * band.radius,
          y: Math.sin(angle) * band.radius,
          angle,
          arc: (Math.PI * 2 * band.radius) / band.count,
        });
      });
      start += band.count;
      outerRadius = band.radius;
    });
    nextRadius = outerRadius + ringGap;
  });

  const edges = graph.edges.filter((edge) => ringBy.has(edge.from) && ringBy.has(edge.to));

  return {
    nodes: layoutNodes,
    edges,
    radius: Math.max(outerRadius, ringGap) * (1 + LABEL_PADDING),
    omitted: Math.max(0, graph.nodes.length - placed),
  };
}
