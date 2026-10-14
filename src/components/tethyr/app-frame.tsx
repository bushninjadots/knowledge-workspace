import { lazy, Suspense, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowUp, Bell, Menu, Search, WifiOff } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { useSidebarRail } from "@/hooks/use-sidebar-rail";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSiteAccentStyle } from "@/hooks/use-site-accent-style";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useUserPalette } from "@/lib/dominant-color";
import { isBackgroundActive } from "@/lib/background-themes";
import { backFallback, showsBack } from "@/lib/back-navigation";
import { cn } from "@/lib/utils";
import { BackgroundLayer } from "./background-layer";
import { NavigationProgress } from "./navigation-progress";
import { EmailVerificationBanner } from "./email-verification-banner";
import { MobilePrimaryNav } from "./mobile-primary-nav";
import { MessagePopups } from "./message-popups";
import { MessagingDock } from "./messaging-dock";
import { NotesDock } from "./notes-dock";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

// Auth-only panels open on user intent — keep their JS (and the search
// queries) off the frame's initial render.
const NotificationDropdown = lazy(() =>
  import("./notifications/notification-dropdown").then((m) => ({
    default: m.NotificationDropdown,
  })),
);
const GlobalSearch = lazy(() =>
  import("./global-search").then((m) => ({ default: m.GlobalSearch })),
);
const KeyboardShortcutsDialog = lazy(() =>
  import("./keyboard-shortcuts-dialog").then((m) => ({ default: m.KeyboardShortcutsDialog })),
);

/**
 * The one frame every page sits in — signed-in app pages and public section
 * pages alike — so moving between them never changes the chrome: the same
 * sidebar slot, top bar, Back rule (see back-navigation.ts), banners, and,
 * for members, the mobile tab bar, messaging dock and popups.
 */
export function AppFrame({
  children,
  isAuthed,
  renderSidebar,
  className,
  style,
  mainClassName,
  mainStyle,
}: {
  children: ReactNode;
  isAuthed: boolean;
  /** The sidebar, given a callback that closes the mobile drawer. */
  renderSidebar: (props: {
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    onNavigate?: () => void;
  }) => ReactNode;
  className?: string;
  style?: CSSProperties;
  mainClassName?: string;
  mainStyle?: CSSProperties;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebarRail();
  const { data: me } = useCurrentUser();
  const palette = useUserPalette(me?.bannerSigned ?? null);
  const siteAccent = useSiteAccentStyle(palette?.dominant);
  // Only the site accent here. A member's Studio card-border choice belongs to
  // their Studio and profile canvases (which apply it themselves); app pages
  // keep the theme's own neutral outline so cards suit every theme.
  const themeStyle = siteAccent;
  const hasCustomBackground = isAuthed && isBackgroundActive(me?.background);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const online = useOnlineStatus();

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: backFallback(pathname) });
  }

  return (
    <div
      className={cn(
        "relative isolate flex min-h-screen",
        hasCustomBackground ? "" : "bg-background",
        className,
      )}
      style={{ ...style, ...themeStyle }}
    >
      <NavigationProgress />
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to main content
      </a>
      {hasCustomBackground && (
        <BackgroundLayer
          background={me?.background}
          imageUrl={me?.backgroundImageUrl}
          bannerColor={palette?.dominant ?? null}
        />
      )}
      <div className="sticky top-0 hidden h-[100dvh] self-start shrink-0 md:block">
        {renderSidebar({ collapsed: sidebarCollapsed, onToggleCollapse: toggleSidebar })}
      </div>

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="left-0 top-0 h-full w-[min(20rem,85vw)] translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-r border-border p-0 md:hidden">
          <DialogTitle className="sr-only">Tethyr navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Navigate to a different area of Tethyr.
          </DialogDescription>
          {renderSidebar({ onNavigate: () => setDrawerOpen(false) })}
        </DialogContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Connected chrome: same surface as the sidebar, no bottom border —
            the sidebar's border-r is the one seam through the full height. */}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 bg-surface px-3 sm:px-4">
          <button
            type="button"
            className="rounded-md p-1.5 hover:bg-surface-sunken md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          {showsBack(pathname) ? (
            <button
              type="button"
              onClick={goBack}
              aria-label="Go back"
              title="Back"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-lift hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back</span>
            </button>
          ) : (
            <span className="text-[13px] font-semibold tracking-tight md:hidden">Tethyr</span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {/* Search lives in the sidebar (inline) on md+ — the icon covers
                mobile, and the collapsed rail where the field has no room. */}
            {isAuthed && (
              <button
                type="button"
                className={cn(
                  "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground",
                  !sidebarCollapsed && "md:hidden",
                )}
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
            <ThemeToggle />
            {isAuthed && (
              <Suspense
                fallback={
                  <button
                    type="button"
                    aria-label="Notifications"
                    className="relative rounded-full p-2 transition-colors hover:bg-surface"
                  >
                    <Bell className="h-4 w-4" />
                  </button>
                }
              >
                <NotificationDropdown />
              </Suspense>
            )}
          </div>
        </header>

        {isAuthed && <EmailVerificationBanner />}

        {!online && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 border-b border-caution/30 bg-caution/10 px-4 py-2 text-sm text-caution-foreground"
          >
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>You&apos;re offline — showing your last loaded data.</span>
          </div>
        )}

        <main
          id="main-content"
          className={cn("flex-1", isAuthed && "pb-16 md:pb-0", mainClassName)}
          style={mainStyle}
        >
          {children}
        </main>

        {isAuthed && (
          <>
            <MobilePrimaryNav onOpenMore={() => setDrawerOpen(true)} />
            <MessagePopups />
            {/* The two docks share the bottom-right corner; one opens at a time. */}
            <div className="pointer-events-none fixed right-0 bottom-6 z-40 flex flex-col items-end gap-2">
              <NotesDock />
              <MessagingDock />
            </div>
          </>
        )}

        {showScrollTop && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-20 right-4 z-50 flex h-10 w-10 md:bottom-[8.5rem] md:right-3 items-center justify-center rounded-full border card-border bg-surface transition-spatial hover:scale-105 hover:bg-surface-elevated"
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {isAuthed && (
        <Suspense fallback={null}>
          <GlobalSearch variant="dialog" open={searchOpen} onOpenChange={setSearchOpen} />
          <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
        </Suspense>
      )}
    </div>
  );
}
