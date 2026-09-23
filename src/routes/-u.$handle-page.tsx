import { useEffect, useMemo } from "react";
import { useParams, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Github, Globe, Instagram, Link2, Twitch, Twitter, Youtube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avatarShapeCss, avatarRingCss } from "@/components/ui/avatar";
import {
  appearanceStyle,
  avatarShapeStyle,
  normalizeAvatarRing,
  type ProfileBackground,
} from "@/lib/background-themes";
import { BackgroundLayer } from "@/components/tethyr/background-layer";
import { useDominantColor } from "@/lib/dominant-color";
import { PageShell } from "@/components/tethyr/page/page-shell";
import { EditModeProvider } from "@/components/tethyr/page/edit-mode-context";
import { useProfilePage } from "@/hooks/use-profile-page";
import { themeTokensToStyle } from "@/lib/theme-tokens";
import { SectionShell } from "@/components/tethyr/section-shell";
import { fetchPublicProfile, type PublicProfile } from "./-u.$handle-data";

// Code-split module: the interactive page for its route. See the route
// file for the eager surface (loader/head) and the lazyRouteComponent wire-up.

export function PublicProfileRoute() {
  const { handle } = useParams({ from: "/u/$handle" });
  const { embed } = useSearch({ from: "/u/$handle" });
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-profile", handle],
    queryFn: () => fetchPublicProfile(handle),
    staleTime: 60_000,
  });

  useEffect(() => {
    const profileId = data?.profile?.id;
    if (!profileId) return;
    const channel = supabase
      .channel(`public-profile-${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${profileId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["public-profile", handle] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [data?.profile?.id, handle, queryClient]);

  // Public parity: this query stays published-only. The owner builder (and the
  // owner's Studio view at /profile) provisions its draft itself — letting the
  // public route create pages would race the owner's own provisioning.
  const profilePageQuery = useProfilePage({
    profileId: data?.profile?.id ?? "",
    isOwner: false,
  });
  const { page: profilePage } = profilePageQuery;

  const pageThemeStyle = useMemo(
    () => themeTokensToStyle(profilePage?.theme ?? {}),
    [profilePage?.theme],
  );

  const bannerColor = useDominantColor(data?.bannerSigned ?? null);

  const hasBlocks = !!profilePage && (profilePage.layout?.sections?.length ?? 0) > 0;

  if (isLoading) {
    return (
      <Shell background={null} pageThemeStyle={pageThemeStyle}>
        <div className="animate-gentle-pulse space-y-6 p-8" aria-hidden="true">
          <div className="h-48 rounded-xl bg-surface" />
          <div className="flex items-center gap-4">
            <div className="h-28 w-28 rounded-full bg-surface" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-1/3 rounded bg-surface" />
              <div className="h-4 w-1/4 rounded bg-surface" />
            </div>
          </div>
          <div className="h-24 rounded-xl bg-surface" />
        </div>
      </Shell>
    );
  }

  if (error || !data) {
    return (
      <Shell background={null} pageThemeStyle={pageThemeStyle}>
        <div className="p-8 text-sm text-muted-foreground">Person not found.</div>
      </Shell>
    );
  }

  const { profile } = data;

  return (
    <Shell
      background={data.publicBackground}
      backgroundImageUrl={data.backgroundImageUrl}
      bannerColor={bannerColor}
      pageThemeStyle={pageThemeStyle}
      embed={embed}
    >
      {hasBlocks ? (
        <EditModeProvider>
          <PageShell
            ownerId={profile.id}
            ownerType="profile"
            isOwner={false}
            pageCreationAction={profilePageQuery.createPage}
            pageCreationError={profilePageQuery.pageCreationError}
            pageCreationPending={profilePageQuery.pageCreationPending}
            backgroundSlot={
              <BackgroundLayer
                background={data.publicBackground}
                imageUrl={data.backgroundImageUrl}
                bannerColor={bannerColor}
              />
            }
          />
        </EditModeProvider>
      ) : (
        <BasicProfile profile={profile} avatarSigned={data.avatarSigned} />
      )}
    </Shell>
  );
}

function Shell({
  children,
  background,
  backgroundImageUrl,
  bannerColor,
  pageThemeStyle,
  embed,
}: {
  children: React.ReactNode;
  background?: ProfileBackground | null;
  backgroundImageUrl?: string | null;
  bannerColor?: string | null;
  pageThemeStyle?: React.CSSProperties;
  embed?: boolean;
}) {
  // Composed like the owner's Studio view: the frame keeps the app background
  // + appearance variables; the content wrapper becomes the themed canvas
  // (page theme + backdrop) so blocks sit on exactly the surface the creator
  // sees in their own view. Embeds skip the chrome entirely.
  const densityClass = background?.density === "compact" ? "tethyr-density-compact" : undefined;
  const rootStyle = { ...appearanceStyle(background), ...avatarShapeStyle(background) };

  if (embed) {
    return (
      <div className={`relative isolate min-h-screen ${densityClass ?? ""}`} style={rootStyle}>
        <main
          className="relative isolate min-w-0 flex-1 bg-background bg-noise"
          style={pageThemeStyle}
        >
          <BackgroundLayer
            background={background}
            imageUrl={backgroundImageUrl}
            bannerColor={bannerColor}
          />
          {children}
        </main>
      </div>
    );
  }

  return (
    <SectionShell
      className={densityClass}
      style={rootStyle}
      mainClassName="relative isolate min-w-0 flex-1 bg-background bg-noise"
      mainStyle={pageThemeStyle}
    >
      <BackgroundLayer
        background={background}
        imageUrl={backgroundImageUrl}
        bannerColor={bannerColor}
      />
      {children}
    </SectionShell>
  );
}

const SOCIAL_ICONS: Record<string, typeof Globe> = {
  website: Globe,
  github: Github,
  x: Twitter,
  twitter: Twitter,
  instagram: Instagram,
  youtube: Youtube,
  twitch: Twitch,
};

/** Fallback for people who haven't published a Studio yet. Everyone gets a
 *  published page only once they customize + publish, so this is the honest
 *  "basic profile" placeholder: their identity, wherever they are, and how to
 *  reach them — not a dead empty state. */
function BasicProfile({
  profile,
  avatarSigned,
  publicBackground,
}: {
  profile: PublicProfile;
  avatarSigned: string | null;
  publicBackground?: ProfileBackground | null;
}) {
  const handle = profile.handle ?? "this member";
  const name = profile.display_name || `@${handle}`;
  const initial = name.charAt(0).toUpperCase();

  const chips = [
    profile.category,
    profile.country,
    profile.timezone,
    profile.languages && profile.languages.length > 0 ? profile.languages.join(", ") : null,
  ].filter((c): c is string => !!c);

  // Same decorative ring rule as the Studio identity header: when a ring is
  // active it replaces the static surface ring with the member's own accent.
  const hasRing =
    normalizeAvatarRing(publicBackground?.avatarRing, publicBackground?.avatarRingColor) !== "none";
  const portfolio = profile.portfolio_links ?? [];
  const social = Object.entries(profile.social_links ?? {}).filter(([, url]) => !!url);

  return (
    <div className="animate-room-enter mx-auto w-full max-w-2xl px-4 py-24 text-center sm:px-8">
      <p className="section-label">Personal creative space</p>

      <div
        className={`mx-auto mt-6 h-28 w-28 overflow-hidden bg-[var(--user-accent,var(--trust))] ${hasRing ? "" : "ring-4 ring-surface"}`}
        style={{ ...avatarShapeCss, ...(hasRing ? avatarRingCss : {}) }}
      >
        {avatarSigned ? (
          <img
            src={avatarSigned}
            alt={`${name} avatar`}
            width="112"
            height="112"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-background">
            {initial}
          </div>
        )}
      </div>

      <h1 className="mt-4 font-display text-2xl font-semibold break-words">{name}</h1>
      <p className="text-sm text-muted-foreground">@{handle}</p>
      {profile.creator_title && (
        <p className="mt-1 text-sm text-foreground/80 break-words">{profile.creator_title}</p>
      )}

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-border/60 bg-background/60 px-3 py-1"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      {profile.bio && (
        <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground whitespace-pre-wrap break-words">
          {profile.bio}
        </p>
      )}

      {(portfolio.length > 0 || social.length > 0) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {portfolio.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs transition-lift hover:border-[var(--user-accent-border)]"
            >
              <Link2 className="h-3 w-3" />
              {link.label}
            </a>
          ))}
          {social.map(([key, url]) => {
            const Icon = SOCIAL_ICONS[key] ?? Globe;
            return (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label={key}
                title={key}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground transition-lift hover:text-foreground"
              >
                <Icon className="h-3.5 w-3.5" />
              </a>
            );
          })}
        </div>
      )}

      <p className="mt-10 text-xs text-muted-foreground">
        {name} hasn&apos;t published their Studio yet — here&apos;s what they&apos;ve shared so far.
      </p>
    </div>
  );
}
