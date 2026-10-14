// ── The Tether: layout ────────────────────────────────────────────────────────
// Tethyr's graph, drawn like a tetherball: the member (or project) is the
// pole, every connection is a ball on a rope, balls orbit in tilted rings —
// one ring per kind of thing — and the pole grows taller as the work grows.
// Pure: positions come from (ring, angle) so the renderer can spin them
// smoothly and the tests can pin them down.
import type { GraphNodeType } from "./graph-model";

export type TetherNodeIn = {
  id: string;
  type: GraphNodeType;
  label: string;
  /** How connected it is (edges, contributions…); sizes the ball. */
  weight?: number;
  /** When it joined the story — drives "Watch it grow". */
  at?: string | null;
  href?: string | null;
  description?: string | null;
};

export type PlacedNode = TetherNodeIn & {
  ring: number;
  /** Starting angle on its ring, radians. */
  angle: number;
  /** Ball radius in viewBox units. */
  size: number;
};

type TetherRing = {
  index: number;
  type: GraphNodeType | "other";
  label: string;
  /** Horizontal radius of the ring ellipse in viewBox units. */
  radius: number;
  /** Radians per second; rings alternate direction. */
  speed: number;
  nodes: PlacedNode[];
};

/** Inner rings are the closest relationships. */
const RING_ORDER: GraphNodeType[] = [
  "person",
  "project",
  "skill",
  "repository",
  "community",
  "organization",
  "knowledge",
  "milestone",
  "contribution",
  "role",
  "need",
  "session",
  "challenge",
  "discussion",
  "library_item",
  "badge",
  "credit",
];

const RING_LABEL: Partial<Record<GraphNodeType, string>> = {
  person: "People",
  project: "Projects",
  skill: "Skills",
  repository: "Repos",
  community: "Spaces",
  organization: "Crews",
  knowledge: "Learned & shipped",
  milestone: "Milestones",
  contribution: "Contributions",
  role: "Roles",
  need: "Needs",
  session: "Sessions",
  challenge: "Challenges",
  discussion: "Discussions",
  library_item: "Library",
  badge: "Badges",
  credit: "Credits",
};

export const MAX_RINGS = 6;
/** Fewer than this many of a kind and it joins the shared outer ring. */
const MIN_RING = 3;
const INNER_RADIUS = 120;
const RING_GAP = 62;
const MAX_PER_RING = 28;

/** A stable 0..1 number per string, so layouts don't jump between renders. */
function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

export function ballSize(weight = 1): number {
  return Math.round(Math.min(20, 7 + Math.sqrt(Math.max(0, weight)) * 3.2) * 10) / 10;
}

export function layoutTether(nodes: TetherNodeIn[]): TetherRing[] {
  const byType = new Map<GraphNodeType, TetherNodeIn[]>();
  for (const node of nodes) {
    const list = byType.get(node.type);
    if (list) list.push(node);
    else byType.set(node.type, [node]);
  }
  // Kinds with only a couple of balls share one outer ring (each ball keeps
  // its colour) — a lone ball on its own orbit looks lost.
  const present = RING_ORDER.filter((t) => byType.has(t));
  const big = present.filter((t) => (byType.get(t)?.length ?? 0) >= MIN_RING);
  const small = present.filter((t) => !big.includes(t));
  // Past the ring limit, the rest also share that outer ring.
  const ordered = [...big, ...small];
  const needsOuter = small.length > 0 || big.length > MAX_RINGS;
  const ownCount = Math.min(big.length, MAX_RINGS - (needsOuter ? 1 : 0));
  const own = big.slice(0, ownCount);
  const rest = ordered.slice(own.length).flatMap((t) => byType.get(t) ?? []);
  const groups: { type: GraphNodeType | "other"; label: string; nodes: TetherNodeIn[] }[] = [
    ...own.map((t) => ({ type: t, label: RING_LABEL[t] ?? t, nodes: byType.get(t) ?? [] })),
    ...(rest.length
      ? [{ type: "other" as const, label: own.length ? "More" : "Connections", nodes: rest }]
      : []),
  ];

  return groups.map((group, index) => {
    // Oldest first, so a ring fills around the pole in the order it grew;
    // the heaviest win a place when a ring is full.
    const sorted = [...group.nodes]
      .sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1))
      .slice(0, MAX_PER_RING)
      .sort((a, b) => Date.parse(a.at ?? "") - Date.parse(b.at ?? "") || a.id.localeCompare(b.id));
    const offset = hash01(group.label) * Math.PI * 2;
    return {
      index,
      type: group.type,
      label: group.label,
      radius: INNER_RADIUS + index * RING_GAP,
      speed: (index % 2 === 0 ? 1 : -1) * (0.09 - index * 0.008),
      nodes: sorted.map((node, i) => ({
        ...node,
        ring: index,
        angle: offset + (i / Math.max(1, sorted.length)) * Math.PI * 2,
        size: ballSize(node.weight),
      })),
    };
  });
}

/* ── Growth ─────────────────────────────────────────────────────────────── */

const LEVELS = [
  { name: "Seed", at: 0, blurb: "Every Tethyr starts with one tether." },
  { name: "First tether", at: 3, blurb: "The first connections are swinging." },
  { name: "Swinging", at: 10, blurb: "Projects, people and skills are pulling together." },
  { name: "In orbit", at: 25, blurb: "A whole system turning around your work." },
  { name: "Constellation", at: 50, blurb: "Rings of collaborators, work and knowledge." },
  { name: "Galaxy", at: 100, blurb: "A body of work with its own gravity." },
] as const;

/** Growth mass: every node counts, connected ones count more. */
function tetherMass(nodes: TetherNodeIn[]): number {
  return nodes.reduce((sum, n) => sum + 1 + Math.min(4, Math.max(0, (n.weight ?? 1) - 1) * 0.5), 0);
}

export function tetherLevel(nodes: TetherNodeIn[]) {
  const mass = tetherMass(nodes);
  let index = 0;
  LEVELS.forEach((level, i) => {
    if (mass >= level.at) index = i;
  });
  const next = LEVELS[index + 1];
  const progress = next ? (mass - LEVELS[index].at) / (next.at - LEVELS[index].at) : 1;
  return {
    index,
    level: index + 1,
    ...LEVELS[index],
    next: next?.name ?? null,
    progress: Math.max(0, Math.min(1, progress)),
    mass,
  };
}

/** The pole rises with the level (viewBox units). */
export function poleHeight(levelIndex: number): number {
  return 110 + levelIndex * 34;
}

/** The story so far at time `t` (nodes without a date are always there). */
export function grownBy(nodes: TetherNodeIn[], t: number): TetherNodeIn[] {
  return nodes.filter((n) => !n.at || Date.parse(n.at) <= t);
}

/** First and last dated moment, for the replay scrubber. */
export function tetherTimeline(nodes: TetherNodeIn[]): { start: number; end: number } | null {
  const times = nodes
    .map((n) => (n.at ? Date.parse(n.at) : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (times.length < 2) return null;
  return { start: times[0], end: Math.max(times[times.length - 1], Date.now()) };
}

/** Screen position of a ball on its ring at time `t` (seconds), with depth. */
export function ballPosition(
  ring: { radius: number; speed: number },
  angle: number,
  t: number,
  center: { x: number; y: number },
  tilt = 0.36,
) {
  const a = angle + ring.speed * t;
  const x = center.x + Math.cos(a) * ring.radius;
  const y = center.y + Math.sin(a) * ring.radius * tilt;
  // Front of the orbit (towards the viewer) is the lower half.
  const depth = (Math.sin(a) + 1) / 2;
  return { x, y, depth, scale: 0.72 + depth * 0.38 };
}
