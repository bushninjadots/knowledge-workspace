import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import {
  CommunityLeftSidebar,
  type CommunityNavId,
} from "@/components/tethyr/community/left-sidebar";
import { CommunityRightSidebar } from "@/components/tethyr/community/right-sidebar";
import { CommunityFeed } from "@/components/tethyr/community/community-feed";
import { MobileBottomNav } from "@/components/tethyr/community/mobile-bottom-nav";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  useCommunitySpace,
  useCommunitySpacePosts,
  type CommunitySpace,
} from "@/hooks/use-community-spaces";

export const Route = createFileRoute("/_authenticated/community")({
  head: () => ({
    meta: [
      { title: "Community — Tethyr" },
      {
        name: "description",
        content: "A space where people share ideas, ask for help, and collaborate on projects.",
      },
    ],
  }),
  component: CommunityPage,
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. Please try again.
        </p>
      </div>
    </div>
  ),
});

/**
 * Thin shell for /community. Owns page-level concerns only — which view is
 * active, the mobile drawers, the deep-linked space, and the composer trigger
 * (shared by the mobile FAB and empty states). The feed, header, list, rail
 * and sidebar are extracted subcomponents that each own their own data.
 */
function CommunityPage() {
  const searchParams = useSearch({ strict: false }) as Record<string, string | undefined>;
  const deepLinkedPostId = searchParams.post;
  const deepLinkedSpaceSlug = searchParams.space;
  const deepLinkedNav = searchParams.nav;

  const [nav, setNav] = useState<CommunityNavId>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileTrendingOpen, setMobileTrendingOpen] = useState(false);
  const [activeSpaceSlug, setActiveSpaceSlug] = useState<string | null>(null);
  const [composerPresetType, setComposerPresetType] = useState<string | null>(null);

  const { data: activeSpace } = useCommunitySpace(activeSpaceSlug ?? "");
  const { data: spacePosts = [] } = useCommunitySpacePosts(activeSpace?.id ?? "");

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

  // Empty states and the mobile FAB drop the user straight into the composer
  // (optionally with the post type pre-selected).
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

  const openTrending = useCallback(() => setMobileTrendingOpen(true), []);
  const openSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setMobileSidebarOpen(false), []);
  const selectFromDrawer = useCallback((id: CommunityNavId) => {
    setNav(id);
    setMobileSidebarOpen(false);
  }, []);

  return (
    <div className="animate-room-enter min-h-screen bg-noise">
      <div className="mx-auto flex max-w-7xl gap-6 p-4 md:p-8">
        <CommunityLeftSidebar active={nav} onSelect={setNav} className="hidden lg:block" />

        <CommunityFeed
          nav={nav}
          onNavChange={setNav}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeSpace={activeSpace ?? undefined}
          spacePosts={spacePosts}
          composerPresetType={composerPresetType}
          focusComposer={focusComposer}
          deepLinkedPostId={deepLinkedPostId}
          onBackSpace={closeSpace}
          onOpenTrending={openTrending}
          onOpenSpace={openSpace}
        />

        <CommunityRightSidebar />
      </div>

      <MobileBottomNav
        active={nav}
        onSelect={setNav}
        onPost={focusComposer}
        onOpenSidebar={openSidebar}
      />

      <Drawer open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Navigation</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <CommunityLeftSidebar
              active={nav}
              onSelect={selectFromDrawer}
              onNavigate={closeSidebar}
              className="w-full"
            />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={mobileTrendingOpen} onOpenChange={setMobileTrendingOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Trending & Discover</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <CommunityRightSidebar mobile />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
