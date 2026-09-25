import { lazy, Suspense, useState, useMemo, useEffect } from "react";
import { Outlet } from "@tanstack/react-router";
import { Menu, Search, ArrowUp, Bell, WifiOff } from "lucide-react";
import { DashboardSidebar } from "./dashboard-sidebar";
import { ThemeToggle } from "./theme-toggle";
import { useSidebarRail } from "@/hooks/use-sidebar-rail";

// Both panels are only ever interactive on user intent — keep their JS (and
// the six-source search queries) off the shell's initial render.
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
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUserPalette, paletteToStyle } from "@/lib/dominant-color";
import { MobilePrimaryNav } from "./mobile-primary-nav";
import { BackgroundLayer } from "./background-layer";
import { appearanceStyle } from "@/lib/background-themes";
import { EmailVerificationBanner } from "./email-verification-banner";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { NavigationProgress } from "./navigation-progress";

/**
 * Shared layout for all authenticated routes.
 * The sidebar + mobile menu lives here once — never remounts on navigation.
 * Dynamic user theme from banner image cascades via CSS custom properties.
 */
export function AuthenticatedShell() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebarRail();
  const { data: me } = useCurrentUser();
  const palette = useUserPalette(me?.bannerSigned ?? null);
  const themeStyle = useMemo(
    () => ({ ...paletteToStyle(palette), ...appearanceStyle(me?.background) }),
    [palette, me?.background],
  );
  const [showScrollTop, setShowScrollTop] = useState(false);
  const online = useOnlineStatus();

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`relative isolate flex min-h-screen ${me?.background?.density === "compact" ? "tethyr-density-compact" : ""}`}
      style={themeStyle}
    >
      <NavigationProgress />
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to main content
      </a>
      <BackgroundLayer
        background={me?.background}
        imageUrl={me?.backgroundImageUrl}
        bannerColor={palette?.dominant ?? null}
      />
      <div className="sticky top-0 hidden h-[100dvh] self-start shrink-0 md:block">
        <DashboardSidebar collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-0 top-0 h-full w-[min(20rem,85vw)] translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-r border-border p-0 md:hidden">
          <DialogTitle className="sr-only">Tethyr navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Navigate to a different area of Tethyr.
          </DialogDescription>
          <DashboardSidebar onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-background px-3 sm:px-4">
          <button
            className="rounded-md p-1.5 hover:bg-surface-sunken md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="text-[13px] font-semibold tracking-tight md:hidden">Tethyr</span>
          <div className="ml-auto flex items-center gap-1">
            {/* Search lives in the sidebar (inline) on md+ — the icon covers
                mobile, and the desktop rail where the field has no room. */}
            <button
              className={`rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground ${
                sidebarCollapsed ? "" : "md:hidden"
              }`}
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <ThemeToggle />
            <Suspense
              fallback={
                <button
                  type="button"
                  aria-label="Notifications"
                  className="relative rounded-full p-2 hover:bg-surface transition-colors"
                >
                  <Bell className="h-4 w-4" />
                </button>
              }
            >
              <NotificationDropdown />
            </Suspense>
          </div>
        </header>

        <EmailVerificationBanner />

        {!online && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 border-b border-caution/30 bg-caution/10 px-4 py-2 text-sm text-caution-foreground"
          >
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>You&apos;re offline — showing your last loaded data.</span>
          </div>
        )}

        <main id="main-content" className="flex-1 pb-16 md:pb-0">
          <Outlet />
        </main>
        <MobilePrimaryNav onOpenMore={() => setOpen(true)} />

        {/* Scroll-to-top */}
        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-20 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border card-border bg-surface transition-spatial hover:scale-105 hover:bg-surface-elevated md:bottom-6 md:right-6"
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <Suspense fallback={null}>
        <GlobalSearch variant="dialog" open={searchOpen} onOpenChange={setSearchOpen} />
        <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      </Suspense>
    </div>
  );
}
