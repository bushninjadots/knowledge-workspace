// ── Profile Header Block ─────────────────────────────────────────────────────
// Renders the profile identity: avatar, display name, handle, category, location,
// timezone, languages, and reputation score. Fetches directly from profiles table.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Clock, Languages, Sparkles } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { isSafeUrl } from "@/lib/validators";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type ProfileHeaderData = {
  id: string;
  display_name: string | null;
  handle: string | null;
  creator_title: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  banner_caption: string | null;
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
          "id, display_name, handle, creator_title, avatar_url, banner_url, banner_caption, category, country, timezone, languages, reputation_score",
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
  const variant = typeof config.variant === "string" ? config.variant : "row";
  const coverActive = variant === "cover" && config.showBanner !== false && !!bannerSrc;
  const bannerCaption = data.banner_caption?.trim();
  const showTitle = config.showTitle !== false;
  const showHandle = config.showHandle !== false;
  const showLocation = config.showLocation !== false;
  const showReputation = config.showReputation !== false;
  const showBanner = config.showBanner !== false;

  const chips = (
    <div
      className={`flex flex-wrap gap-2 text-xs text-muted-foreground ${
        coverActive ? "justify-start text-white/85" : variant === "stack" ? "justify-center" : ""
      }`}
    >
      {data.category && (
        <span
          className={`rounded-full px-2.5 py-0.5 ${coverActive ? "bg-white/15 text-white" : "bg-primary/10 text-primary"}`}
        >
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
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 ${
            coverActive ? "bg-white/15 text-white" : "border border-trust/30 bg-trust/5 text-trust"
          }`}
        >
          <Sparkles className="h-3 w-3" /> {data.reputation_score} rep
        </span>
      )}
    </div>
  );

  const identity = (
    <>
      <h1
        className={`font-display text-2xl font-semibold text-foreground sm:text-4xl ${coverActive ? "text-white" : ""}`}
      >
        {data.display_name || "Untitled"}
      </h1>
      {showTitle && data.creator_title && (
        <p className={`mt-0.5 text-sm ${coverActive ? "text-white/85" : "text-foreground/80"}`}>
          {data.creator_title}
        </p>
      )}
      {showHandle && (
        <p className={`text-sm ${coverActive ? "text-white/75" : "text-muted-foreground"}`}>
          @{data.handle ?? "—"}
        </p>
      )}
      <div className="mt-3">{chips}</div>
    </>
  );

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-surface">
      {showBanner && bannerSrc && (
        <div className="relative">
          <img
            src={bannerSrc}
            alt=""
            width="1200"
            height="400"
            loading="eager"
            decoding="async"
            className={
              coverActive ? "h-72 w-full object-cover sm:h-96" : "h-44 w-full object-cover sm:h-64"
            }
          />
          {bannerCaption && !coverActive && (
            <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pb-3 pt-8 text-sm text-white sm:px-8">
              {bannerCaption}
            </p>
          )}
        </div>
      )}

      {coverActive ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-5 pt-20 sm:p-8 sm:pt-24">
          <div className="flex flex-col gap-3">
            <Avatar className="h-20 w-20 border-4 border-background/90 sm:h-28 sm:w-28">
              <AvatarImage src={avatarSigned ?? undefined} alt="" />
              <AvatarFallback className="text-2xl">{initial}</AvatarFallback>
            </Avatar>
            {identity}
            {bannerCaption && <p className="max-w-xl text-sm text-white/85">{bannerCaption}</p>}
          </div>
        </div>
      ) : (
        <div className="relative px-5 pb-6 sm:px-8 sm:pb-8">
          <div
            className={
              variant === "stack"
                ? "flex flex-col items-center gap-4 pt-6 text-center"
                : `flex flex-col gap-4 sm:flex-row sm:items-end ${bannerSrc ? "-mt-12" : "pt-6"}`
            }
          >
            <div className="shrink-0">
              <Avatar className="h-24 w-24 border-4 border-surface sm:h-32 sm:w-32">
                <AvatarImage src={avatarSigned ?? undefined} alt="" />
                <AvatarFallback className="text-2xl">{initial}</AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0 flex-1">{identity}</div>
          </div>
        </div>
      )}
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
    variant: "row",
    showTitle: true,
    showHandle: true,
    showLocation: true,
    showReputation: true,
    showBanner: true,
    bannerUrl: "",
  },
  fields: [
    {
      key: "variant",
      label: "Layout",
      type: "select",
      options: [
        { value: "row", label: "Row" },
        { value: "stack", label: "Stack" },
        { value: "cover", label: "Cover" },
      ],
    },
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
