import { lazy, Suspense, useState, useMemo, useEffect } from "react";
import { Outlet } from "@tanstack/react-router";
import { Menu, Search, X, ArrowUp, Bell } from "lucide-react";
import { DashboardSidebar } from "./dashboard-sidebar";
import { ThemeToggle } from "./theme-toggle";

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
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUserPalette, paletteToStyle } from "@/lib/dominant-color";
import { MobilePrimaryNav } from "./mobile-primary-nav";
import { BackgroundLayer } from "./background-layer";
import { appearanceStyle } from "@/lib/background-themes";

/**
 * Shared layout for all authenticated routes.
 * The sidebar + mobile menu lives here once — never remounts on navigation.
 * Dynamic user theme from banner image cascades via CSS custom properties.
 */
export function AuthenticatedShell() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: me } = useCurrentUser();
  const palette = useUserPalette(me?.bannerSigned ?? null);
  const themeStyle = useMemo(
    () => ({ ...paletteToStyle(palette), ...appearanceStyle(me?.background) }),
    [palette, me?.background],
  );
  const [showScrollTop, setShowScrollTop] = useState(false);

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
      <BackgroundLayer background={me?.background} imageUrl={me?.backgroundImageUrl} />
      <div className="sticky top-0 hidden h-screen shrink-0 md:block">
        <DashboardSidebar />
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0">
            <DashboardSidebar onNavigate={() => setOpen(false)} />
          </div>
          <button
            className="absolute right-3 top-3 rounded-md border border-border bg-background p-1.5"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
            {/* Search lives in the sidebar (inline) on md+; the icon only shows on mobile */}
            <button
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground md:hidden"
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

        <main className="flex-1 pb-16 md:pb-0">
          <Outlet />
        </main>
        <MobilePrimaryNav onOpenMore={() => setOpen(true)} />

        {/* Scroll-to-top */}
        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border card-border bg-surface shadow-sm transition hover:scale-105 hover:bg-surface-elevated"
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <Suspense fallback={null}>
        <GlobalSearch variant="dialog" open={searchOpen} onOpenChange={setSearchOpen} />
      </Suspense>
    </div>
  );
}
