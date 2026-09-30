import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Menu, X, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { CreateProjectButton } from "./create-project-button";

/**
 * The one and only top navigation for public pages. It carries Tethyr's major
 * areas — discovery and community — while the user's own spaces (workspace,
 * studio, messages, settings) live in the account menu, mirroring the
 * authenticated shell's hierarchy instead of duplicating it as equal peers.
 */
const primaryNavigation = [
  { to: "/explore", label: "Explore" },
  { to: "/community", label: "Community" },
  { to: "/challenges", label: "Challenges" },
] as const;

/** Shared animated-underline link styling for the desktop bar. */
function desktopLinkClass(active: boolean) {
  return [
    "relative rounded-md px-3 py-2 text-sm transition-colors duration-200",
    "hover:text-foreground focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-full",
    "after:bg-primary after:transition-transform after:duration-300 after:ease-out",
    active
      ? "text-foreground after:scale-x-100"
      : "text-muted-foreground after:scale-x-0 after:origin-left hover:after:scale-x-100",
  ].join(" ");
}

export function Navbar() {
  const { data: me, isLoading } = useCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isAuthed = Boolean(me?.userId);
  const prevPath = useRef(location.pathname);

  // Close the mobile menu whenever the route changes (link tap or back button).
  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      prevPath.current = location.pathname;
      setOpen(false);
    }
  }, [location.pathname]);

  // Elevate the bar once the page scrolls — subtle shadow + blur.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Escape closes the mobile menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  }

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-background bg-noise transition-colors duration-300 ${
        scrolled ? "border-border" : "border-border/70"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />

        {/* Desktop: primary section links — always visible, always the same */}
        <nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex">
          {primaryNavigation.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isActive(item.to) ? "page" : undefined}
              className={desktopLinkClass(isActive(item.to))}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop: right-side actions adapt to sign-in state */}
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {isLoading ? (
            <div className="h-8 w-20 animate-gentle-pulse rounded-full bg-surface-elevated" />
          ) : isAuthed ? (
            <>
              <CreateProjectButton size="sm" label="Create project" className="rounded-full" />
              <AccountMenu
                name={me?.profile?.display_name ?? me?.profile?.handle ?? "Member"}
                onSignOut={handleSignOut}
              />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild variant="default" size="sm" className="rounded-full">
                <Link to="/signup">Join Tethyr</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile: hamburger */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setOpen((v) => !v)}
            className="-mr-2 rounded-md p-2.5 transition-colors hover:bg-surface"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            <span className="relative block h-5 w-5">
              <Menu
                className={`absolute inset-0 h-5 w-5 transition-[transform,opacity] duration-200 ${
                  open ? "rotate-90 opacity-0" : "rotate-0 opacity-100"
                }`}
              />
              <X
                className={`absolute inset-0 h-5 w-5 transition-[transform,opacity] duration-200 ${
                  open ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile menu: animated panel + tap-outside backdrop */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="animate-in fade-in-0 fixed inset-0 top-16 z-40 cursor-default bg-background/60 backdrop-blur-sm duration-200 md:hidden"
          />
          <div
            id="mobile-menu"
            className="animate-in fade-in-0 slide-in-from-top-2 absolute inset-x-0 top-full z-50 border-b border-border/60 bg-background/95 shadow-lg backdrop-blur-xl duration-200 md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4">
              <nav aria-label="Mobile primary navigation" className="flex flex-col gap-1">
                {isAuthed && (
                  <>
                    <Link
                      to="/dashboard"
                      onClick={() => setOpen(false)}
                      aria-current={isActive("/dashboard") ? "page" : undefined}
                      className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        isActive("/dashboard") ? "bg-surface text-foreground" : "text-foreground"
                      }`}
                    >
                      Your workspace
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setOpen(false)}
                      aria-current={isActive("/profile") ? "page" : undefined}
                      className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        isActive("/profile") ? "bg-surface text-foreground" : "text-foreground"
                      }`}
                    >
                      Your Studio
                    </Link>
                  </>
                )}
                {primaryNavigation.map((item, i) => {
                  const active = isActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      style={{ animationDelay: `${i * 30}ms` }}
                      className={`animate-in fade-in-0 slide-in-from-left-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors duration-200 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        active ? "bg-surface text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-3 border-t border-border/60 pt-3">
                {isAuthed ? (
                  <div className="flex items-center gap-2">
                    <CreateProjectButton
                      size="default"
                      label="Create project"
                      className="flex-1 rounded-full"
                      onCreated={() => setOpen(false)}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full"
                      onClick={handleSignOut}
                      aria-label="Sign out"
                      title="Sign out"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button asChild variant="outline" className="flex-1">
                      <Link to="/login" onClick={() => setOpen(false)}>
                        Log in
                      </Link>
                    </Button>
                    <Button asChild variant="default" className="flex-1 rounded-full">
                      <Link to="/signup" onClick={() => setOpen(false)}>
                        Join Tethyr
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}

/* ── Account menu: the user's own spaces on public pages ────────────────────
 * Same destinations as the authenticated shell's Workspace/You groups so the
 * hierarchy reads the same everywhere, and the dashboard never has to compete
 * with the navbar over navigation.
 */
function AccountMenu({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          aria-label={`Account menu for ${name}`}
        >
          {name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Your Tethyr</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/dashboard">Your workspace</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile">Your Studio</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/messages">Messages</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/notifications">Notifications</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/sessions">Sessions</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/connections">Connections</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onSignOut();
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
