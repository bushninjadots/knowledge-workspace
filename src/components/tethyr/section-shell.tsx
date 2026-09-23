import { lazy, Suspense, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  Compass,
  Menu,
  Search,
  Swords,
  Tags,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { DashboardSidebar } from "./dashboard-sidebar";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuthUser } from "@/hooks/use-current-user";
import { useSidebarRail } from "@/hooks/use-sidebar-rail";
import { cn } from "@/lib/utils";
import { NavigationProgress } from "./navigation-progress";

// Notification/Search are auth-only chrome — keep them (and their query
// graphs) out of the public section pages' initial chunk, same as the
// authenticated shell does.
const NotificationDropdown = lazy(() =>
  import("./notifications/notification-dropdown").then((m) => ({
    default: m.NotificationDropdown,
  })),
);
const GlobalSearch = lazy(() =>
  import("./global-search").then((m) => ({ default: m.GlobalSearch })),
);

/** The section destinations, same as the top navigation used to expose —
 * now presented in the sidebar so signed-in and signed-out visitors share
 * one navigation model. */
const PUBLIC_SECTIONS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/skills", label: "Skills", icon: Tags },
  { to: "/challenges", label: "Challenges", icon: Swords },
  { to: "/teams", label: "Teams", icon: UsersRound },
];

/**
 * Signed-out / still-loading sidebar. Same geometry and item treatment as
 * the DashboardSidebar so swapping between the two never shifts layout.
 */
function PublicSectionSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside
      id="app-sidebar"
      className="relative flex h-full w-60 flex-col overflow-hidden border-r border-border bg-surface"
    >
      <div className="flex h-12 items-center gap-1 border-b border-border px-3">
        <Logo />
      </div>

      <nav aria-label="Section navigation" className="flex-1 overflow-y-auto px-2 pb-4 pt-5">
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Discover
        </p>
        <div className="flex flex-col">
          {PUBLIC_SECTIONS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-7 items-center gap-2 rounded-sm px-2 text-[13px] transition-colors ${
                  isActive
                    ? "bg-[var(--user-accent-subtle,var(--learning-subtle))] font-medium text-[var(--user-accent,var(--foreground))]"
                    : "text-muted-foreground hover:bg-surface-sunken hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto border-t border-border px-3 py-3">
        <div className="flex flex-col gap-2">
          <Button asChild variant="ghost" size="sm" className="w-full justify-start">
            <Link to="/login" onClick={onNavigate}>
              Log in
            </Link>
          </Button>
          <Button asChild variant="default" size="sm" className="w-full justify-start rounded-full">
            <Link to="/signup" onClick={onNavigate}>
              Join Tethyr
            </Link>
          </Button>
        </div>
      </div>
    </aside>
  );
}

/**
 * Shared frame for every section/hub page (skills, projects, profiles,
 * teams): the sidebar navigation area — the full app sidebar when signed in,
 * a section sidebar for visitors — plus a standard Back button in a slim
 * top bar. Replaces the marketing top navigation these pages used to render,
 * so the chrome never changes under the user's hands when they arrive from
 * the sidebar. Public pages stay public (no auth gate, no noindex).
 *
 * `className`/`style` land on the frame root (page backgrounds, density);
 * `mainClassName`/`mainStyle` land on the content element (themed canvases
 * like a profile page's).
 */
export function SectionShell({
  children,
  backTo = "/",
  className,
  style,
  mainClassName,
  mainStyle,
}: {
  children: ReactNode;
  /** Fallback target when there is no history to go back to. */
  backTo?: string;
  className?: string;
  style?: CSSProperties;
  mainClassName?: string;
  mainStyle?: CSSProperties;
}) {
  const { data: sessionUser } = useAuthUser();
  const isAuthed = Boolean(sessionUser);
  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebarRail();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: backTo });
  }

  return (
    <div
      className={cn("relative isolate flex min-h-screen bg-background", className)}
      style={style}
    >
      <NavigationProgress />
      <div className="sticky top-0 hidden h-screen shrink-0 md:block">
        {isAuthed ? (
          <DashboardSidebar collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
        ) : (
          <PublicSectionSidebar />
        )}
      </div>

      {/* Mobile: the same sidebar, in a drawer — like the app shell. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-0 top-0 h-full w-[min(20rem,85vw)] translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-r border-border p-0 md:hidden">
          <DialogTitle className="sr-only">Tethyr navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Navigate to a different area of Tethyr.
          </DialogDescription>
          {isAuthed ? (
            <DashboardSidebar onNavigate={() => setOpen(false)} />
          ) : (
            <PublicSectionSidebar onNavigate={() => setOpen(false)} />
          )}
        </DialogContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-background px-3 sm:px-4">
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
          <button
            type="button"
            className="rounded-md p-1.5 hover:bg-surface-sunken md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="text-[13px] font-semibold tracking-tight md:hidden">Tethyr</span>
          <div className="ml-auto flex items-center gap-1">
            {/* Search lives in the sidebar (inline) on md+ — the icon covers
                mobile, and the collapsed rail where the field has no room. */}
            {isAuthed && (
              <button
                type="button"
                className={`rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground ${
                  sidebarCollapsed ? "" : "md:hidden"
                }`}
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
                  <div className="h-8 w-8 animate-gentle-pulse rounded-full bg-surface-elevated" />
                }
              >
                <NotificationDropdown />
              </Suspense>
            )}
          </div>
        </header>

        <main id="main-content" className={cn("flex-1", mainClassName)} style={mainStyle}>
          {children}
        </main>
      </div>

      <Suspense fallback={null}>
        {isAuthed && (
          <GlobalSearch variant="dialog" open={searchOpen} onOpenChange={setSearchOpen} />
        )}
      </Suspense>
    </div>
  );
}
