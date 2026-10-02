import { Network } from "lucide-react";
import { buildProjectGraph, type ProjectGraphInput } from "@/lib/project-graph";
import { ProjectGraphExplorer } from "./project-graph-explorer";

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
  const connectedNodes = graph.nodes
    .filter((node) => node.id !== `project:${input.project.id}`)
    .slice(0, 12);
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
      <div className="flex items-start gap-3">
        <Network className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2
            id="project-graph-heading"
            className="font-display text-lg font-semibold tracking-tight"
          >
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
      <ul aria-label="Connected nodes" className="mt-5 flex flex-wrap gap-2">
        {connectedNodes.map((node) => (
          <li key={node.id} className="border border-border/70 px-2.5 py-1 text-xs">
            <span className="text-muted-foreground">{node.type.replace("_", " ")}</span>{" "}
            <span className="font-medium">{node.label}</span>
          </li>
        ))}
      </ul>
      <ProjectGraphExplorer input={input} />
    </section>
  );
}
