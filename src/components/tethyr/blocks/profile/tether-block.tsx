import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { TetherPanel } from "@/components/tethyr/tether/tether-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemberTether } from "@/hooks/use-tether";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

/** The member's Tether: every project, person, skill, crew and repo they're
 *  tied to, as a tetherball that grows with their work. Refreshes itself. */
function ProfileTetherBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : undefined;
  const { data: nodes, isLoading } = useMemberTether(profileId);
  const { data: owner } = useQuery({
    queryKey: ["tether-owner", profileId ?? ""],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, handle, creator_title")
        .eq("id", profileId!)
        .maybeSingle();
      return data;
    },
    enabled: !!profileId,
    staleTime: 5 * 60_000,
  });
  const hasContent = (nodes?.length ?? 0) > 0;

  useEffect(() => {
    if (isLoading || !blockId) return;
    onBlockEmptyChange?.(blockId, !hasContent);
  }, [blockId, hasContent, isEditing, isLoading, onBlockEmptyChange]);

  if (isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;
  if (!nodes || !hasContent) {
    return isEditing ? (
      <BlockEmptyState
        label="The Tether"
        detail="Your projects, the people you build with, skills, crews and repos — drawn as a tetherball that grows with your work. Start a project or add skills to see it."
      />
    ) : null;
  }
  return (
    <div>
      <BlockTitle config={config}>The Tether</BlockTitle>
      <TetherPanel
        nodes={nodes}
        centerLabel={owner?.display_name || owner?.handle || "Me"}
        centerSub={owner?.creator_title ?? undefined}
        compact
        showNames={config.showNames === true}
        fullHref={{ to: "/tether", search: { member: owner?.handle ?? profileId } }}
      />
    </div>
  );
}

registerBlock({
  type: "profile-tether",
  category: "work",
  label: "The Tether",
  title: "The Tether",
  description:
    "Everything you're tied to — projects, people, skills, crews, repos — as a living tetherball that grows with your work.",
  icon: "Orbit",
  defaults: { showNames: false },
  fields: [{ key: "showNames", label: "Always show names", type: "toggle" }],
  component: ProfileTetherBlock,
});

export { ProfileTetherBlock };
