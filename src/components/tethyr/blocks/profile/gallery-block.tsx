import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Image, Camera } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type EvidenceItem = {
  id: string;
  title: string;
  kind: string;
  url: string | null;
  created_at: string;
};

function ProfileGalleryBlock({ config, context }: BlockProps) {
  const profileId = context.ownerType === "profile" ? context.ownerId : null;
  const { data, isLoading } = useQuery({
    queryKey: ["profile-gallery-block", profileId],
    queryFn: async () => {
      if (!profileId) return [] as EvidenceItem[];
      // The profile's evidence shelf is a jsonb array on profiles — the same
      // data the "Evidence shelf" section on the public Studio renders.
      const { data: profile } = await supabase
        .from("profiles")
        .select("evidence_shelf")
        .eq("id", profileId)
        .maybeSingle();
      const shelf = (profile?.evidence_shelf ?? []) as unknown as {
        project_id: string;
        title: string;
        note?: string | null;
        url?: string | null;
        kind?: string;
      }[];
      return shelf
        .filter((e) => e.kind === "image" || e.kind === "video")
        .map((e, i): EvidenceItem => ({
          id: `${profileId}-${i}`,
          title: e.title,
          kind: e.kind ?? "image",
          url: e.url ?? null,
          created_at: "",
        }));
    },
    enabled: !!profileId,
  });
  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;
  if (!data?.length) {
    if (context.isEditing)
      return (
        <BlockEmptyState
          label="Gallery"
          detail="Images and videos you share as evidence will appear here."
        />
      );
    return null;
  }
  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-foreground">Gallery ({data.length})</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {data.map((item) => (
          <div
            key={item.id}
            className="group relative aspect-square overflow-hidden rounded-lg bg-surface-sunken"
          >
            {item.url ? (
              <img
                src={item.url}
                alt={item.title}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                {item.kind === "video" ? (
                  <Camera className="h-6 w-6 text-muted-foreground" />
                ) : (
                  <Image className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            )}
            {config.showCaptions !== false && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="text-[10px] text-white truncate">{item.title}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
registerBlock({
  type: "profile-gallery",
  category: "media",
  label: "Gallery",
  description: "Images and videos shared as evidence.",
  icon: "Image",
  defaults: { showCaptions: true },
  fields: [{ key: "showCaptions", label: "Show captions on hover", type: "toggle" }],
  component: ProfileGalleryBlock,
});
export { ProfileGalleryBlock };
