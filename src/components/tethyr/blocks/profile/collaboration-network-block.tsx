import { Network } from "lucide-react";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

function ProfileCollaborationNetworkBlock({ config }: BlockProps) {
  const people = Array.isArray(config.people)
    ? config.people.filter((item): item is string => typeof item === "string")
    : ["People you have built with", "Shared projects", "Shared sessions"];
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Collaboration network">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Network className="size-4 text-primary" />
        Collaboration network
      </div>
      <div className="flex flex-col gap-2">
        {people.slice(0, 4).map((person, index) => (
          <div
            key={`${person}-${index}`}
            className="flex items-center gap-3 border-b border-border/60 pb-2 text-sm text-muted-foreground last:border-0 last:pb-0"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
              {index + 1}
            </span>
            <span>{person}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Connections shown through shared work, not follower counts.
      </p>
    </section>
  );
}

registerBlock({
  type: "profile-collaboration-network",
  category: "community",
  label: "Collaboration network",
  description: "Show the people and work connected through real collaboration.",
  icon: "Network",
  contentSource: "data",
  defaults: { showSharedProjects: true, showSharedSessions: true, limit: "4" },
  fields: [
    { key: "showSharedProjects", label: "Show shared projects", type: "toggle" },
    { key: "showSharedSessions", label: "Show shared sessions", type: "toggle" },
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
