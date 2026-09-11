// ── Profile Header Block ─────────────────────────────────────────────────────
// Renders the profile identity: avatar, display name, handle, category, location,
// timezone, languages, a "currently building" hook, collaboration status, and
// reputation as a tier + progress. Fetches directly from profiles table.

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Clock, Languages, Sparkles, Hammer, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { isSafeUrl } from "@/lib/validators";
import { registerBlock } from "@/lib/block-registry";
import { getTierProgress } from "@/lib/reputation";
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
  availability: string | null;
  background: unknown;
  public_background: unknown;
};

type ActiveProject = { id: string; title: string } | null;

const AVAIL_META: Record<string, { label: string; dot: string }> = {
  available: { label: "Open to collaboration", dot: "bg-trust" },
  busy: { label: "Focused on current work", dot: "bg-teaching" },
  away: { label: "Taking a step back", dot: "bg-muted-foreground" },
};

function ProfileHeaderBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange, ownerType } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["profile-header-block", profileId],
    queryFn: async (): Promise<ProfileHeaderData | null> => {
      if (!profileId) return null;
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, display_name, handle, creator_title, avatar_url, banner_url, category, country, timezone, languages, reputation_score, banner_caption, bio, availability, background, public_background",
        )
        .eq("id", profileId)
        .maybeSingle();
      return data as unknown as ProfileHeaderData | null;
    },
    enabled: !!profileId,
  });

  const { data: activeProject } = useQuery({
    queryKey: ["profile-header-active-project", profileId],
    queryFn: async (): Promise<ActiveProject> => {
      if (!profileId) return null;
      const { data } = await supabase
        .from("projects")
        .select("id, title")
        .eq("profile_id", profileId)
        .eq("visibility", "public")
        .in("status", ["planning", "active"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? { id: data.id, title: data.title } : null;
    },
    enabled: !!profileId,
  });

  const { data: avatarSigned } = useSignedStorageUrl("avatars", data?.avatar_url);
  const { data: bannerSigned } = useSignedStorageUrl("banners", data?.banner_url);

  // Report emptiness so the public Studio collapses the band when the
  // profile has no identity data to show.
  useEffect(() => {
    if (isLoading || isEditing || !blockId || ownerType !== "profile") return;
    onBlockEmptyChange?.(blockId, !data);
  }, [blockId, data, isEditing, isLoading, onBlockEmptyChange, ownerType]);

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
  const showBuilding = config.showBuilding !== false;
  const showAvailability = config.showAvailability !== false;
  // Profile editing belongs to Studio editor mode. View mode stays presentation-only,
  // including on the owner's public-facing Studio route.
  const canEdit = context.isOwner === true && (context.isEditing || context.quickEdit === true);
  const profileCompleteness =
    typeof context.profileCompleteness === "number" ? context.profileCompleteness : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-surface">
      {canEdit && (
        <HeroEditControls
          userId={data.id}
          hasBanner={!!bannerSrc}
          bannerSigned={bannerSrc}
          identity={{
            display_name: data.display_name,
            handle: data.handle,
            creator_title: data.creator_title,
            bio: data.bio,
            category: data.category,
            country: data.country,
            timezone: data.timezone,
            banner_caption: data.banner_caption,
            banner_url: data.banner_url,
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
              <p className="mt-0.5 text-base font-medium text-foreground/85">
                {data.creator_title}
              </p>
            )}
            {showHandle && <p className="text-sm text-muted-foreground">@{data.handle ?? "—"}</p>}

            {showBuilding && activeProject && (
              <Link
                to="/projects/$id"
                params={{ id: activeProject.id }}
                className="group mt-2 inline-flex max-w-full items-center gap-1.5 text-sm"
              >
                <Hammer className="h-3.5 w-3.5 shrink-0 text-[var(--user-accent,var(--muted-foreground))]" />
                <span className="text-muted-foreground">Currently building</span>
                <span className="truncate font-medium text-foreground underline decoration-muted-foreground/40 decoration-[1.5px] underline-offset-4 transition-colors group-hover:decoration-[var(--user-accent-border,var(--primary))]">
                  {activeProject.title}
                </span>
              </Link>
            )}

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
              {showAvailability && data.availability && AVAIL_META[data.availability] && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/50 px-2.5 py-0.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${AVAIL_META[data.availability].dot}`}
                  />
                  {AVAIL_META[data.availability].label}
                </span>
              )}
            </div>

            {showReputation &&
              data.reputation_score != null &&
              data.reputation_score > 0 &&
              (() => {
                const { current, next, progress } = getTierProgress(data.reputation_score!);
                return (
                  <div className="mt-3 flex w-fit items-center gap-2 rounded-md border border-trust/25 bg-trust/5 px-2.5 py-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-trust" />
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[11px] leading-none">
                        <span className="font-medium text-trust">{current.name}</span>
                        {next && (
                          <>
                            <span className="text-muted-foreground/60">→</span>
                            <span className="text-muted-foreground">{next.name}</span>
                          </>
                        )}
                        <span className="text-muted-foreground/60">
                          {data.reputation_score} rep
                        </span>
                      </div>
                      <div
                        className="h-1 w-28 overflow-hidden rounded-full bg-trust/15"
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Progress to ${next?.name ?? "top tier"}`}
                      >
                        <div
                          className="h-full rounded-full bg-trust"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

            {canEdit &&
              profileCompleteness !== null &&
              profileCompleteness < 100 &&
              context.onCompleteProfile && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3">
                  <p className="text-xs text-muted-foreground">
                    Complete your profile so people can understand what you make and how to work
                    with you.
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
  description: "Avatar, name, title, what you're building, availability, and reputation progress.",
  icon: "User",
  defaults: {
    showTitle: true,
    showHandle: true,
    showLocation: true,
    showReputation: true,
    showBanner: true,
    showBuilding: true,
    showAvailability: true,
    bannerUrl: "",
  },
  fields: [
    { key: "showTitle", label: "Show title", type: "toggle" },
    { key: "showHandle", label: "Show handle", type: "toggle" },
    { key: "showBuilding", label: "Show active project", type: "toggle" },
    { key: "showAvailability", label: "Show collaboration status", type: "toggle" },
    { key: "showLocation", label: "Show location", type: "toggle" },
    { key: "showReputation", label: "Show reputation", type: "toggle" },
    { key: "showBanner", label: "Show banner image", type: "toggle" },
    { key: "bannerUrl", label: "Banner image", type: "image", placeholder: "https://..." },
  ],
  component: ProfileHeaderBlock,
});

export { ProfileHeaderBlock };
