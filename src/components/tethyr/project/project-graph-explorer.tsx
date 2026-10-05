import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  GitBranch,
  List,
  ListTree,
  Map as MapIcon,
  Network,
  Route,
  Search,
} from "lucide-react";
import {
  GRAPH_NODE_TYPE_LABELS,
  getConnectedNodes,
  type GraphEdgeType,
  type GraphNode,
} from "@/lib/graph-model";
import { filterGraphNodes, graphTypeFacets, type GraphNodeFilter } from "@/lib/graph-exploration";
import { describeGraphStep, findGraphPath } from "@/lib/graph-path";
import { buildProjectGraph, type ProjectGraphInput } from "@/lib/project-graph";
import {
  buildProjectTimeline,
  PROJECT_TIMELINE_LABELS,
  PROJECT_TIMELINE_NODE_TYPE,
} from "@/lib/project-timeline";
import { GraphTreeView } from "@/components/tethyr/graph/graph-tree-view";
import { GraphNodeSheet } from "@/components/tethyr/graph/graph-node-sheet";
import { GraphNetworkView } from "@/components/tethyr/graph/graph-network-view";
import { GraphNodeGlyph } from "@/components/tethyr/graph/graph-node-glyph";
import { useGraphTheme } from "@/hooks/use-graph-theme";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "browse", label: "Connections", icon: Network },
  { value: "tree", label: "Relationship tree", icon: ListTree },
  { value: "lineage", label: "Project lineage", icon: GitBranch },
  { value: "path", label: "How are these connected?", icon: Route },
] as const;

type GraphMode = (typeof MODES)[number]["value"];

function titleForType(type: GraphNode["type"]) {
  return GRAPH_NODE_TYPE_LABELS[type] ?? type;
}

function DepthSelect({ depth, onChange }: { depth: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      Relationship depth
      <Select value={String(depth)} onValueChange={(value) => onChange(Number(value))}>
        <SelectTrigger className="h-7 w-[180px] px-2 text-xs" aria-label="Relationship depth">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Direct connections</SelectItem>
          <SelectItem value="2">Connected ecosystem</SelectItem>
          <SelectItem value="3">Extended graph</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function ProjectGraphExplorer({ input }: { input: ProjectGraphInput }) {
  const theme = useGraphTheme();
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<GraphMode>("browse");
  const [browseView, setBrowseView] = useState<"map" | "list">("map");
  const [depth, setDepth] = useState(1);
  const [query, setQuery] = useState("");
  const [activeTypes, setActiveTypes] = useState<GraphNode["type"][]>([]);
  const [activeEdgeTypes, setActiveEdgeTypes] = useState<GraphEdgeType[]>([]);
  const [pathStart, setPathStart] = useState("");
  const [pathEnd, setPathEnd] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const graph = useMemo(() => buildProjectGraph(input), [input]);
  const projectId = `project:${input.project.id}`;
  const projectNode = useMemo(
    () => graph.nodes.find((node) => node.id === projectId),
    [graph, projectId],
  );
  const selectedNode = useMemo(
    () =>
      selectedNodeId ? (graph.nodes.find((node) => node.id === selectedNodeId) ?? null) : null,
    [graph, selectedNodeId],
  );
  const connected = useMemo(
    () => getConnectedNodes(graph, projectId, { depth, edgeTypes: activeEdgeTypes }),
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
  const timeline = useMemo(() => buildProjectTimeline(graph, projectId), [graph, projectId]);

  // Spec §45: never render every relationship at once. Connections grow
  // progressively, a density-aware page at a time, and any change to the
  // filters or depth starts the page over.
  const pageSize = Math.max(1, theme.nodeLimit * 2);
  const [visibleLimit, setVisibleLimit] = useState(pageSize);
  useEffect(() => {
    setVisibleLimit(pageSize);
  }, [pageSize, depth, query, selectedTypes]);

  if (connected.length === 0) return null;

  const shown = visible.slice(0, visibleLimit);
  const remaining = visible.length - shown.length;
  const grouped = shown.reduce<Record<string, GraphNode[]>>((groups, node) => {
    (groups[node.type] ??= []).push(node);
    return groups;
  }, {});

  function toggleType(type: GraphNode["type"]) {
    setActiveTypes((current) =>
      current.includes(type) ? current.filter((value) => value !== type) : [...current, type],
    );
  }

  const edgeFacets = useMemo(
    () =>
      Array.from(
        new Set(
          graph.edges
            .filter((edge) => edge.from === projectId || edge.to === projectId)
            .map((edge) => edge.type),
        ),
      ).sort(),
    [],
  );

  function clearFilters() {
    setQuery("");
    setActiveTypes([]);
    setActiveEdgeTypes([]);
  }

  function toggleEdgeType(type: GraphEdgeType) {
    setActiveEdgeTypes((current) =>
      current.includes(type) ? current.filter((value) => value !== type) : [...current, type],
    );
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
            {MODES.map(({ value, label, icon: Icon }) => (
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
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {mode === "lineage" ? (
            <div className="mt-4" aria-live="polite">
              <p className="text-sm text-muted-foreground">
                How this workspace came to be — its origin, milestones, contributions, imports, and
                forks, in order (spec §8 VIEW 5).
              </p>
              {timeline && timeline.entries.length > 0 ? (
                <ol className="mt-4 border-l border-border/70 pl-4">
                  {timeline.entries.map((entry) => (
                    <li key={entry.nodeId} className="relative pb-4 last:pb-0">
                      <span
                        className="absolute -left-[27px] top-0 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background"
                        aria-hidden="true"
                      >
                        <GraphNodeGlyph
                          type={PROJECT_TIMELINE_NODE_TYPE[entry.kind]}
                          className="h-3 w-3 text-muted-foreground"
                        />
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {PROJECT_TIMELINE_LABELS[entry.kind]}
                        {entry.date ? ` · ${new Date(entry.date).toLocaleDateString()}` : ""}
                      </p>
                      <p className="text-sm font-medium">{entry.title}</p>
                      {entry.description ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{entry.description}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No fork history or dated milestones yet — as work lands and projects fork, this
                  timeline builds itself.
                </p>
              )}
              {timeline && timeline.omitted > 0 ? (
                <p className="mt-3 text-xs text-muted-foreground" role="status">
                  {timeline.omitted} earlier {timeline.omitted === 1 ? "event is" : "events are"} in
                  the graph — narrow the depth or search to see the rest.
                </p>
              ) : null}
            </div>
          ) : mode === "path" ? (
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
                            <span className="flex items-center gap-2">
                              <GraphNodeGlyph
                                type={node.type}
                                className="h-3.5 w-3.5 text-muted-foreground"
                              />
                              <span>{node.label}</span>
                              <span className="text-muted-foreground">
                                · {titleForType(node.type).replace(/s$/, "")}
                              </span>
                            </span>
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
          ) : mode === "tree" ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  An accessible outline of this project's connections, with every relationship
                  spelled out.
                </p>
                <DepthSelect depth={depth} onChange={setDepth} />
              </div>
              <GraphTreeView
                graph={graph}
                rootId={projectId}
                maxDepth={depth}
                maxNodes={theme.nodeLimit * 4}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div role="group" aria-label="Browse view" className="flex items-center gap-1">
                  {(
                    [
                      { value: "map", label: "Map", icon: MapIcon },
                      { value: "list", label: "List", icon: List },
                    ] as const
                  ).map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={browseView === value}
                      onClick={() => setBrowseView(value)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                        browseView === value
                          ? "border-user-accent-border bg-accent text-foreground"
                          : "border-border/70 text-muted-foreground hover:border-border-strong hover:text-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>
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
                <DepthSelect depth={depth} onChange={setDepth} />
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

              {edgeFacets.length > 1 ? (
                <div role="group" aria-label="Filter relationships" className="mt-3 flex flex-wrap gap-1.5">
                  {edgeFacets.map((type) => {
                    const active = activeEdgeTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleEdgeType(type)}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                          active
                            ? "border-user-accent-border bg-accent text-foreground"
                            : "border-border/70 text-muted-foreground hover:border-border-strong hover:text-foreground",
                        )}
                      >
                        {type.replaceAll("_", " ")}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {filtering || activeEdgeTypes.length > 0 ? (
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
              ) : browseView === "map" ? (
                <GraphNetworkView
                  graph={graph}
                  rootId={projectId}
                  maxNodes={theme.nodeLimit * 3}
                  isMatch={(node) => filterGraphNodes([node], filter).length > 0}
                  selectedId={selectedNodeId}
                  onSelect={setSelectedNodeId}
                />
              ) : (
                <>
                  <div
                    className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3"
                    style={{ gap: theme.gap }}
                  >
                    {Object.entries(grouped).map(([type, nodes]) => (
                      <div
                        key={type}
                        className="border border-border/60 p-3"
                        style={{ borderRadius: theme.nodeRadius }}
                      >
                        <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          {titleForType(type as GraphNode["type"])}
                        </h3>
                        <ul className="mt-2 space-y-2">
                          {nodes.map((node) => (
                            <li key={node.id} className="text-sm">
                              <button
                                type="button"
                                onClick={() => setSelectedNodeId(node.id)}
                                className="w-full rounded-md px-1 py-1 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <span className="flex items-center gap-1.5">
                                  <GraphNodeGlyph
                                    type={node.type}
                                    className="shrink-0 text-muted-foreground"
                                  />
                                  <span className="font-medium">{node.label}</span>
                                </span>
                                {theme.showMetadata && node.description ? (
                                  <span className="line-clamp-2 block text-xs text-muted-foreground">
                                    {node.description}
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  {remaining > 0 ? (
                    <button
                      type="button"
                      onClick={() => setVisibleLimit((limit) => limit + pageSize)}
                      className="mt-4 text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                    >
                      Show {remaining} more {remaining === 1 ? "connection" : "connections"}
                    </button>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
      ) : null}

      <GraphNodeSheet
        graph={graph}
        node={selectedNode}
        open={selectedNode !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedNodeId(null);
        }}
        onSelectNode={setSelectedNodeId}
        onTrace={(nodeId) => {
          setMode("path");
          setPathStart(nodeId);
          setSelectedNodeId(null);
        }}
      />
    </div>
  );
}

export default ProjectGraphExplorer;
