import { buildProjectGraph, type ProjectGraphInput } from "@/lib/project-graph";
import { useGraphTheme } from "@/hooks/use-graph-theme";
import { ProjectGraphExplorer } from "./project-graph-explorer";
import { GraphNodeGlyph } from "@/components/tethyr/graph/graph-node-glyph";
import { GRAPH_NODE_TYPE_LABELS, type GraphNodeType } from "@/lib/graph-model";
import { useState } from "react";

/** Counted above, listed in Activity and the roadmap — not repeated as chips. */
const HISTORY_TYPES = new Set<GraphNodeType>(["contribution", "milestone", "credit"]);

const GROUP_ORDER: GraphNodeType[] = [
  "person",
  "skill",
  "project",
  "repository",
  "role",
  "need",
  "community",
  "session",
  "challenge",
  "discussion",
  "knowledge",
  "library_item",
  "badge",
];

const GROUP_PREVIEW = 6;

function NodeGroup({
  type,
  nodes,
  radius,
  gap,
}: {
  type: GraphNodeType;
  nodes: { id: string; type: GraphNodeType; label: string }[];
  radius: number | string;
  gap: number | string;
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? nodes : nodes.slice(0, GROUP_PREVIEW);
  const hidden = nodes.length - shown.length;
  return (
    <div role="listitem" className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <p className="w-28 shrink-0 text-xs text-muted-foreground">
        {GRAPH_NODE_TYPE_LABELS[type]} <span className="tabular-nums">· {nodes.length}</span>
      </p>
      <ul className="flex min-w-0 flex-1 flex-wrap" style={{ gap }}>
        {shown.map((node) => (
          <li
            key={node.id}
            className="border border-border/70 px-2.5 py-1 text-xs"
            style={{ borderRadius: radius }}
          >
            {/* An icon for the kind of thing, not a raw type word; the name
                is said for screen readers. */}
            <GraphNodeGlyph
              type={node.type}
              className="mr-1 inline align-[-2px] text-muted-foreground"
            />
            <span className="sr-only">{GRAPH_NODE_TYPE_LABELS[node.type]}: </span>
            <span className="font-medium" title={GRAPH_NODE_TYPE_LABELS[node.type]}>
              {node.label}
            </span>
          </li>
        ))}
        {(hidden > 0 || open) && nodes.length > GROUP_PREVIEW && (
          <li>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              {open ? "Show fewer" : `+${hidden} more`}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

/** The project itself plus at least one other node — otherwise the summary is
 *  just a project counting itself, and the section hides (the graph spec's
 *  entry point should earn its place on the page, not report emptiness). */
export function isMeaningfulProjectGraph(input: ProjectGraphInput): boolean {
  return buildProjectGraph(input).nodes.length > 1;
}

export function ProjectGraphSummary({ input }: { input: ProjectGraphInput }) {
  if (!isMeaningfulProjectGraph(input)) return null;
  return <ProjectGraphSummaryBody input={input} />;
}

function ProjectGraphSummaryBody({ input }: { input: ProjectGraphInput }) {
  const theme = useGraphTheme();
  const graph = buildProjectGraph(input);
  const counts = graph.nodes.reduce<Record<string, number>>((result, node) => {
    result[node.type] = (result[node.type] ?? 0) + 1;
    return result;
  }, {});
  const connectedNodes = graph.nodes.filter(
    (node) => node.id !== `project:${input.project.id}` && !HISTORY_TYPES.has(node.type),
  );
  const parentProject = graph.edges.find(
    (edge) => edge.from === `project:${input.project.id}` && edge.type === "forked_from",
  );
  const parentNode = parentProject
    ? graph.nodes.find((node) => node.id === parentProject.to)
    : undefined;

  return (
    <section
      id="project-graph"
      aria-labelledby="project-graph-heading"
      className="mt-10 scroll-mt-24 border-t border-border/60 pt-8"
    >
      {/* No leading icon: the section headings around it (Sessions, Needs,
          Challenges) start flush, so this one lines up with them. */}
      <div>
        <h2
          id="project-graph-heading"
          className="font-display text-lg font-semibold tracking-tight"
        >
          How it connects
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Who's involved, the skills it uses, and the projects, repos and resources around it.
        </p>
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">People</dt>
          <dd className="font-medium tabular-nums">{counts.person ?? 0}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Skills</dt>
          <dd className="font-medium tabular-nums">{counts.skill ?? 0}</dd>
        </div>
        {/* The project's own milestones, as on the roadmap. The graph also
            files activity history under "milestone", which inflated this. */}
        {input.milestones?.length ? (
          <div>
            <dt className="text-muted-foreground">Milestones</dt>
            <dd className="font-medium tabular-nums">{input.milestones.length}</dd>
          </div>
        ) : null}
        {counts.repository ? (
          <div>
            <dt className="text-muted-foreground">Repositories</dt>
            <dd className="font-medium tabular-nums">{counts.repository}</dd>
          </div>
        ) : null}
        {counts.contribution ? (
          <div>
            <dt className="text-muted-foreground">Contributions</dt>
            <dd className="font-medium tabular-nums">{counts.contribution}</dd>
          </div>
        ) : null}
        {counts.project > 1 ? (
          <div>
            <dt className="text-muted-foreground">Related projects</dt>
            <dd className="font-medium tabular-nums">{counts.project - 1}</dd>
          </div>
        ) : null}
      </dl>
      {parentNode ? (
        <div className="mt-5 border-l-2 border-primary/40 pl-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Project lineage
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Forked from</span>
            <a
              className="font-medium underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
              href={`/projects/${encodeURIComponent(parentNode.id.replace("project:", ""))}`}
            >
              {parentNode.label}
            </a>
            <span aria-hidden="true" className="text-muted-foreground">
              →
            </span>
            <span className="font-medium">{input.project.title}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            A connected project history, not just an import label.
          </p>
        </div>
      ) : null}
      {/* Grouped and folded: a busy project used to print every person,
          skill, commit and contribution as one long run of chips. Work
          history (commits, contributions, milestones) is a count above —
          Activity and the roadmap list it in full. */}
      <div aria-label="Connected nodes" role="list" className="mt-5 space-y-3">
        {GROUP_ORDER.map((type) => {
          const nodes = connectedNodes.filter((node) => node.type === type);
          if (!nodes.length) return null;
          return (
            <NodeGroup
              key={type}
              type={type}
              nodes={nodes}
              radius={theme.nodeRadius}
              gap={theme.gap}
            />
          );
        })}
      </div>
      <ProjectGraphExplorer input={input} />
    </section>
  );
}
