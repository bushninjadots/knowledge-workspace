import type { GraphNode, GraphNodeType, TethyrGraph } from "./graph-model";

/**
 * Phase 4 of the Tethyr Graph spec — "How we got here" (§6, §8 VIEW 5, §28).
 * Derives a chronological project history from the graph itself: the project
 * this one was forked from, dated milestones and contributions, repository
 * imports, and the projects later forked from it. No AI, no invented events —
 * only relationships the graph already stores (§28, §59). The same graph the
 * explorer maps and lists is the single source (§69).
 */

type ProjectTimelineKind = "origin" | "milestone" | "contribution" | "import" | "fork";

interface ProjectTimelineEntry {
  nodeId: string;
  kind: ProjectTimelineKind;
  title: string;
  description?: string;
  /** ISO date when the graph stored one; origins and forks are undated. */
  date?: string;
}

interface ProjectTimeline {
  entries: ProjectTimelineEntry[];
  /** How many related events the cap left out (spec §45). */
  omitted: number;
}

/** Which node glyph represents each kind on the timeline. */
export const PROJECT_TIMELINE_NODE_TYPE: Record<ProjectTimelineKind, GraphNodeType> = {
  origin: "project",
  fork: "project",
  milestone: "milestone",
  contribution: "contribution",
  import: "repository",
};

export const PROJECT_TIMELINE_LABELS: Record<ProjectTimelineKind, string> = {
  origin: "Origin",
  fork: "Forked into",
  milestone: "Milestone",
  contribution: "Contribution",
  import: "Imported",
};

function entryFromNode(node: GraphNode, kind: ProjectTimelineKind): ProjectTimelineEntry {
  const date =
    typeof node.metadata?.date === "string"
      ? node.metadata.date
      : typeof node.metadata?.importedAt === "string"
        ? node.metadata.importedAt
        : undefined;
  return {
    nodeId: node.id,
    kind,
    title: node.label,
    description: node.description,
    date,
  };
}

function rank(entry: ProjectTimelineEntry): number {
  // Origins open the story, dated events tell it in order, forks close it.
  if (entry.kind === "origin") return 0;
  if (entry.date) return 1;
  return 2;
}

export function buildProjectTimeline(
  graph: TethyrGraph,
  projectId: string,
  options: { maxEntries?: number } = {},
): ProjectTimeline | null {
  const project = graph.nodes.find((node) => node.id === projectId);
  if (!project) return null;
  const maxEntries = Math.max(1, options.maxEntries ?? 60);

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const byNode = new Map<string, ProjectTimelineEntry>();

  for (const edge of graph.edges) {
    const fromProject = edge.from === projectId;
    const toProject = edge.to === projectId;
    if (!fromProject && !toProject) continue;
    const node = nodeById.get(fromProject ? edge.to : edge.from);
    if (!node) continue;

    if (edge.type === "forked_from" && node.type === "project") {
      byNode.set(node.id, entryFromNode(node, "origin"));
    } else if (edge.type === "derived_from" && node.type === "project") {
      byNode.set(node.id, entryFromNode(node, "fork"));
    } else if (edge.type === "has_milestone" && node.type === "milestone") {
      byNode.set(node.id, entryFromNode(node, "milestone"));
    } else if (
      (edge.type === "produced" || edge.type === "contributed_to") &&
      node.type === "contribution"
    ) {
      byNode.set(node.id, entryFromNode(node, "contribution"));
    } else if (edge.type === "imported_from" && node.type === "repository") {
      byNode.set(node.id, entryFromNode(node, "import"));
    }
  }

  const all = [...byNode.values()].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.date ?? "").localeCompare(b.date ?? "") ||
      a.title.localeCompare(b.title) ||
      a.nodeId.localeCompare(b.nodeId),
  );

  return {
    entries: all.slice(0, maxEntries),
    omitted: Math.max(0, all.length - maxEntries),
  };
}
