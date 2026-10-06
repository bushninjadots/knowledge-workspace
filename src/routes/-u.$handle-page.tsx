import { useEffect, useMemo } from "react";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Github,
  Globe,
  Instagram,
  Link2,
  Twitch,
  Twitter,
  Youtube,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { avatarShapeCss, avatarRingCss } from "@/components/ui/avatar";
import {
  appearanceStyle,
  avatarShapeStyle,
  normalizeAvatarRing,
  type ProfileBackground,
} from "@/lib/background-themes";
import { BackgroundLayer } from "@/components/tethyr/background-layer";
import { Skeleton } from "@/components/ui/skeleton";
import { useDominantColor } from "@/lib/dominant-color";
import { PageShell } from "@/components/tethyr/page/page-shell";
import { EditModeProvider } from "@/components/tethyr/page/edit-mode-context";
import { useProfilePage } from "@/hooks/use-profile-page";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ProfileWorkEvidence } from "@/components/tethyr/profile/work-evidence";
import { ProfileGraphSummary } from "@/components/tethyr/profile/profile-graph-summary";
import { themeTokensToStyle } from "@/lib/theme-tokens";
import { useTheme as useAppTheme } from "@/lib/theme";
import { SectionShell } from "@/components/tethyr/section-shell";
import { fetchPublicProfile, type PublicProfile } from "./-u.$handle-data";

// Code-split module: the interactive page for its route. See the route
// file for the eager surface (loader/head) and the lazyRouteComponent wire-up.

export function PublicProfileRoute() {
  const { handle } = useParams({ from: "/u/$handle" });
  // embed is optional in the search schema (see the route file: a default
  // would force a 307 on every param-less visit), so undefined means false.
  const { embed = false, draft = false } = useSearch({ from: "/u/$handle" });
  const { data: me } = useCurrentUser();
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
  // The owner's draft preview (the editor's device frames) reads the draft;
  // everyone else, and the owner without ?draft, gets the published page.
  const previewDraft = draft && !!me?.userId && me.userId === data?.profile?.id;
  const profilePageQuery = useProfilePage({
    profileId: data?.profile?.id ?? "",
    isOwner: false,
    previewDraft,
  });
  const { page: profilePage } = profilePageQuery;

  // Page theme tokens derived under the active light/dark scheme — the same
  // derivation the public shell applies, so outer chrome and inner canvas can
  // never disagree about borders/foreground on a dark or tinted backdrop.
  const { resolvedTheme } = useAppTheme();
  const pageThemeStyle = useMemo(
    () => themeTokensToStyle(profilePage?.theme ?? {}, resolvedTheme),
    [profilePage?.theme, resolvedTheme],
  );

  const bannerColor = useDominantColor(data?.bannerSigned ?? null);

  const hasBlocks = !!profilePage && (profilePage.layout?.sections?.length ?? 0) > 0;

  if (isLoading) {
    return (
      <Shell background={null} pageThemeStyle={pageThemeStyle}>
        <ProfileSkeleton />
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
      {!embed && !profilePageQuery.isLoading && (
        <OwnerBar profileId={profile.id} publishedVersion={profilePage?.publishedVersion ?? null} />
      )}
      {/* The page query is a second request behind the profile query, so it
          resolves later. Rendering the fallback during that gap once flashed
          the wrong page — a visitor with a published Studio saw their
          identity-only profile swap into their real one a moment later. Now
          the skeleton holds until we actually know which surface this is. */}
      {profilePageQuery.isLoading ? (
        <ProfileSkeleton />
      ) : hasBlocks ? (
        <EditModeProvider>
          <PageShell
            ownerId={profile.id}
            ownerType="profile"
            // A draft preview needs owner access to read the draft, but renders
            // exactly as visitors will see it (previewMode="public").
            isOwner={previewDraft}
            previewDraft={previewDraft}
            previewMode={previewDraft ? "public" : undefined}
            showPreviewBanner={!embed}
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

/** Owner-only status for their own public URL: whether visitors see a
 *  published Studio (and which version) or just the basic profile. */
function OwnerBar({
  profileId,
  publishedVersion,
}: {
  profileId: string;
  publishedVersion: number | null;
}) {
  const { data: me } = useCurrentUser();
  if (!me?.userId || me.userId !== profileId) return null;
  const live = publishedVersion !== null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/60 bg-surface px-4 py-2.5 text-sm sm:px-6"
    >
      <p className="text-muted-foreground">
        {live ? (
          <>
            This is your Studio as visitors see it
            <span className="text-foreground"> · version {publishedVersion}</span>
          </>
        ) : (
          <>
            Only you can see this. Your Studio isn't published yet, so visitors see your name and
            photo only.
          </>
        )}
      </p>
      <Link
        to="/studio"
        className="inline-flex shrink-0 items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
      >
        Edit Studio <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
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

/** Placeholder for both loading phases of the public profile: the profile row
 *  itself, and the page query that decides whether a Studio is published. */
function ProfileSkeleton() {
  return (
    <div className="space-y-6 p-8" aria-hidden="true">
      <Skeleton className="h-48 rounded-xl" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-28 w-28 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-24 rounded-xl" />
    </div>
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
 *  published page only once they customize + publish, so this is what the large
 *  majority of profiles actually render — which makes it the most important
 *  surface on the site, not a consolation prize.
 *
 *  The hierarchy is deliberate and follows the product's core claim (people are
 *  known through what they built, not what they typed about themselves):
 *
 *    1. identity     who you are, briefly
 *    2. work         the projects you are on, and your role on each
 *    3. builds with  the people you build with
 *    4. metadata     bio, chips, links — a footnote, not the headline
 *
 *  This previously led with bio + links and showed no work at all, which
 *  answered "what is this person's homepage" instead of "what has this person
 *  built" — the LinkedIn question, on a network whose whole premise is that it
 *  is not LinkedIn. Work is derived from `project_contributors` rather than
 *  authored, so it is correct for everyone by default; publishing a Studio then
 *  replaces this default arrangement with the creator's own, and never competes
 *  with it (see `components/tethyr/profile/work-evidence.tsx`).
 */
function BasicProfile({
  profile,
  avatarSigned,
  publicBackground,
}: {
  profile: PublicProfile;
  avatarSigned: string | null;
  publicBackground?: ProfileBackground | null;
}) {
  const { data: me } = useCurrentUser();
  const isOwner = !!me?.userId && me.userId === profile.id;

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
  // Metadata earns its space only once identity is stated and work is absent.
  const hasMetadata =
    !!profile.bio || chips.length > 0 || portfolio.length > 0 || social.length > 0;

  return (
    <div className="animate-room-enter mx-auto w-full max-w-2xl px-4 pt-24 pb-20 sm:px-8">
      {/* 1 — identity */}
      <div className="text-center">
        <div
          className={`mx-auto h-24 w-24 overflow-hidden bg-[var(--user-accent,var(--trust))] ${hasRing ? "" : "ring-4 ring-surface"}`}
          style={{ ...avatarShapeCss, ...(hasRing ? avatarRingCss : {}) }}
        >
          {avatarSigned ? (
            <img
              src={avatarSigned}
              alt={`${name} avatar`}
              width={96}
              height={96}
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
      </div>

      {/* 2 + 3 — work, then the people they build with. Left-aligned on their
          own while identity stays centred, so the two readings do not compete
          for the same eye-line. */}
      <div className="mt-12">
        <ProfileWorkEvidence profileId={profile.id} isOwner={isOwner} />
      </div>

      <div className="mt-2">
        <ProfileGraphSummary profileId={profile.id} name={name} />
      </div>

      {/* 4 — metadata, demoted to a footnote below a rule */}
      {hasMetadata && (
        <div className="mt-14 border-t border-border pt-8 text-center">
          {profile.bio && (
            <p className="mx-auto max-w-xl text-sm text-muted-foreground whitespace-pre-wrap break-words">
              {profile.bio}
            </p>
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
        </div>
      )}

      {/* Last resort: a profile with neither work nor anything to say. Kept as a
          single quiet line rather than an empty section, and suppressed for the
          owner, who is instead prompted to arrange their Studio above. */}
      {!hasMetadata && !isOwner && (
        <p className="mt-12 text-center text-xs text-muted-foreground">
          {name} hasn&apos;t shared their work yet.
        </p>
      )}
    </div>
  );
}
