import { Network } from "lucide-react";
import { useProfileWork } from "@/hooks/use-profile-work";
import { createGraphEdge, createGraphNode, normalizeGraph } from "@/lib/graph-model";

export function ProfileGraphSummary({ profileId, name }: { profileId: string; name: string }) {
  const { data, isLoading } = useProfileWork(profileId);
  if (isLoading || !data?.hasWork) return null;

  const personId = `person:${profileId}`;
  const nodes = [createGraphNode({ id: personId, type: "person", label: name })];
  const edges = [];
  for (const project of data.projects) {
    const projectId = `project:${project.id}`;
    nodes.push(
      createGraphNode({
        id: projectId,
        type: "project",
        label: project.title,
        description: project.description ?? undefined,
        metadata: { status: project.status, role: project.role },
      }),
    );
    edges.push(
      createGraphEdge({
        type: project.role === "creator" ? "produced" : "contributed_to",
        from: personId,
        to: projectId,
        metadata: { role: project.role },
      }),
    );
  }
  const graph = normalizeGraph({ nodes, edges });
  const projectCount = graph.nodes.filter((node) => node.type === "project").length;
  const collaborators = data.collaborators.length;

  return (
    <section aria-labelledby="profile-graph-heading" className="mt-12 border-t border-border pt-8">
      <div className="flex items-start gap-3">
        <Network className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2
            id="profile-graph-heading"
            className="font-display text-lg font-semibold tracking-tight"
          >
            Work graph
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The work and people connected through {name}&apos;s contributions.
          </p>
        </div>
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Projects</dt>
          <dd className="font-medium tabular-nums">{projectCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Collaborators</dt>
          <dd className="font-medium tabular-nums">{collaborators}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Connections</dt>
          <dd className="font-medium tabular-nums">{graph.edges.length}</dd>
        </div>
      </dl>
      <ul aria-label="Connected projects" className="mt-5 flex flex-wrap gap-2">
        {graph.nodes
          .filter((node) => node.type === "project")
          .map((node) => (
            <li key={node.id} className="border border-border/70 px-2.5 py-1 text-xs">
              <span className="text-muted-foreground">
                {String(node.metadata?.role ?? "contributed")}
              </span>{" "}
              <span className="font-medium">{node.label}</span>
            </li>
          ))}
      </ul>
    </section>
  );
}
