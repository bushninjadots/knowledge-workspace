import { Network } from "lucide-react";
import {
  buildLibraryGraph,
  getLibraryGraphCounts,
  libraryGraphHasConnections,
  type LibraryGraphInput,
} from "@/lib/library-graph";
import { GraphTreeView } from "@/components/tethyr/graph/graph-tree-view";

/**
 * Phase 7 of the Tethyr Graph spec — a compact graph summary for library
 * items. Shows the project, owner, tags, and GitHub source that connect a
 * note or resource to the wider Tethyr network.
 *
 * Hides entirely when the item has no connections (the spec's empty-state rule).
 */
export function LibraryGraphSummary({ input }: { input: LibraryGraphInput }) {
  const graph = buildLibraryGraph(input);
  if (!libraryGraphHasConnections(graph)) return null;

  const counts = getLibraryGraphCounts(graph);
  const connectedNodes = graph.nodes.filter((n) => n.type !== "library_item").slice(0, 10);

  return (
    <section
      aria-labelledby="library-graph-heading"
      className="mt-6 border-t border-border/60 pt-6"
    >
      <div className="flex items-start gap-3">
        <Network className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h3 id="library-graph-heading" className="font-display text-sm font-semibold">
            In the graph
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How this item connects to projects, people, and knowledge across Tethyr.
          </p>
        </div>
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {counts.project ? (
          <div>
            <dt className="text-muted-foreground">Projects</dt>
            <dd className="font-medium tabular-nums">{counts.project}</dd>
          </div>
        ) : null}
        {counts.person ? (
          <div>
            <dt className="text-muted-foreground">People</dt>
            <dd className="font-medium tabular-nums">{counts.person}</dd>
          </div>
        ) : null}
        {counts.knowledge ? (
          <div>
            <dt className="text-muted-foreground">Tags</dt>
            <dd className="font-medium tabular-nums">{counts.knowledge}</dd>
          </div>
        ) : null}
        {counts.repository ? (
          <div>
            <dt className="text-muted-foreground">Repositories</dt>
            <dd className="font-medium tabular-nums">{counts.repository}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted-foreground">Relationships</dt>
          <dd className="font-medium tabular-nums">{graph.edges.length}</dd>
        </div>
      </dl>
      <ul aria-label="Connected nodes" className="mt-3 flex flex-wrap gap-1.5">
        {connectedNodes.map((node) => (
          <li key={node.id} className="border border-border/70 px-2 py-0.5 text-[11px]">
            <span className="text-muted-foreground">{node.type.replace("_", " ")}</span>{" "}
            <span className="font-medium">{node.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <h4 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Connections outline
        </h4>
        <GraphTreeView graph={graph} rootId={`library_item:${input.item.id}`} />
      </div>
    </section>
  );
}
