import { useEffect } from "react";
import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { ShipHighlights, StreakBadge } from "@/components/tethyr/ships/ship-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemberShips, useShipStreaks } from "@/hooks/use-ships";
import { weekLabel } from "@/lib/ship-log";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

/** The member's recent weekly ships, newest first, with their streak. */
function ProfileShipLogBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : undefined;
  const count = Math.min(Math.max(Number(config.count) || 4, 1), 12);
  const { data: ships, isLoading } = useMemberShips(profileId, count);
  const { data: streaks } = useShipStreaks(profileId ? [profileId] : []);
  const hasContent = (ships?.length ?? 0) > 0;

  useEffect(() => {
    if (isLoading || !blockId) return;
    onBlockEmptyChange?.(blockId, !hasContent);
  }, [blockId, hasContent, isEditing, isLoading, onBlockEmptyChange]);

  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!ships || !hasContent) {
    return isEditing ? (
      <BlockEmptyState
        label="Ship log"
        detail="Post what you shipped each week in the Ship log. Your recent weeks and streak show up here."
      />
    ) : null;
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <BlockTitle config={config}>Ship log</BlockTitle>
        <StreakBadge streak={profileId ? streaks?.[profileId] : undefined} />
      </div>
      <ol className="mt-2 space-y-4">
        {ships.map((ship) => (
          <li key={ship.id} className="border-l-2 border-border pl-3">
            <p className="text-xs font-medium text-muted-foreground">
              {weekLabel(ship.week_start)}
            </p>
            <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-line">
              {ship.body}
            </p>
            {config.showLinks !== false && ship.highlights.length > 0 && (
              <div className="mt-2">
                <ShipHighlights highlights={ship.highlights} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

registerBlock({
  type: "profile-ship-log",
  category: "work",
  label: "Ship log",
  title: "Ship log",
  description: "What you shipped each week, with your streak.",
  icon: "Rocket",
  defaults: { count: "4", showLinks: true },
  fields: [
    {
      key: "count",
      label: "Weeks to show",
      type: "select",
      options: [
        { label: "4", value: "4" },
        { label: "8", value: "8" },
        { label: "12", value: "12" },
      ],
    },
    { key: "showLinks", label: "Show GitHub links", type: "toggle" },
  ],
  component: ProfileShipLogBlock,
});

export { ProfileShipLogBlock };
