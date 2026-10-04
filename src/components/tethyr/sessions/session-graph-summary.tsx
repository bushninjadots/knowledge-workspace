import { Network } from "lucide-react";
import {
  buildSessionGraph,
  getSessionGraphCounts,
  sessionGraphHasConnections,
  type SessionGraphInput,
} from "@/lib/session-graph";
import { GraphTreeView } from "@/components/tethyr/graph/graph-tree-view";
import { GraphNodeGlyph } from "@/components/tethyr/graph/graph-node-glyph";

/**
 * Phase 7 of the Tethyr Graph spec — a compact graph summary for sessions.
 * Shows the people, skill, project, and community that connect a session to
 * the wider Tethyr network.
 *
 * Hides entirely when the session has no connections beyond itself (the spec's
 * empty-state rule: the graph earns its place, it does not report emptiness).
 */
export function SessionGraphSummary({ input }: { input: SessionGraphInput }) {
  const graph = buildSessionGraph(input);
  if (!sessionGraphHasConnections(graph)) return null;

  const counts = getSessionGraphCounts(graph);
  const connectedNodes = graph.nodes.filter((n) => n.type !== "session").slice(0, 12);

  return (
    <section
      aria-labelledby="session-graph-heading"
      className="mt-6 border-t border-border/60 pt-6"
    >
      <div className="flex items-start gap-3">
        <Network className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h3 id="session-graph-heading" className="font-display text-sm font-semibold">
            In the graph
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How this session connects to people, skills, and projects across Tethyr.
          </p>
        </div>
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {counts.person ? (
          <div>
            <dt className="text-muted-foreground">People</dt>
            <dd className="font-medium tabular-nums">{counts.person}</dd>
          </div>
        ) : null}
        {counts.skill ? (
          <div>
            <dt className="text-muted-foreground">Skills</dt>
            <dd className="font-medium tabular-nums">{counts.skill}</dd>
          </div>
        ) : null}
        {counts.project ? (
          <div>
            <dt className="text-muted-foreground">Projects</dt>
            <dd className="font-medium tabular-nums">{counts.project}</dd>
          </div>
        ) : null}
        {counts.community ? (
          <div>
            <dt className="text-muted-foreground">Communities</dt>
            <dd className="font-medium tabular-nums">{counts.community}</dd>
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
            <GraphNodeGlyph
              type={node.type}
              className="mr-1 inline align-[-2px] text-muted-foreground"
            />
            <span className="text-muted-foreground">{node.type.replace("_", " ")}</span>{" "}
            <span className="font-medium">{node.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <h4 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Connections outline
        </h4>
        <GraphTreeView graph={graph} rootId={`session:${input.session.id}`} />
      </div>
    </section>
  );
}
