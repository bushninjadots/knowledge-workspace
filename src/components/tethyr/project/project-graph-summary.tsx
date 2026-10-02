import { Network } from "lucide-react";
import { buildProjectGraph, type ProjectGraphInput } from "@/lib/project-graph";

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
  const graph = buildProjectGraph(input);
  const counts = graph.nodes.reduce<Record<string, number>>((result, node) => {
    result[node.type] = (result[node.type] ?? 0) + 1;
    return result;
  }, {});
  const relationships = graph.edges.length;
  const nodeLabels = new Map(graph.nodes.map((node) => [node.id, node.label]));
  const relationshipTrail = graph.edges
    .map((edge) => ({
      id: `${edge.from}-${edge.type}-${edge.to}`,
      from: nodeLabels.get(edge.from) ?? edge.from,
      to: nodeLabels.get(edge.to) ?? edge.to,
      relation: formatRelationship(edge.type),
    }))
    .slice(0, 5);

  return (
    <section
      id="project-graph"
      aria-labelledby="project-graph-heading"
      className="mt-10 scroll-mt-24 border-t border-border/60 pt-8"
    >
      <div className="flex items-start gap-3">
        <Network className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 id="project-graph-heading" className="font-display text-lg font-semibold tracking-tight">
            Connected work
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The people, skills, milestones, and resources that give this project its shape.
          </p>
        </div>
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
        {counts.milestone ? (
          <div>
            <dt className="text-muted-foreground">Milestones</dt>
            <dd className="font-medium tabular-nums">{counts.milestone}</dd>
          </div>
        ) : null}
        {counts.repository ? (
          <div>
            <dt className="text-muted-foreground">Repositories</dt>
            <dd className="font-medium tabular-nums">{counts.repository}</dd>
          </div>
        ) : null}
        {counts.project > 1 ? (
          <div>
            <dt className="text-muted-foreground">Lineage</dt>
            <dd className="font-medium tabular-nums">{counts.project - 1}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted-foreground">Relationships</dt>
          <dd className="font-medium tabular-nums">{relationships}</dd>
        </div>
      </dl>
      <div className="mt-6 border-l border-border/60 pl-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Connected through
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {relationshipTrail.map((item) => (
            <li key={item.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-medium">{item.from}</span>
              <span className="text-muted-foreground">{item.relation}</span>
              <span className="font-medium">{item.to}</span>
            </li>
          ))}
        </ul>
        {relationships > relationshipTrail.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing {relationshipTrail.length} of {relationships} relationships.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function formatRelationship(type: string) {
  return type.replaceAll("_", " ");
}
