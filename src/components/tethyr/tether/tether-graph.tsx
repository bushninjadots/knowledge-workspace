// ── The Tether (renderer) ─────────────────────────────────────────────────────
// A tetherball: the pole is the member or project, every connection is a ball
// on a rope tied to the top, orbiting in a tilted ring for its kind. Rings
// swing slowly in alternating directions; balls behind the pole dim and
// shrink. The pole rises with the growth level. Animation runs in one rAF
// loop that writes attributes straight to the SVG (no React re-render per
// frame), pauses while you hover, and stays still for reduced motion.
import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphNodeType } from "@/lib/graph-model";
import { GRAPH_NODE_TYPE_LABELS } from "@/lib/graph-model";
import {
  ballPosition,
  layoutTether,
  poleHeight,
  tetherLevel,
  type PlacedNode,
  type TetherNodeIn,
} from "@/lib/tether-layout";
import { cn } from "@/lib/utils";

const TYPE_COLOR: Partial<Record<GraphNodeType | "other", string>> = {
  person: "var(--trust)",
  project: "var(--ai)",
  skill: "var(--teaching)",
  repository: "color-mix(in oklab, var(--foreground) 70%, var(--background))",
  community: "var(--caution)",
  organization: "var(--learning)",
  knowledge: "color-mix(in oklab, var(--caution) 55%, var(--ai))",
  milestone: "var(--trust)",
  contribution: "var(--ai)",
  badge: "var(--caution)",
  other: "var(--muted-foreground)",
};

export const colorFor = (type: string) =>
  TYPE_COLOR[type as GraphNodeType] ?? "var(--muted-foreground)";

const TOP_Y = 150;
const CX = 500;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function TetherGraph({
  nodes,
  centerLabel,
  centerSub,
  visibleIds,
  selectedId,
  onSelect,
  compact = false,
  showNames = false,
  className,
}: {
  nodes: TetherNodeIn[];
  centerLabel: string;
  centerSub?: string;
  /** "Watch it grow": only these balls are out (others shrink away). */
  visibleIds?: Set<string> | null;
  selectedId?: string | null;
  onSelect?: (node: PlacedNode) => void;
  compact?: boolean;
  showNames?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const rings = useMemo(() => layoutTether(nodes), [nodes]);
  const placed = useMemo(() => rings.flatMap((r) => r.nodes), [rings]);
  const shown = useMemo(
    () => (visibleIds ? nodes.filter((n) => visibleIds.has(n.id)) : nodes),
    [nodes, visibleIds],
  );
  const level = tetherLevel(shown);

  // Geometry: the pole hangs down from TOP_Y; rings sit a little lower each,
  // like a skirt around the pole, so the ropes fan out into a cone.
  const ringCenter = (i: number) => TOP_Y + 70 + i * 26;
  const lastRing = rings[rings.length - 1];
  // Only orbits with balls out count — so in "Watch it grow" the pole and the
  // rings really grow as the story replays.
  const activeRings = visibleIds
    ? rings.filter((r) => r.nodes.some((n) => visibleIds.has(n.id)))
    : rings;
  const lastActive = activeRings[activeRings.length - 1];
  const ringBottom = lastActive ? ringCenter(lastActive.index) + lastActive.radius * 0.36 : TOP_Y;
  // The pole rises with the level, and always stands taller than its rings.
  const pole = Math.max(poleHeight(level.index), ringBottom - TOP_Y + 26);
  // The frame holds the full-grown Tether, so the replay doesn't jump around.
  const fullBottom = lastRing ? ringCenter(lastRing.index) + lastRing.radius * 0.36 : TOP_Y;
  const bottom =
    TOP_Y +
    Math.max(pole, poleHeight(tetherLevel(nodes).index), fullBottom - TOP_Y + 26) +
    (compact ? 80 : 90);
  const height = Math.ceil(bottom);
  // Fit the view to the rings that exist, so a young Tether isn't a speck
  // in a wide frame (and phones get a usable size).
  const half = Math.max(280, (lastRing?.radius ?? 0) + 60);
  // "As it grows it builds up": sparks circle the top from level 2, and a
  // second halo joins at level 5.
  const sparks = Math.min(30, Math.max(0, level.index) * 6);

  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  hoveredRef.current = hovered;
  const ballRefs = useRef(new Map<string, SVGGElement>());
  const ropeRefs = useRef(new Map<string, SVGPathElement>());
  const poleRef = useRef<SVGRectElement>(null);
  const sparkRefs = useRef<(SVGCircleElement | null)[]>([]);
  // Names fade out as balls swing behind the pole (they'd pile up there).
  const labelRefs = useRef(new Map<string, SVGGElement>());
  const baseRef = useRef<SVGGElement>(null);
  const visibleRef = useRef(visibleIds);
  visibleRef.current = visibleIds;
  const poleTarget = useRef(pole);
  poleTarget.current = pole;

  useEffect(() => {
    const grow = new Map<string, number>();
    let poleNow = poleTarget.current;
    let clock = 0;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Slow right down while someone is looking at a ball.
      if (!reduced) clock += dt * (hoveredRef.current ? 0.15 : 1);
      poleNow += (poleTarget.current - poleNow) * (reduced ? 1 : 0.08);
      const poleEl = poleRef.current;
      if (poleEl) poleEl.setAttribute("height", String(poleNow));
      baseRef.current?.setAttribute("transform", `translate(0 ${TOP_Y + poleNow})`);
      sparkRefs.current.forEach((el, i) => {
        if (!el) return;
        const r = 34 + (i % 5) * 14;
        const a = clock * (0.6 + (i % 3) * 0.25) * (i % 2 ? -1 : 1) + i * 2.399;
        el.setAttribute("cx", (CX + Math.cos(a) * r).toFixed(1));
        el.setAttribute("cy", (TOP_Y + Math.sin(a) * r * 0.42).toFixed(1));
        el.style.opacity = String(0.25 + ((Math.sin(clock * 2 + i) + 1) / 2) * 0.55);
      });
      for (const ring of rings) {
        const center = { x: CX, y: ringCenter(ring.index) };
        for (const node of ring.nodes) {
          const g = ballRefs.current.get(node.id);
          const rope = ropeRefs.current.get(node.id);
          if (!g || !rope) continue;
          const target = !visibleRef.current || visibleRef.current.has(node.id) ? 1 : 0;
          const cur = grow.get(node.id) ?? target;
          const next = reduced ? target : cur + (target - cur) * 0.12;
          grow.set(node.id, next);
          const p = ballPosition(ring, node.angle, clock, center);
          const s = p.scale * next;
          g.setAttribute(
            "transform",
            `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${s.toFixed(3)})`,
          );
          g.style.opacity = String((0.45 + p.depth * 0.55) * Math.min(1, next * 1.4));
          // A rope from the top of the pole, sagging a little under the ball.
          const mx = (CX + p.x) / 2;
          const my = (TOP_Y + p.y) / 2 + 18 + p.depth * 10;
          rope.setAttribute(
            "d",
            `M ${CX} ${TOP_Y} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
          );
          rope.style.opacity = String((0.12 + p.depth * 0.22) * next);
          const labelEl = labelRefs.current.get(node.id);
          if (labelEl) labelEl.style.opacity = labelEl.dataset.active || p.depth > 0.42 ? "1" : "0";
        }
      }
      if (!reduced || poleNow !== poleTarget.current) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // Rings change only when the data does; refs carry the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rings, reduced, sparks]);

  const focus = hovered ?? selectedId ?? null;

  return (
    <svg
      viewBox={`${CX - half} 0 ${half * 2} ${height}`}
      role="img"
      aria-label={`${centerLabel}: ${shown.length} connections — ${level.name}`}
      className={cn("h-auto w-full select-none", className)}
    >
      <defs>
        <radialGradient id="tether-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--user-accent, var(--primary))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--user-accent, var(--primary))" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="tether-pole" x1="0" x2="1">
          <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.55" />
          <stop offset="50%" stopColor="var(--foreground)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0.45" />
        </linearGradient>
        <radialGradient id="tether-shine" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.18" />
        </radialGradient>
      </defs>

      {/* Halo around the top of the pole — a second, wider one at level 5+ */}
      {level.index >= 4 && (
        <ellipse
          cx={CX}
          cy={TOP_Y + 90}
          rx={470}
          ry={260}
          fill="url(#tether-glow)"
          opacity={0.6}
          className="motion-safe:animate-gentle-pulse"
        />
      )}
      <ellipse cx={CX} cy={TOP_Y + 40} rx={300} ry={180} fill="url(#tether-glow)" />

      {/* Orbits */}
      {rings.map((ring) => (
        <ellipse
          key={ring.index}
          className="transition-opacity duration-700"
          opacity={activeRings.includes(ring) ? 1 : 0}
          cx={CX}
          cy={ringCenter(ring.index)}
          rx={ring.radius}
          ry={ring.radius * 0.36}
          fill="none"
          stroke={colorFor(ring.type)}
          strokeOpacity={ring.type === "other" ? 0.12 : 0.18}
          strokeDasharray="2 6"
        />
      ))}

      {/* Ropes */}
      <g fill="none" strokeLinecap="round">
        {placed.map((node) => (
          <path
            key={node.id}
            ref={(el) => {
              if (el) ropeRefs.current.set(node.id, el);
              else ropeRefs.current.delete(node.id);
            }}
            stroke={focus === node.id ? colorFor(node.type) : "var(--foreground)"}
            strokeWidth={focus === node.id ? 2 : 1}
            style={focus === node.id ? { opacity: 0.9 } : undefined}
          />
        ))}
      </g>

      {/* Sparks around the top */}
      {Array.from({ length: sparks }, (_, i) => (
        <circle
          key={i}
          ref={(el) => {
            sparkRefs.current[i] = el;
          }}
          cx={CX}
          cy={TOP_Y}
          r={i % 4 === 0 ? 2.2 : 1.4}
          fill="var(--user-accent, var(--primary))"
        />
      ))}

      {/* The pole */}
      <rect
        ref={poleRef}
        x={CX - 3.5}
        y={TOP_Y}
        width={7}
        height={pole}
        rx={3.5}
        fill="url(#tether-pole)"
      />
      <circle cx={CX} cy={TOP_Y} r={7} fill="var(--foreground)" />
      <circle cx={CX} cy={TOP_Y} r={3} fill="var(--user-accent, var(--primary))" />
      <g ref={baseRef} transform={`translate(0 ${TOP_Y + pole})`}>
        <ellipse cx={CX} cy={6} rx={46} ry={9} fill="var(--foreground)" opacity={0.12} />
        <ellipse cx={CX} cy={2} rx={26} ry={6} fill="var(--foreground)" opacity={0.55} />
        <text
          x={CX}
          y={42}
          textAnchor="middle"
          className="fill-foreground font-display"
          style={{ fontSize: compact ? 26 : 22, fontWeight: 600 }}
        >
          {centerLabel}
        </text>
        {centerSub && (
          <text
            x={CX}
            y={compact ? 70 : 66}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: compact ? 18 : 15 }}
          >
            {centerSub}
          </text>
        )}
      </g>

      {/* Balls */}
      {placed.map((node) => {
        const color = colorFor(node.type);
        const active = focus === node.id;
        const label = `${GRAPH_NODE_TYPE_LABELS[node.type] ?? "Item"}: ${node.label}`;
        return (
          <g
            key={node.id}
            ref={(el) => {
              if (el) ballRefs.current.set(node.id, el);
              else ballRefs.current.delete(node.id);
            }}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={label}
            className={onSelect ? "cursor-pointer outline-none" : undefined}
            onMouseEnter={() => setHovered(node.id)}
            onMouseLeave={() => setHovered((h) => (h === node.id ? null : h))}
            onFocus={() => setHovered(node.id)}
            onBlur={() => setHovered((h) => (h === node.id ? null : h))}
            onClick={() => onSelect?.(node)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(node);
              }
            }}
          >
            {active && <circle r={node.size + 7} fill={color} opacity={0.18} />}
            <circle r={node.size} fill={color} />
            <circle r={node.size} fill="url(#tether-shine)" />
            {(active || showNames) && (
              <g
                transform={`translate(0 ${-node.size - 10})`}
                ref={(el) => {
                  if (el) labelRefs.current.set(node.id, el);
                  else labelRefs.current.delete(node.id);
                }}
                data-active={active ? "1" : undefined}
              >
                <text
                  textAnchor="middle"
                  className="fill-foreground"
                  style={{
                    fontSize: compact ? 18 : 13,
                    fontWeight: 600,
                    paintOrder: "stroke",
                    stroke: "var(--background)",
                    strokeWidth: 5,
                  }}
                >
                  {node.label.length > 28 ? `${node.label.slice(0, 27)}…` : node.label}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
