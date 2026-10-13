import { ChevronDown, Network } from "lucide-react";
import { useSpaceMembers } from "@/hooks/use-space-members";
import {
  buildCommunityGraph,
  getCommunityGraphCounts,
  communityGraphHasConnections,
  type CommunityGraphInput,
} from "@/lib/community-graph";
import { GraphTreeView } from "@/components/tethyr/graph/graph-tree-view";
import { GraphNodeGlyph } from "@/components/tethyr/graph/graph-node-glyph";

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

  // Collapsed by default: the room's conversation comes first; who's in it
  // and how it connects is one click away.
  return (
    <details className="group mb-5 rounded-xl bg-surface-elevated/30 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors hover:bg-surface-elevated/40">
        <Network className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium">Who&apos;s here</span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {[
            counts.person ? `${counts.person} ${counts.person === 1 ? "person" : "people"}` : null,
            counts.discussion
              ? `${counts.discussion} discussion${counts.discussion === 1 ? "" : "s"}`
              : null,
            `${graph.edges.length} connection${graph.edges.length === 1 ? "" : "s"}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="px-4 pb-4">
        <ul aria-label="Connected nodes" className="flex flex-wrap gap-1.5">
          {connectedNodes.map((node) => (
            <li
              key={node.id}
              className="rounded-full border border-border/70 px-2 py-0.5 text-[11px]"
            >
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
          <GraphTreeView graph={graph} rootId={`community:${space.id}`} />
        </div>
      </div>
    </details>
  );
}
