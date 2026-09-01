import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type ExpData = {
  years_experience: number | null;
  teaching_style: string | null;
};

function ProfileExperienceBlock({ config, context }: BlockProps) {
  const profileId = context.ownerType === "profile" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["profile-experience-block", profileId],
    queryFn: async (): Promise<ExpData | null> => {
      if (!profileId) return null;
      const { data: d } = await supabase
        .from("profiles")
        .select("years_experience, teaching_style")
        .eq("id", profileId)
        .maybeSingle();
      return d as unknown as ExpData | null;
    },
    enabled: !!profileId,
  });

  if (isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;
  if (!data) {
    if (context.isEditing)
      return <BlockEmptyState label="Experience" detail="Experience details will appear here." />;
    return null;
  }
  const showYears = config.showYears !== false;
  const showStyle = config.showTeachingStyle !== false;
  const hasExp = showYears && data.years_experience != null;
  const hasStyle = showStyle && !!data.teaching_style;
  if (!hasExp && !hasStyle) {
    if (context.isEditing)
      return (
        <BlockEmptyState label="Experience" detail="Add experience details to your profile." />
      );
    return null;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Experience
      </h4>
      <div className="grid gap-3 sm:grid-cols-2">
        {hasExp && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3">
            <Star className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Experience</p>
              <p className="text-sm font-medium">{data.years_experience} years</p>
            </div>
          </div>
        )}
      </div>
      {hasStyle && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Teaching style:</span> {data.teaching_style}
        </p>
      )}
    </div>
  );
}

registerBlock({
  type: "profile-experience",
  category: "people",
  label: "Experience",
  description: "Years of experience and teaching style.",
  icon: "Briefcase",
  defaults: { showYears: true, showTeachingStyle: true },
  fields: [
    { key: "showYears", label: "Show years of experience", type: "toggle" },
    { key: "showTeachingStyle", label: "Show teaching style", type: "toggle" },
  ],
  component: ProfileExperienceBlock,
});
export { ProfileExperienceBlock };
