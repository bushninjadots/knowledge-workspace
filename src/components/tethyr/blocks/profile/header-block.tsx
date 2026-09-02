// ── Profile Header Block ─────────────────────────────────────────────────────
// Renders the profile identity: avatar, display name, handle, category, location,
// timezone, languages, and reputation score. Fetches directly from profiles table.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Clock, Languages, Sparkles, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { isSafeUrl } from "@/lib/validators";
import { registerBlock } from "@/lib/block-registry";
import { HeroEditControls } from "@/components/tethyr/profile/hero-edit-controls";
import { BannerStrip } from "@/components/tethyr/profile/banner-strip";
import type { BlockProps } from "@/lib/page-blocks";

type ProfileHeaderData = {
  id: string;
  display_name: string | null;
  handle: string | null;
  creator_title: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  category: string | null;
  country: string | null;
  timezone: string | null;
  languages: string[];
  reputation_score: number | null;
  banner_caption: string | null;
  bio: string | null;
  background: unknown;
  public_background: unknown;
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
          "id, display_name, handle, creator_title, avatar_url, banner_url, category, country, timezone, languages, reputation_score, banner_caption, bio, background, public_background",
        )
        .eq("id", profileId)
        .maybeSingle();
      return data as unknown as ProfileHeaderData | null;
    },
    enabled: !!profileId,
  });

  const { data: avatarSigned } = useSignedStorageUrl("avatars", data?.avatar_url);
  const { data: bannerSigned } = useSignedStorageUrl("banners", data?.banner_url);

  if (isLoading) {
    return (
      <div className="flex items-center gap-5 rounded-xl bg-surface/40 p-5">
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
  const customBanner =
    typeof config.bannerUrl === "string" && isSafeUrl(config.bannerUrl) ? config.bannerUrl : null;
  const bannerSrc = customBanner ?? bannerSigned;
  const initial = (data.display_name ?? data.handle ?? "?").charAt(0).toUpperCase();
  const showTitle = config.showTitle !== false;
  const showHandle = config.showHandle !== false;
  const showLocation = config.showLocation !== false;
  const showReputation = config.showReputation !== false;
  const showBanner = config.showBanner !== false;
  const canEdit = context.isOwner === true && !context.isEditing;
  const profileCompleteness =
    typeof context.profileCompleteness === "number" ? context.profileCompleteness : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-surface">
      {canEdit && (
        <HeroEditControls
          userId={data.id}
          hasBanner={!!bannerSrc}
          identity={{
            display_name: data.display_name,
            handle: data.handle,
            creator_title: data.creator_title,
            bio: data.bio,
            category: data.category,
            country: data.country,
            timezone: data.timezone,
            banner_caption: data.banner_caption,
            background: (data.background ?? null) as never,
            public_background: (data.public_background ?? null) as never,
          }}
        />
      )}
      {showBanner && bannerSrc && (
        <BannerStrip
          bannerSigned={bannerSrc}
          bannerCaption={data.banner_caption}
          userId={data.id}
          onChange={() => undefined}
          readonly
          showCaption
        />
      )}
      <div className="relative px-5 pb-6 sm:px-8 sm:pb-8">
        <div
          className={`flex flex-col gap-4 sm:flex-row sm:items-end ${bannerSrc && showBanner ? "-mt-12" : "pt-6"}`}
        >
          {/* Avatar */}
          <div className="shrink-0">
            <Avatar className="h-24 w-24 border-4 border-surface sm:h-32 sm:w-32">
              <AvatarImage src={avatarSigned ?? undefined} alt="" />
              <AvatarFallback className="text-2xl">{initial}</AvatarFallback>
            </Avatar>
          </div>

          {/* Identity */}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-semibold text-foreground sm:text-4xl">
              {data.display_name || "Untitled"}
            </h1>
            {showTitle && data.creator_title && (
              <p className="mt-0.5 text-sm text-foreground/80">{data.creator_title}</p>
            )}
            {showHandle && <p className="text-sm text-muted-foreground">@{data.handle ?? "—"}</p>}

            {/* Metadata chips */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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

            {canEdit && profileCompleteness !== null && profileCompleteness < 100 && context.onCompleteProfile && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3">
                <p className="text-xs text-muted-foreground">
                  Complete your profile so people can understand what you make and how to work with you.
                </p>
                <button
                  type="button"
                  onClick={context.onCompleteProfile}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--user-accent-border,var(--card-border))] bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-background"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Complete profile
                  <span className="text-muted-foreground">{profileCompleteness}%</span>
                </button>
              </div>
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
  defaults: {
    showTitle: true,
    showHandle: true,
    showLocation: true,
    showReputation: true,
    showBanner: true,
    bannerUrl: "",
  },
  fields: [
    { key: "showTitle", label: "Show title", type: "toggle" },
    { key: "showHandle", label: "Show handle", type: "toggle" },
    { key: "showLocation", label: "Show location", type: "toggle" },
    { key: "showReputation", label: "Show reputation", type: "toggle" },
    { key: "showBanner", label: "Show banner image", type: "toggle" },
    { key: "bannerUrl", label: "Banner image", type: "image", placeholder: "https://..." },
  ],
  component: ProfileHeaderBlock,
});

export { ProfileHeaderBlock };
