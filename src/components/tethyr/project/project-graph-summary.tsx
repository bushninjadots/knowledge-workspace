import { Network } from "lucide-react";
import { buildProjectGraph, type ProjectGraphInput } from "@/lib/project-graph";

export function ProjectGraphSummary({ input }: { input: ProjectGraphInput }) {
  const graph = buildProjectGraph(input);
  const counts = graph.nodes.reduce<Record<string, number>>((result, node) => {
    result[node.type] = (result[node.type] ?? 0) + 1;
    return result;
  }, {});
  const relationships = graph.edges.length;

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
          <dt className="text-muted-foreground">Nodes</dt>
          <dd className="font-medium tabular-nums">{graph.nodes.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Relationships</dt>
          <dd className="font-medium tabular-nums">{relationships}</dd>
        </div>
        {Object.entries(counts)
          .filter(([type]) => type !== "project")
          .slice(0, 4)
          .map(([type, count]) => (
            <div key={type}>
              <dt className="capitalize text-muted-foreground">{type.replaceAll("_", " ")}</dt>
              <dd className="font-medium tabular-nums">{count}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}
