import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Network, Route, Search } from "lucide-react";
import { getConnectedNodes, type GraphNode } from "@/lib/graph-model";
import { filterGraphNodes, graphTypeFacets, type GraphNodeFilter } from "@/lib/graph-exploration";
import { describeGraphStep, findGraphPath } from "@/lib/graph-path";
import { buildProjectGraph, type ProjectGraphInput } from "@/lib/project-graph";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
  const [mode, setMode] = useState<"browse" | "path">("browse");
  const [depth, setDepth] = useState(1);
  const [query, setQuery] = useState("");
  const [activeTypes, setActiveTypes] = useState<GraphNode["type"][]>([]);
  const [pathStart, setPathStart] = useState("");
  const [pathEnd, setPathEnd] = useState("");
  const graph = useMemo(() => buildProjectGraph(input), [input]);
  const projectId = `project:${input.project.id}`;
  const projectNode = useMemo(
    () => graph.nodes.find((node) => node.id === projectId),
    [graph, projectId],
  );
  const connected = useMemo(
    () => getConnectedNodes(graph, projectId, { depth }),
    [graph, projectId, depth],
  );
  const facets = useMemo(() => graphTypeFacets(connected), [connected]);
  // A depth change can retire a type; drop it so the view never filters to nothing.
  const selectedTypes = useMemo(
    () => activeTypes.filter((type) => facets.some((facet) => facet.type === type)),
    [activeTypes, facets],
  );
  const filter = useMemo<GraphNodeFilter>(
    () => ({ query, types: selectedTypes }),
    [query, selectedTypes],
  );
  const visible = useMemo(() => filterGraphNodes(connected, filter), [connected, filter]);
  const filtering = query.trim().length > 0 || selectedTypes.length > 0;

  // Path mode works across the whole connected graph, not the filtered view, so
  // the answer to "how are these connected?" never hides behind an active filter.
  const pathOptions = useMemo(() => {
    const options = projectNode ? [projectNode, ...connected] : connected;
    return Array.from(new Map(options.map((node) => [node.id, node])).values());
  }, [projectNode, connected]);
  const path = useMemo(
    () => (pathStart && pathEnd ? findGraphPath(graph, pathStart, pathEnd) : null),
    [graph, pathStart, pathEnd],
  );

  if (connected.length === 0) return null;

  const grouped = visible.reduce<Record<string, GraphNode[]>>((groups, node) => {
    (groups[node.type] ??= []).push(node);
    return groups;
  }, {});

  function toggleType(type: GraphNode["type"]) {
    setActiveTypes((current) =>
      current.includes(type) ? current.filter((value) => value !== type) : [...current, type],
    );
  }

  function clearFilters() {
    setQuery("");
    setActiveTypes([]);
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
          {expanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {expanded ? (
        <div className="mt-4">
          <div role="group" aria-label="Graph mode" className="flex flex-wrap items-center gap-1.5">
            {(["browse", "path"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  mode === value
                    ? "border-user-accent-border bg-accent text-foreground"
                    : "border-border/70 text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                {value === "browse" ? (
                  <Network className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Route className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {value === "browse" ? "Connections" : "How are these connected?"}
              </button>
            ))}
          </div>

          {mode === "path" ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-end gap-3">
                {(
                  [
                    { label: "From", value: pathStart, setValue: setPathStart },
                    { label: "To", value: pathEnd, setValue: setPathEnd },
                  ] as const
                ).map((field) => (
                  <div key={field.label} className="flex flex-col gap-1">
                    <label
                      className="text-xs text-muted-foreground"
                      htmlFor={`graph-path-${field.label.toLowerCase()}`}
                    >
                      {field.label}
                    </label>
                    <Select value={field.value} onValueChange={field.setValue}>
                      <SelectTrigger
                        id={`graph-path-${field.label.toLowerCase()}`}
                        className="h-8 w-[220px] text-xs"
                        aria-label={`Path ${field.label.toLowerCase()} node`}
                      >
                        <SelectValue placeholder="Choose an object" />
                      </SelectTrigger>
                      <SelectContent>
                        {pathOptions.map((node) => (
                          <SelectItem key={node.id} value={node.id}>
                            {node.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {pathStart && pathEnd ? (
                pathStart === pathEnd ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Choose two different objects to trace a connection.
                  </p>
                ) : path && path.steps.length > 0 ? (
                  <ol className="mt-4 space-y-2">
                    {path.steps.map((step, index) => (
                      <li key={step.edge.id} className="flex items-baseline gap-2 text-sm">
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {index + 1}
                        </span>
                        <span>{describeGraphStep(step)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No connection found between these yet.
                  </p>
                )
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Choose two objects to see how they are connected.
                </p>
              )}
            </div>
          ) : (
            <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search connections"
                aria-label="Search connections"
                className="h-7 w-[200px] pl-7 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Relationship depth
              <Select value={String(depth)} onValueChange={(value) => setDepth(Number(value))}>
                <SelectTrigger
                  className="h-7 w-[180px] px-2 text-xs"
                  aria-label="Relationship depth"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Direct connections</SelectItem>
                  <SelectItem value="2">Connected ecosystem</SelectItem>
                  <SelectItem value="3">Extended graph</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {facets.length > 1 ? (
            <div
              role="group"
              aria-label="Filter connections by type"
              className="mt-3 flex flex-wrap gap-1.5"
            >
              {facets.map(({ type, count }) => {
                const active = selectedTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleType(type)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                      active
                        ? "border-user-accent-border bg-accent text-foreground"
                        : "border-border/70 text-muted-foreground hover:border-border-strong hover:text-foreground",
                    )}
                  >
                    {titleForType(type)}
                    <span className="tabular-nums opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {filtering ? (
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                Showing {visible.length} of {connected.length} connections
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="underline underline-offset-4 transition-colors hover:text-foreground"
              >
                Clear filters
              </button>
            </div>
          ) : null}

          {visible.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No connections match these filters.
            </p>
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
                        {node.description ? (
                          <div className="line-clamp-2 text-xs text-muted-foreground">
                            {node.description}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default ProjectGraphExplorer;
