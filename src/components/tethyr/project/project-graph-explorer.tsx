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

export function ProjectGraphExplorer({ input }: { input: ProjectGraphInput }) {
  const [expanded, setExpanded] = useState(false);
  const [depth, setDepth] = useState(1);
  const graph = useMemo(() => buildProjectGraph(input), [input]);
  const projectId = `project:${input.project.id}`;
  const connected = useMemo(
    () => getConnectedNodes(graph, projectId, { depth }),
    [graph, projectId, depth],
  );

  if (connected.length === 0) return null;

  const grouped = connected.reduce<Record<string, GraphNode[]>>((groups, node) => {
    (groups[node.type] ??= []).push(node);
    return groups;
  }, {});

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
        </div>
      ) : null}
    </div>
  );
}

export default ProjectGraphExplorer;
