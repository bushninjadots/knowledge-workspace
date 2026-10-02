import { Network } from "lucide-react";
import { createGraphEdge, createGraphNode, normalizeGraph } from "@/lib/graph-model";

export function SkillGraphSummary({
  skillName,
  peopleCount,
  projectCount,
  relatedSkills,
}: {
  skillName: string;
  peopleCount: number;
  projectCount: number;
  relatedSkills: string[];
}) {
  const skillId = `skill:${skillName.trim().toLowerCase()}`;
  const nodes = [
    createGraphNode({ id: skillId, type: "skill", label: skillName }),
    ...(peopleCount > 0
      ? [
          createGraphNode({
            id: `${skillId}:people`,
            type: "person",
            label: `${peopleCount} people`,
          }),
        ]
      : []),
    ...(projectCount > 0
      ? [
          createGraphNode({
            id: `${skillId}:projects`,
            type: "project",
            label: `${projectCount} projects`,
          }),
        ]
      : []),
    ...relatedSkills.map((name) =>
      createGraphNode({ id: `skill:${name.trim().toLowerCase()}`, type: "skill", label: name }),
    ),
  ];
  const edges = [
    ...(peopleCount > 0
      ? [createGraphEdge({ type: "demonstrated_skill", from: `${skillId}:people`, to: skillId })]
      : []),
    ...(projectCount > 0
      ? [createGraphEdge({ type: "used_in", from: skillId, to: `${skillId}:projects` })]
      : []),
    ...relatedSkills.map((name) =>
      createGraphEdge({
        type: "related_to",
        from: skillId,
        to: `skill:${name.trim().toLowerCase()}`,
      }),
    ),
  ];
  const graph = normalizeGraph({ nodes, edges });
  const connected = graph.nodes.filter((node) => node.id !== skillId);
  if (connected.length === 0) return null;

  return (
    <section
      aria-labelledby="skill-graph-heading"
      className="rounded-xl bg-surface-elevated/30 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <Network className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h3 id="skill-graph-heading" className="font-display text-lg font-semibold">
            {skillName} in the graph
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Demonstrated through work, connected to people, projects, and related skills.
          </p>
        </div>
      </div>
      <div
        className="mt-4 flex flex-wrap items-center gap-2"
        aria-label={`${skillName} graph connections`}
      >
        <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
          {skillName}
        </span>
        {connected.map((node) => (
          <span
            key={node.id}
            className="rounded-full border border-border/60 bg-surface-elevated px-3 py-1.5 text-xs text-foreground"
          >
            {node.label}
          </span>
        ))}
      </div>
    </section>
  );
}
