// ── Profile Header Block ─────────────────────────────────────────────────────
// Renders the profile identity: avatar, display name, handle, category, location,
// timezone, languages, and reputation score. Fetches directly from profiles table.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Clock, Languages, Sparkles } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type ProfileHeaderData = {
  id: string;
  display_name: string | null;
  handle: string | null;
  creator_title: string | null;
  avatar_url: string | null;
  category: string | null;
  country: string | null;
  timezone: string | null;
  languages: string[];
  reputation_score: number | null;
};

function ProfileHeaderBlock({ config, context }: BlockProps) {
  const profileId = context.ownerType === "profile" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["profile-header-block", profileId],
    queryFn: async (): Promise<ProfileHeaderData | null> => {
      if (!profileId) return null;
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, display_name, handle, creator_title, avatar_url, category, country, timezone, languages, reputation_score",
        )
        .eq("id", profileId)
        .maybeSingle();
      return data as unknown as ProfileHeaderData | null;
    },
    enabled: !!profileId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-5 bg-surface/40 p-5 rounded-xl">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
    );
  }

  if (!data) return null;
  const initial = (data.display_name ?? data.handle ?? "?").charAt(0).toUpperCase();
  const showTitle = config.showTitle !== false;
  const showHandle = config.showHandle !== false;
  const showLocation = config.showLocation !== false;
  const showReputation = config.showReputation !== false;

  return (
    <div className="bg-surface/40 p-5 rounded-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* Avatar */}
        <div className="shrink-0">
          <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
            <AvatarImage src={data.avatar_url ?? undefined} />
            <AvatarFallback className="text-2xl">{initial}</AvatarFallback>
          </Avatar>
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
            {data.display_name || "Untitled"}
          </h2>
          {showTitle && data.creator_title && (
            <p className="mt-0.5 text-sm text-foreground/80">{data.creator_title}</p>
          )}
          {showHandle && <p className="text-sm text-muted-foreground">@{data.handle ?? "—"}</p>}

          {/* Metadata chips */}
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {data.category && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-primary">
                {data.category}
              </span>
            )}
            {showLocation && data.country && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {data.country}
              </span>
            )}
            {data.timezone && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {data.timezone}
              </span>
            )}
            {data.languages.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Languages className="h-3.5 w-3.5" /> {data.languages.join(", ")}
              </span>
            )}
            {showReputation && data.reputation_score != null && data.reputation_score > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-trust/30 bg-trust/5 px-2.5 py-0.5 text-trust">
                <Sparkles className="h-3 w-3" /> {data.reputation_score} rep
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

registerBlock({
  type: "profile-header",
  category: "people",
  label: "Profile Header",
  description: "Avatar, name, handle, category, location, timezone, languages, and reputation.",
  icon: "User",
  defaults: { showTitle: true, showHandle: true, showLocation: true, showReputation: true },
  fields: [
    { key: "showTitle", label: "Show title", type: "toggle" },
    { key: "showHandle", label: "Show handle", type: "toggle" },
    { key: "showLocation", label: "Show location", type: "toggle" },
    { key: "showReputation", label: "Show reputation", type: "toggle" },
  ],
  component: ProfileHeaderBlock,
});

export { ProfileHeaderBlock };
