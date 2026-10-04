import { Network } from "lucide-react";
import { useProfileWork } from "@/hooks/use-profile-work";
import { useGraphTheme } from "@/hooks/use-graph-theme";
import { GraphTreeView } from "@/components/tethyr/graph/graph-tree-view";
import { GraphNodeGlyph } from "@/components/tethyr/graph/graph-node-glyph";
import {
  buildProfileGraph,
  getProfileCollaborators,
  getProfileGraphCounts,
} from "@/lib/profile-graph";

/**
 * Phase 3 of the Tethyr Graph spec — a compact "Work graph" summary on the
 * public profile. Shows the projects, collaborators, and connections that
 * give a person's work its shape, derived from the same `useProfileWork`
 * evidence the work section already reads.
 *
 * Hides entirely when there is no work (the spec's empty-state rule: the graph
 * earns its place, it does not report emptiness).
 */
export function ProfileGraphSummary({ profileId, name }: { profileId: string; name: string }) {
  const theme = useGraphTheme();
  const { data, isLoading } = useProfileWork(profileId);
  if (isLoading || !data?.hasWork) return null;

  const graph = buildProfileGraph({
    profile: { id: profileId, displayName: name },
    projects: data.projects.map((project) => ({
      id: project.id,
      title: project.title,
      role: project.role,
      description: project.description,
      status: project.status,
    })),
    collaborators: data.collaborators.map((collaborator) => ({
      profile_id: collaborator.profile_id,
      display_name: collaborator.profile?.display_name,
      handle: collaborator.profile?.handle,
      sharedProjectCount: collaborator.sharedProjectCount,
    })),
  });

  const counts = getProfileGraphCounts(graph);
  const projectCount = counts.project ?? 0;
  const collaboratorCount = counts.person ? counts.person - 1 : 0; // subtract self
  const relationships = graph.edges.length;
  const collaborators = getProfileCollaborators(graph);

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
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
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
          <dd className="font-medium tabular-nums">{collaboratorCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Connections</dt>
          <dd className="font-medium tabular-nums">{relationships}</dd>
        </div>
      </dl>
      <div className="mt-5 grid sm:grid-cols-2" style={{ gap: theme.gap }}>
        <div>
          <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Connected projects
          </h3>
          <ul
            className="mt-2 flex flex-wrap"
            style={{ gap: theme.gap }}
            aria-label="Connected projects"
          >
            {graph.nodes
              .filter((node) => node.type === "project")
              .slice(0, theme.nodeLimit)
              .map((node) => (
                <li
                  key={node.id}
                  className="border border-border/70 px-2.5 py-1 text-xs"
                  style={{ borderRadius: theme.nodeRadius }}
                >
                  <GraphNodeGlyph
                    type={node.type}
                    className="mr-1 inline align-[-2px] text-muted-foreground"
                  />
                  <span className="text-muted-foreground">
                    {String(node.metadata?.role ?? "contributed")}
                  </span>{" "}
                  <span className="font-medium">{node.label}</span>
                </li>
              ))}
          </ul>
        </div>
        {collaborators.length > 0 && (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Builds with
            </h3>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2" aria-label="Collaborators">
              {collaborators.map((collaborator) => (
                <li key={collaborator.id} className="text-sm">
                  <span className="font-medium">{collaborator.label}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    {String(collaborator.metadata?.sharedProjectCount ?? 1)} shared{" "}
                    {Number(collaborator.metadata?.sharedProjectCount ?? 1) === 1
                      ? "project"
                      : "projects"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="mt-6">
        <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Connections outline
        </h3>
        <GraphTreeView graph={graph} rootId={`person:${profileId}`} maxDepth={2} maxNodes={40} />
        <p className="mt-2 text-xs text-muted-foreground">
          Every connection above is also described in words — the work graph reads the same with or
          without its visual layer.
        </p>
      </div>
    </section>
  );
}
