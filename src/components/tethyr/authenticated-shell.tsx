import { useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { Menu, Search, X } from "lucide-react";
import { DashboardSidebar } from "./dashboard-sidebar";
import { NotificationDropdown } from "./notifications/notification-dropdown";
import { GlobalSearch } from "./global-search";

/**
 * Shared layout for all authenticated routes.
 * The sidebar + mobile menu lives here once — never remounts on navigation.
 */
export function AuthenticatedShell() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <DashboardSidebar />
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0">
            <DashboardSidebar onNavigate={() => setOpen(false)} />
          </div>
          <button
            className="absolute right-4 top-4 rounded-full bg-surface p-2"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl sm:px-6 md:hidden">
          <button
            className="rounded-full p-2 hover:bg-surface"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-sm font-semibold">Tethyr</span>
          <div className="ml-auto flex items-center gap-1">
            <NotificationDropdown />
            <button
              className="rounded-full p-2 hover:bg-surface"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      <GlobalSearch variant="dialog" open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
