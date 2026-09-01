// ── Profile Bio Block ─────────────────────────────────────────────────────────
// Shows the profile's bio and learning goals. Simple text display.
// `learning_goals` is owned by the Direction block; this block shows bio only.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type BioData = {
  bio: string | null;
};

function ProfileBioBlock({ config, context }: BlockProps) {
  const profileId = context.ownerType === "profile" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["profile-bio-block", profileId],
    queryFn: async (): Promise<BioData | null> => {
      if (!profileId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("bio")
        .eq("id", profileId)
        .maybeSingle();
      return data as unknown as BioData | null;
    },
    enabled: !!profileId,
  });

  if (isLoading) return <Skeleton className="h-16 w-full rounded-xl" />;
  if (!data) return null;

  const hasBio = data.bio && data.bio.trim().length > 0;
  if (!hasBio) {
    if (context.isEditing) {
      return (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 px-4 py-3 text-xs text-muted-foreground">
          Bio block — your bio will appear here once set.
        </div>
      );
    }
    return null;
  }

  if (config.showAbout === false) return null;

  return (
    <div>
      <h4 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        About
      </h4>
      <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{data.bio}</p>
    </div>
  );
}

registerBlock({
  type: "profile-bio",
  category: "people",
  label: "About / Bio",
  description: "The person's bio.",
  icon: "FileText",
  defaults: { showAbout: true },
  fields: [{ key: "showAbout", label: "Show bio", type: "toggle" }],
  component: ProfileBioBlock,
});

export { ProfileBioBlock };
