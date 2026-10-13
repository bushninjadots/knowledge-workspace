import { useEffect } from "react";
import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { CommunityHelpBody } from "@/components/tethyr/profile/community-help";
import { Skeleton } from "@/components/ui/skeleton";
import { hasHelped, useHelpSummary } from "@/hooks/use-community-help";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

/** Solutions and thanks from the community, as proof on the Studio. */
function ProfileCommunityHelpBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : null;
  const { data: summary, isLoading } = useHelpSummary(profileId);
  const hasContent = hasHelped(summary);

  useEffect(() => {
    if (isLoading || !blockId) return;
    onBlockEmptyChange?.(blockId, !hasContent);
  }, [blockId, hasContent, isEditing, isLoading, onBlockEmptyChange]);

  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!summary || !hasContent) {
    return isEditing ? (
      <BlockEmptyState
        label="Community help"
        detail="Answer questions in Community. Replies marked as the solution, and thanks people leave, show up here."
      />
    ) : null;
  }
  return (
    <div>
      <BlockTitle config={config}>Community help</BlockTitle>
      <CommunityHelpBody
        summary={summary}
        showSkills={config.showSkills !== false}
        showThanks={config.showThanks !== false}
      />
    </div>
  );
}

registerBlock({
  type: "profile-community-help",
  category: "work",
  label: "Community help",
  title: "Community help",
  description: "Solutions and thanks from people you've helped in Community.",
  icon: "HeartHandshake",
  defaults: { showSkills: true, showThanks: true },
  fields: [
    { key: "showSkills", label: "Show skills helped with", type: "toggle" },
    { key: "showThanks", label: "Show recent thanks", type: "toggle" },
  ],
  component: ProfileCommunityHelpBlock,
});

export { ProfileCommunityHelpBlock };
