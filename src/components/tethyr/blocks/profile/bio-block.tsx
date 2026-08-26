// ── Profile Bio Block ─────────────────────────────────────────────────────────
// Shows the profile's bio and learning goals. Simple text display.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type BioData = {
  bio: string | null;
  learning_goals: string | null;
  teaching_style: string | null;
};

function ProfileBioBlock({ context }: BlockProps) {
  const profileId = context.ownerType === "profile" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["profile-bio-block", profileId],
    queryFn: async (): Promise<BioData | null> => {
      if (!profileId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("bio, learning_goals, teaching_style")
        .eq("id", profileId)
        .maybeSingle();
      return data as unknown as BioData | null;
    },
    enabled: !!profileId,
  });

  if (isLoading) return <Skeleton className="h-16 w-full rounded-xl" />;
  if (!data) return null;

  const hasBio = data.bio && data.bio.trim().length > 0;
  const hasGoals = data.learning_goals && data.learning_goals.trim().length > 0;
  if (!hasBio && !hasGoals) {
    if (context.isEditing) {
      return (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 px-4 py-3 text-xs text-muted-foreground">
          Bio block — your bio and learning goals will appear here once set.
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-3">
      {hasBio && (
        <div>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            About
          </h4>
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{data.bio}</p>
        </div>
      )}
      {hasGoals && (
        <div>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Learning goals
          </h4>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {data.learning_goals}
          </p>
        </div>
      )}
    </div>
  );
}

registerBlock({
  type: "profile-bio",
  category: "people",
  label: "About / Bio",
  description: "The person's bio, learning goals, and teaching style.",
  icon: "FileText",
  defaults: {},
  component: ProfileBioBlock,
});

export { ProfileBioBlock };
