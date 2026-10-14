// The Tether, with everything around it: growth level, a legend that filters
// rings, the selected ball's details, and an accessible list view. Used by
// the project page, the Studio block and the full /tether page.
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, List, Orbit, X } from "lucide-react";
import { layoutTether, tetherLevel, type PlacedNode, type TetherNodeIn } from "@/lib/tether-layout";
import { cn } from "@/lib/utils";
import { colorFor, TetherGraph } from "./tether-graph";

const KIND_LABEL: Record<string, string> = {
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

function LevelBar({ nodes, className }: { nodes: TetherNodeIn[]; className?: string }) {
  const level = tetherLevel(nodes);
  return (
    <div className={cn("min-w-0", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-display font-semibold">
          Level {level.level} · {level.name}
        </span>
        {level.next && <span className="text-xs text-muted-foreground">next: {level.next}</span>}
      </p>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated"
        role="progressbar"
        aria-valuenow={Math.round(level.progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={level.next ? `Progress to ${level.next}` : "Top level"}
      >
        <div
          className="h-full rounded-full bg-[var(--user-accent,var(--primary))] transition-[width] duration-700"
          style={{ width: `${Math.max(4, level.progress * 100)}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{level.blurb}</p>
    </div>
  );
}

export function TetherPanel({
  nodes,
  centerLabel,
  centerSub,
  compact = false,
  visibleIds,
  showNames,
  fullHref,
  toolbar,
}: {
  nodes: TetherNodeIn[];
  centerLabel: string;
  centerSub?: string;
  compact?: boolean;
  visibleIds?: Set<string> | null;
  showNames?: boolean;
  /** "Open the full Tether" link (compact views). */
  fullHref?: { to: "/tether"; search: { project?: string; member?: string } } | null;
  toolbar?: ReactNode;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<PlacedNode | null>(null);
  const [list, setList] = useState(false);
  const rings = useMemo(() => layoutTether(nodes), [nodes]);
  // The legend and list go by kind (the shared outer ring holds several).
  const kinds = useMemo(() => {
    const out: { type: string; nodes: PlacedNode[] }[] = [];
    for (const r of rings)
      for (const n of r.nodes) {
        const k = out.find((x) => x.type === n.type);
        if (k) k.nodes.push(n);
        else out.push({ type: n.type, nodes: [n] });
      }
    return out;
  }, [rings]);
  const visible = useMemo(() => {
    if (!hidden.size && !visibleIds) return null;
    const ids = new Set<string>();
    for (const n of nodes)
      if (!hidden.has(n.type) && (!visibleIds || visibleIds.has(n.id))) ids.add(n.id);
    return ids;
  }, [hidden, visibleIds, nodes]);

  const toggle = (type: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <LevelBar
          nodes={visibleIds ? nodes.filter((n) => visibleIds.has(n.id)) : nodes}
          className="w-full max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <button
            type="button"
            onClick={() => setList((v) => !v)}
            aria-pressed={list}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-elevated"
          >
            {list ? <Orbit className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
            {list ? "Tether view" : "List view"}
          </button>
          {fullHref && (
            <Link
              {...fullHref}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-elevated"
            >
              <Orbit className="h-3.5 w-3.5" /> Open the full Tether
            </Link>
          )}
        </div>
      </div>

      {/* Legend = filter */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rings">
        {kinds.map((kind) => {
          const off = hidden.has(kind.type);
          return (
            <button
              key={kind.type}
              type="button"
              aria-pressed={!off}
              onClick={() => toggle(kind.type)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                off
                  ? "border-border/50 text-muted-foreground opacity-60"
                  : "border-border/70 hover:bg-surface-elevated",
              )}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: colorFor(kind.type) }}
              />
              {KIND_LABEL[kind.type] ?? kind.type}
              <span className="tabular-nums text-muted-foreground">{kind.nodes.length}</span>
            </button>
          );
        })}
      </div>

      {list ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {kinds.map((kind) => (
            <section key={kind.type} aria-label={KIND_LABEL[kind.type] ?? kind.type}>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: colorFor(kind.type) }}
                />
                {KIND_LABEL[kind.type] ?? kind.type} · {kind.nodes.length}
              </h3>
              <ul className="space-y-1 text-sm">
                {kind.nodes.map((n) => (
                  <li key={n.id}>
                    {n.href ? (
                      <a
                        href={n.href}
                        className="hover:underline"
                        {...(n.href.startsWith("http")
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                      >
                        {n.label}
                      </a>
                    ) : (
                      n.label
                    )}
                    {n.description && (
                      <span className="text-xs text-muted-foreground"> · {n.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="relative">
          <TetherGraph
            nodes={nodes}
            centerLabel={centerLabel}
            centerSub={centerSub}
            visibleIds={visible}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            compact={compact}
            showNames={showNames}
            className={compact ? "max-h-[440px]" : "max-h-[78vh]"}
          />
          {selected && (
            <div className="absolute top-2 left-2 w-64 max-w-[calc(100%-1rem)] rounded-xl border border-border/70 bg-card/95 p-3 shadow-panel backdrop-blur">
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelected(null)}
                className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: colorFor(selected.type) }}
                />
                {KIND_LABEL[selected.type] ?? rings[selected.ring]?.label}
              </p>
              <p className="mt-1 pr-5 text-sm font-semibold">{selected.label}</p>
              {selected.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{selected.description}</p>
              )}
              {selected.at && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Joined the story{" "}
                  {new Date(selected.at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}
              {selected.href && (
                <a
                  href={selected.href}
                  {...(selected.href.startsWith("http")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
