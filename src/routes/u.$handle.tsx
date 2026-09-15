// Public-facing Studio at /u/:handle. Anyone can view — even signed-out —
// because profiles and contribution surfaces are public. The owner can edit
// the public Studio arrangement when viewing their own handle.
import { useEffect, useMemo } from "react";
import {
  createFileRoute,
  notFound,
  useParams,
  useNavigate,
  useSearch,
  Link,
} from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowLeft,
  Github,
  Globe,
  Instagram,
  Link2,
  Pencil,
  Twitch,
  Twitter,
  Youtube,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { canonicalLinks } from "@/lib/seo";
import {
  appearanceStyle,
  backgroundImageSignedUrl,
  type ProfileBackground,
} from "@/lib/background-themes";
import { BackgroundLayer } from "@/components/tethyr/background-layer";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useDominantColor } from "@/lib/dominant-color";

// Block system — profile blocks via PageShell.
import "@/components/tethyr/blocks/register-all";
import { PageShell } from "@/components/tethyr/page/page-shell";
import { EditModeProvider } from "@/components/tethyr/page/edit-mode-context";
import { useProfilePage } from "@/hooks/use-profile-page";
import { themeTokensToStyle } from "@/lib/theme-tokens";
import { useTheme as useAppTheme } from "@/lib/theme";

type PublicProfile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  banner_url: string | null;
  avatar_url: string | null;
  creator_title: string | null;
  category: string | null;
  country: string | null;
  timezone: string | null;
  bio: string | null;
  languages: string[] | null;
  social_links: Record<string, string> | null;
  portfolio_links: { label: string; url: string }[] | null;
  background: ProfileBackground | null;
  public_background: ProfileBackground | null;
};

async function fetchPublicProfile(handle: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, handle, display_name, banner_url, avatar_url, creator_title, category, country, timezone, bio, languages, social_links, portfolio_links, background, public_background",
    )
    .eq("handle", handle)
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw notFound();

  const publicBg = (profile.public_background ?? profile.background) as ProfileBackground | null;
  const [backgroundImageUrl, banner, avatar] = await Promise.all([
    backgroundImageSignedUrl(publicBg?.mode === "image" ? publicBg.image_url : null),
    profile.banner_url
      ? supabase.storage.from("banners").createSignedUrl(profile.banner_url, 60 * 60 * 24)
      : Promise.resolve({ data: null }),
    profile.avatar_url
      ? supabase.storage.from("avatars").createSignedUrl(profile.avatar_url, 60 * 60 * 24)
      : Promise.resolve({ data: null }),
  ]);
  return {
    profile: profile as PublicProfile,
    publicBackground: publicBg ?? null,
    backgroundImageUrl,
    // Needed when the backdrop tint follows the banner (`colorSource: "banner"`).
    bannerSigned: banner.data?.signedUrl ?? null,
    avatarSigned: avatar.data?.signedUrl ?? null,
  };
}

export const Route = createFileRoute("/u/$handle")({
  loader: async ({ params, context: { queryClient } }) => {
    await queryClient.prefetchQuery({
      queryKey: ["public-profile", params.handle],
      queryFn: () => fetchPublicProfile(params.handle),
      staleTime: 60_000,
    });
    return {};
  },
  validateSearch: z.object({
    embed: z.coerce.boolean().optional().default(false),
  }),
  head: ({ params }) => ({
    meta: [
      { title: `@${params.handle} — Tethyr` },
      {
        name: "description",
        content: `Explore @${params.handle}'s work, skills, and projects on Tethyr.`,
      },
    ],
    links: canonicalLinks(`/u/${encodeURIComponent(params.handle)}`),
  }),
  component: PublicProfileRoute,
  errorComponent: () => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-destructive" role="alert">
      This person's studio couldn't be loaded. Please try again.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-8 text-sm text-muted-foreground">
      No person with that handle.
    </div>
  ),
});

function PublicProfileRoute() {
  const { handle } = useParams({ from: "/u/$handle" });
  const { embed } = useSearch({ from: "/u/$handle" });
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-profile", handle],
    queryFn: () => fetchPublicProfile(handle),
    staleTime: 60_000,
  });

  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;
  const bannerColor = useDominantColor(data?.bannerSigned ?? null);

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

  const isOwner = !!(meId && data?.profile && meId === data.profile.id);

  // The owner builder provisions its draft itself. Keeping this query
  // published-only prevents the public route and builder from racing to create
  // two profile pages for the same owner.
  const profilePageQuery = useProfilePage({
    profileId: data?.profile?.id ?? "",
    isOwner: false,
  });
  const { page: profilePage } = profilePageQuery;

  const { resolvedTheme } = useAppTheme();
  const pageThemeStyle = useMemo(
    () => themeTokensToStyle(profilePage?.theme ?? {}, resolvedTheme),
    [profilePage?.theme, resolvedTheme],
  );

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
      {isOwner && !embed && (
        <div className="mx-auto mb-2 flex w-full max-w-5xl items-center gap-2 px-4 pt-4 sm:px-8">
          <span className="text-xs text-muted-foreground">
            This is your public Studio, exactly as visitors see it.
          </span>
          <Link
            to="/studio"
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-xs font-medium text-foreground transition-lift hover:bg-[var(--surface-elevated)]"
          >
            <Pencil className="h-3 w-3" />
            Customize
          </Link>
        </div>
      )}
      {hasBlocks ? (
        <EditModeProvider>
          <PageShell
            ownerId={profile.id}
            ownerType="profile"
            isOwner={false}
            pageCreationAction={profilePageQuery.createPage}
            pageCreationError={profilePageQuery.pageCreationError}
            pageCreationPending={profilePageQuery.pageCreationPending}
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
  const navigate = useNavigate();

  return (
    <div
      className={`relative isolate min-h-screen ${background?.density === "compact" ? "tethyr-density-compact" : ""}`}
      style={{ ...appearanceStyle(background), ...(pageThemeStyle ?? {}) }}
    >
      <BackgroundLayer
        background={background}
        imageUrl={backgroundImageUrl}
        bannerColor={bannerColor}
      />
      {!embed && (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 sm:px-6">
          <button
            type="button"
            onClick={() =>
              window.history.length > 1 ? window.history.back() : navigate({ to: "/" })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-lift hover:text-foreground"
            aria-label="Go back"
            title="Back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <Link to="/" className="font-display text-lg font-semibold text-foreground">
            Tethyr
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">Studio</span>
        </header>
      )}
      <main className="flex-1">{children}</main>
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
 *  published page only once they customize + publish, so this is the honest
 *  "basic profile" placeholder: their identity, wherever they are, and how to
 *  reach them — not a dead empty state. */
function BasicProfile({
  profile,
  avatarSigned,
}: {
  profile: PublicProfile;
  avatarSigned: string | null;
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

  const portfolio = profile.portfolio_links ?? [];
  const social = Object.entries(profile.social_links ?? {}).filter(([, url]) => !!url);

  return (
    <div className="animate-room-enter mx-auto w-full max-w-2xl px-4 py-24 text-center sm:px-8">
      <p className="section-label">Personal creative space</p>

      <div className="mx-auto mt-6 h-28 w-28 overflow-hidden rounded-full bg-[var(--user-accent,var(--trust))] ring-4 ring-surface">
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
