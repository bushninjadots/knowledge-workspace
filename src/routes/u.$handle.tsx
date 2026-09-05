// Public-facing Studio at /u/:handle. Anyone can view — even signed-out —
// because profiles and contribution surfaces are public. The owner can edit
// the public Studio arrangement when viewing their own handle.
import { useEffect, useMemo } from "react";
import { createFileRoute, notFound, useParams, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { canonicalLinks } from "@/lib/seo";
import {
  appearanceStyle,
  backgroundImageSignedUrl,
  type ProfileBackground,
} from "@/lib/background-themes";
import { BackgroundLayer } from "@/components/tethyr/background-layer";
import { useCurrentUser } from "@/hooks/use-current-user";

// Block system — profile blocks via PageShell.
import "@/components/tethyr/blocks/register-all";
import { PageShell } from "@/components/tethyr/page/page-shell";
import { EditModeProvider } from "@/components/tethyr/page/edit-mode-context";
import { useProfilePage } from "@/hooks/use-profile-page";
import { themeTokensToStyle } from "@/lib/theme-tokens";

type PublicProfile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  background: ProfileBackground | null;
  public_background: ProfileBackground | null;
};

export const Route = createFileRoute("/u/$handle")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
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
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-profile", handle],
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, handle, display_name, background, public_background")
        .eq("handle", handle)
        .maybeSingle();
      if (error) throw error;
      if (!profile) throw notFound();

      const publicBg = (profile.public_background ?? profile.background) as
        ProfileBackground | null | undefined;
      return {
        profile: profile as PublicProfile,
        publicBackground: publicBg ?? null,
        backgroundImageUrl: await backgroundImageSignedUrl(
          publicBg?.mode === "image" ? publicBg.image_url : null,
        ),
      };
    },
  });

  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

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

  const pageThemeStyle = useMemo(
    () => themeTokensToStyle(profilePage?.theme ?? {}),
    [profilePage?.theme],
  );

  const hasBlocks = !!profilePage && (profilePage.layout?.sections?.length ?? 0) > 0;

  if (isLoading) {
    return (
      <Shell background={null} pageThemeStyle={pageThemeStyle}>
        <div className="animate-pulse space-y-6 p-8" aria-hidden="true">
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
      pageThemeStyle={pageThemeStyle}
    >
      {isOwner && (
        <div className="mx-auto mb-2 flex w-full max-w-5xl items-center gap-2 px-4 pt-4 sm:px-8">
          <span className="text-xs text-muted-foreground">
            This is your public Studio, exactly as visitors see it.
          </span>
          <Link to="/studio" className="ml-auto text-xs font-medium text-primary hover:underline">
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
        <div className="animate-room-enter mx-auto w-full max-w-2xl px-4 py-24 text-center sm:px-8">
          <p className="section-label">Personal creative space</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Studio</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {profile.display_name || `@${profile.handle ?? "this member"}`} hasn&apos;t published
            their studio yet.
          </p>
        </div>
      )}
    </Shell>
  );
}

function Shell({
  children,
  background,
  backgroundImageUrl,
  pageThemeStyle,
}: {
  children: React.ReactNode;
  background?: ProfileBackground | null;
  backgroundImageUrl?: string | null;
  pageThemeStyle?: React.CSSProperties;
}) {
  const navigate = useNavigate();

  return (
    <div
      className={`relative isolate min-h-screen ${background?.density === "compact" ? "tethyr-density-compact" : ""}`}
      style={{ ...appearanceStyle(background), ...(pageThemeStyle ?? {}) }}
    >
      <BackgroundLayer background={background} imageUrl={backgroundImageUrl} />
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 sm:px-6">
        <button
          type="button"
          onClick={() =>
            window.history.length > 1 ? window.history.back() : navigate({ to: "/" })
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
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
      <main className="flex-1">{children}</main>
    </div>
  );
}
