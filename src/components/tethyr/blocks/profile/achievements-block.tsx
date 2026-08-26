import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Award } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { ACHIEVEMENTS, type AchievementType } from "@/lib/reputation";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type AchieveRow = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  awarded_at: string;
};

function ProfileAchievementsBlock({ context }: BlockProps) {
  const profileId = context.ownerType === "profile" ? context.ownerId : null;
  const { data, isLoading } = useQuery({
    queryKey: ["profile-achievements-block", profileId],
    queryFn: async () => {
      if (!profileId) return [] as AchieveRow[];
      // Badges live in user_achievements (achievement enum + awarded_at).
      const { data: d } = await supabase
        .from("user_achievements")
        .select("achievement, awarded_at")
        .eq("profile_id", profileId)
        .order("awarded_at", { ascending: false })
        .limit(12);
      return ((d ?? []) as { achievement: AchievementType; awarded_at: string }[]).map((a, i) => {
        const def = ACHIEVEMENTS.find((x) => x.type === a.achievement);
        return {
          id: `${profileId}-${i}`,
          type: a.achievement,
          title: def?.label ?? a.achievement,
          description: def?.description ?? null,
          awarded_at: a.awarded_at,
        };
      });
    },
    enabled: !!profileId,
  });
  if (isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;
  if (!data?.length) {
    if (context.isEditing)
      return (
        <BlockEmptyState
          label="Achievements"
          detail="Achievements will appear here as you contribute."
        />
      );
    return null;
  }
  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-foreground">Achievements ({data.length})</h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {data.map((a) => (
          <div
            key={a.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3"
          >
            <div className="mt-0.5 rounded-full bg-trust-subtle p-1.5">
              <Award className="h-4 w-4 text-trust" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{a.title}</p>
              {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">
                {new Date(a.awarded_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
registerBlock({
  type: "profile-achievements",
  category: "people",
  label: "Achievements",
  description: "Badges, trophies, and milestones earned.",
  icon: "Award",
  defaults: {},
  component: ProfileAchievementsBlock,
});
export { ProfileAchievementsBlock };
