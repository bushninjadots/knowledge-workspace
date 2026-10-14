import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useSearch } from "@tanstack/react-router";
import { PenLine } from "lucide-react";
import type { CommunityNavId } from "@/data/mocks/community-nav";
import { CommunityTabs } from "@/components/tethyr/community/community-tabs";
import { SpaceAbout } from "@/components/tethyr/community/space-about";
import { CommunityRightSidebar } from "@/components/tethyr/community/right-sidebar";
import { CommunityFeed } from "@/components/tethyr/community/community-feed";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useSpaceAccent } from "@/components/tethyr/community/space-media";
import { useWeeklyThread } from "@/hooks/use-space-rituals";
import { cn } from "@/lib/utils";
import {
  useCommunitySpace,
  useCommunitySpacePosts,
  type CommunitySpace,
} from "@/hooks/use-community-spaces";

// Code-split module: the interactive page for its route. See the route
// file for the eager surface (loader/head) and the lazyRouteComponent wire-up.
export function CommunityPage() {
  const searchParams = useSearch({ strict: false }) as Record<string, string | undefined>;
  const deepLinkedPostId = searchParams.post;
  const deepLinkedSpaceSlug = searchParams.space;
  const deepLinkedNav = searchParams.nav;

  const [nav, setNav] = useState<CommunityNavId>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [pulseOpen, setPulseOpen] = useState(false);
  const [activeSpaceSlug, setActiveSpaceSlug] = useState<string | null>(null);
  const [composerPresetType, setComposerPresetType] = useState<string | null>(null);

  const { data: activeSpace } = useCommunitySpace(activeSpaceSlug ?? "");
  const { data: spacePosts = [], isLoading: spacePostsLoading } = useCommunitySpacePosts(
    activeSpace?.id ?? "",
  );

  // If deep-linked to a space, auto-navigate to it
  useEffect(() => {
    if (deepLinkedSpaceSlug && deepLinkedSpaceSlug !== activeSpaceSlug) {
      setActiveSpaceSlug(deepLinkedSpaceSlug);
    }
  }, [deepLinkedSpaceSlug, activeSpaceSlug]);

  // If deep-linked to a nav destination (e.g. the Today digest's help/collab rows)
  useEffect(() => {
    if (deepLinkedNav && deepLinkedNav !== nav) {
      setNav(deepLinkedNav as CommunityNavId);
      // A nav deep-link leaves the space view — the space feed overrides nav.
      setActiveSpaceSlug(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkedNav]);

  // Empty states and the phone compose button drop the user straight into the
  // composer (optionally with the post type pre-selected).
  const focusComposer = useCallback((presetType?: string) => {
    setNav("home");
    setSearchQuery("");
    if (presetType) setComposerPresetType(presetType);
    requestAnimationFrame(() => {
      const el = document.getElementById("community-composer-textarea");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        (el as HTMLTextAreaElement).focus();
      }
    });
  }, []);

  const openSpace = useCallback((space: CommunitySpace) => {
    setActiveSpaceSlug(space.slug);
    setNav("home");
  }, []);

  const closeSpace = useCallback(() => setActiveSpaceSlug(null), []);

  // Picking a tab always leaves an open space (the Spaces tab lists them all).
  const selectTab = useCallback((id: CommunityNavId) => {
    setActiveSpaceSlug(null);
    setNav(id);
  }, []);

  // Trending skills in the rail narrow the feed instead of leaving the page.
  const searchSkill = useCallback((skill: string) => {
    setActiveSpaceSlug(null);
    setNav("home");
    setSearchQuery(skill);
    setPulseOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const openPulse = useCallback(() => setPulseOpen(true), []);
  useWeeklyThread(activeSpace);
  // Inside a space the page wears the space's colour (its pick, or its banner's).
  const spaceTint = useSpaceAccent({
    accent_color: activeSpace?.accent_color ?? null,
    visibility: activeSpace?.visibility ?? "public",
    join_type: activeSpace?.join_type ?? "auto",
    banner_url: activeSpace?.banner_url ?? null,
  });

  return (
    <div
      className="animate-room-enter relative min-h-screen bg-noise"
      // The room's colour: the member's accent on the feed, the space's own
      // colour inside a space. Cards, the header glow and the hairlines take it.
      style={
        {
          "--community-tint": activeSpace ? spaceTint : "var(--user-accent, var(--primary))",
        } as CSSProperties
      }
    >
      {/* A soft glow of the room's colour behind the header — identity, not decoration. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 bg-[radial-gradient(55%_100%_at_25%_0%,color-mix(in_oklab,var(--community-tint)_16%,transparent),transparent_75%)]",
          activeSpace ? "h-[32rem]" : "h-80",
        )}
      />
      <div className="relative mx-auto grid w-full max-w-[1180px] gap-8 px-4 pb-28 pt-8 sm:px-6 md:pb-12 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="@container min-w-0">
          <CommunityTabs
            active={nav}
            inSpace={!!activeSpace}
            onSelect={selectTab}
            onOpenPulse={openPulse}
          />
          <CommunityFeed
            nav={nav}
            onNavChange={setNav}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeSpace={activeSpace ?? undefined}
            spacePosts={spacePosts}
            spacePostsLoading={spacePostsLoading}
            composerPresetType={composerPresetType}
            focusComposer={focusComposer}
            deepLinkedPostId={deepLinkedPostId}
            onBackSpace={closeSpace}
            onOpenSpace={openSpace}
          />
        </div>

        {activeSpace ? (
          <SpaceAbout space={activeSpace} />
        ) : (
          <CommunityRightSidebar sticky onSkillSelect={searchSkill} onOpenSpace={openSpace} />
        )}
      </div>

      {/* Phones: keep writing one tap away. Sits above the shell's scroll-to-top. */}
      <button
        type="button"
        onClick={() => focusComposer()}
        aria-label="Write a post"
        className="fixed bottom-[calc(8.25rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--user-accent,var(--primary))] text-[var(--user-accent-foreground,var(--primary-foreground))] shadow-lg transition-transform active:scale-95 md:hidden"
      >
        <PenLine className="h-5 w-5" aria-hidden />
      </button>

      <Drawer open={pulseOpen} onOpenChange={setPulseOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>{activeSpace ? `About ${activeSpace.name}` : "Pulse"}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            {activeSpace ? (
              <SpaceAbout space={activeSpace} mobile />
            ) : (
              <CommunityRightSidebar
                mobile
                onSkillSelect={searchSkill}
                onOpenSpace={(space) => {
                  setPulseOpen(false);
                  openSpace(space);
                }}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
