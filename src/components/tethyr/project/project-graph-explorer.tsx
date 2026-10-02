import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Network } from "lucide-react";
import { getConnectedNodes, type GraphNode } from "@/lib/graph-model";
import { buildProjectGraph, type ProjectGraphInput } from "@/lib/project-graph";

const TYPE_LABELS: Record<GraphNode["type"], string> = {
  person: "People",
  project: "Projects",
  skill: "Skills",
  contribution: "Contributions",
  knowledge: "Knowledge",
  milestone: "Milestones",
  repository: "Repositories",
  discussion: "Discussions",
  community: "Communities",
  session: "Sessions",
  role: "Roles",
  badge: "Badges",
  library_item: "Library",
  challenge: "Challenges",
  credit: "Credits",
  need: "Needs",
};

function titleForType(type: GraphNode["type"]) {
  return TYPE_LABELS[type] ?? type;
}

/** Node types present in the connected set, in the spec's filter order. */
function typesPresent(nodes: GraphNode[]): GraphNode["type"][] {
  const seen = new Set<GraphNode["type"]>();
  for (const node of nodes) seen.add(node.type);
  return Object.keys(TYPE_LABELS).filter((t) => seen.has(t as GraphNode["type"])) as GraphNode["type"][];
}

export function ProjectGraphExplorer({ input }: { input: ProjectGraphInput }) {
  const [expanded, setExpanded] = useState(false);
  const [depth, setDepth] = useState(1);
  const [hiddenTypes, setHiddenTypes] = useState<Set<GraphNode["type"]>>(new Set());
  const graph = useMemo(() => buildProjectGraph(input), [input]);
  const projectId = `project:${input.project.id}`;
  const connected = useMemo(
    () => getConnectedNodes(graph, projectId, { depth }),
    [graph, projectId, depth],
  );

  const visibleConnected = useMemo(
    () => connected.filter((node) => !hiddenTypes.has(node.type)),
    [connected, hiddenTypes],
  );

  if (connected.length === 0) return null;

  const presentTypes = typesPresent(connected);
  const grouped = visibleConnected.reduce<Record<string, GraphNode[]>>((groups, node) => {
    (groups[node.type] ??= []).push(node);
    return groups;
  }, {});

  function toggleType(type: GraphNode["type"]) {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  return (
    <div className="mt-5 border-t border-border/50 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Network className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Explore the project graph
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Hide connections" : `Show ${connected.length} connections`}
          {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      {expanded ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-muted-foreground" htmlFor="project-graph-depth">
              Relationship depth
              <select
                id="project-graph-depth"
                value={depth}
                onChange={(event) => setDepth(Number(event.target.value))}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
              >
                <option value={1}>Direct connections</option>
                <option value={2}>Connected ecosystem</option>
                <option value={3}>Extended graph</option>
              </select>
            </label>
            {presentTypes.length > 1 ? (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by node type">
                {presentTypes.map((type) => {
                  const active = !hiddenTypes.has(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      aria-pressed={active}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        active
                          ? "border-border bg-surface-elevated text-foreground"
                          : "border-border/40 text-muted-foreground/60 line-through"
                      }`}
                    >
                      {titleForType(type)}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          {visibleConnected.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">All node types are hidden. Toggle a filter above to see connections.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(grouped).map(([type, nodes]) => (
                <div key={type} className="border border-border/60 p-3">
                  <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {titleForType(type as GraphNode["type"])}
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {nodes.map((node) => (
                      <li key={node.id} className="text-sm">
                        <div className="font-medium">{node.label}</div>
                        {node.description ? <div className="line-clamp-2 text-xs text-muted-foreground">{node.description}</div> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default ProjectGraphExplorer;
