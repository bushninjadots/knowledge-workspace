import { Network } from "lucide-react";
import { useSpaceMembers } from "@/hooks/use-space-members";
import {
  buildCommunityGraph,
  getCommunityGraphCounts,
  communityGraphHasConnections,
  type CommunityGraphInput,
} from "@/lib/community-graph";

/**
 * Phase 7 of the Tethyr Graph spec — a compact graph summary for community
 * spaces. Shows the people and discussions that give a space its shape.
 *
 * Hides entirely when the space has no members or discussions (the spec's
 * empty-state rule: the graph earns its place, it does not report emptiness).
 */
export function CommunityGraphSummary({
  space,
  posts,
}: {
  space: { id: string; name: string; description?: string | null };
  posts: { id: string; title?: string; content?: string; author_id?: string }[];
}) {
  const { data: members = [] } = useSpaceMembers(space.id);

  const discussions = (posts ?? [])
    .filter((p) => p.title || p.content)
    .slice(0, 12)
    .map((p) => ({
      id: p.id,
      title: p.title || (p.content ?? "").slice(0, 60) || "Untitled",
      author_id: p.author_id ?? null,
    }));

  const input: CommunityGraphInput = {
    space: { id: space.id, name: space.name, description: space.description },
    members: members.map((m) => ({
      user_id: m.user_id,
      role: m.role,
      profile: m.profile
        ? { display_name: m.profile.display_name, handle: m.profile.handle }
        : null,
    })),
    discussions,
  };

  const graph = buildCommunityGraph(input);
  if (!communityGraphHasConnections(graph)) return null;

  const counts = getCommunityGraphCounts(graph);
  const connectedNodes = graph.nodes.filter((n) => n.type !== "community").slice(0, 12);

  return (
    <section
      aria-labelledby="community-graph-heading"
      className="mt-4 rounded-xl bg-surface-elevated/30 p-4"
    >
      <div className="flex items-start gap-3">
        <Network className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h3 id="community-graph-heading" className="font-display text-sm font-semibold">
            {space.name} in the graph
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The people and conversations connected through this space.
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
        {counts.discussion ? (
          <div>
            <dt className="text-muted-foreground">Discussions</dt>
            <dd className="font-medium tabular-nums">{counts.discussion}</dd>
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
    </section>
  );
}
