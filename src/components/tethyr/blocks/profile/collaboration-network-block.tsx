import { useEffect } from "react";
import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { Link } from "@tanstack/react-router";
import { Network } from "lucide-react";
import { registerBlock } from "@/lib/block-registry";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { useProfileWorkSummary } from "@/hooks/use-profile-work-summary";
import type { BlockProps } from "@/lib/page-blocks";

// The people this profile has shared projects with, most shared first. Empty
// networks render nothing publicly instead of sample rows.
function ProfileCollaborationNetworkBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : null;
  const { data, isLoading } = useProfileWorkSummary(profileId);
  const configuredLimit = Number(config.limit);
  const limit = Number.isFinite(configuredLimit) ? Math.min(Math.max(configuredLimit, 3), 6) : 4;
  const people = (data?.collaborators ?? []).slice(0, limit);
  const showShared = config.showSharedProjects !== false;

  useEffect(() => {
    if (isLoading || !blockId) return;
    onBlockEmptyChange?.(blockId, people.length === 0);
  }, [blockId, people.length, isEditing, isLoading, onBlockEmptyChange]);

  if (isLoading) return null;
  if (people.length === 0) {
    return isEditing ? (
      <BlockEmptyState
        label="Collaboration network"
        detail="People you build projects with appear here, ranked by the work you share."
      />
    ) : null;
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Collaboration network">
      <BlockTitle config={config} icon={<Network aria-hidden />}>
        Collaboration network
      </BlockTitle>
      <ul className="flex flex-col gap-2">
        {people.map((person) => (
          <li
            key={person.profileId}
            className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0 last:pb-0"
          >
            {person.handle ? (
              <Link
                to="/u/$handle"
                params={{ handle: person.handle }}
                className="min-w-0 truncate text-foreground hover:underline"
              >
                {person.name}
              </Link>
            ) : (
              <span className="min-w-0 truncate text-foreground">{person.name}</span>
            )}
            {showShared && (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {person.sharedProjects} shared{" "}
                {person.sharedProjects === 1 ? "project" : "projects"}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Connections shown through shared work, not follower counts.
      </p>
    </section>
  );
}

registerBlock({
  type: "profile-collaboration-network",
  category: "network",
  label: "Collaboration network",
  title: "Collaboration network",
  description: "Show the people and work connected through real collaboration.",
  icon: "Network",
  contentSource: "data",
  defaults: { showSharedProjects: true, limit: "4" },
  fields: [
    { key: "showSharedProjects", label: "Show shared project counts", type: "toggle" },
    {
      key: "limit",
      label: "People shown",
      type: "select",
      options: [
        { label: "3", value: "3" },
        { label: "4", value: "4" },
        { label: "6", value: "6" },
      ],
    },
  ],
  component: ProfileCollaborationNetworkBlock,
});

export { ProfileCollaborationNetworkBlock };
