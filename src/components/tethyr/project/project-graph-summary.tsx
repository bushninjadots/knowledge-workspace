// "How it connects": the project's Tether — everyone and everything it's tied
// to, swinging around it — with the full view one click away (/tether).
import { useMemo } from "react";
import { buildProjectGraph, type ProjectGraphInput } from "@/lib/project-graph";
import { projectTetherNodes } from "@/lib/tether-data";
import { TetherPanel } from "@/components/tethyr/tether/tether-panel";

/** The project itself plus at least one other node — otherwise the section
 *  would only show a project tied to itself, so it hides. */
export function isMeaningfulProjectGraph(input: ProjectGraphInput): boolean {
  return buildProjectGraph(input).nodes.length > 1;
}

export function ProjectGraphSummary({ input }: { input: ProjectGraphInput }) {
  const nodes = useMemo(
    () => projectTetherNodes(buildProjectGraph(input), input.project.id),
    [input],
  );
  if (nodes.length === 0) return null;
  return (
    <section
      id="project-graph"
      aria-labelledby="project-graph-heading"
      className="mt-10 scroll-mt-24 border-t border-border/60 pt-8"
    >
      <h2 id="project-graph-heading" className="font-display text-lg font-semibold tracking-tight">
        How it connects
      </h2>
      <p className="mt-1 mb-5 max-w-2xl text-sm text-muted-foreground">
        Everyone and everything this project is tied to. Hover a ball to see its tether, click for
        details.
      </p>
      <TetherPanel
        nodes={nodes}
        centerLabel={input.project.title}
        centerSub="project"
        compact
        fullHref={{ to: "/tether", search: { project: input.project.id } }}
      />
    </section>
  );
}
