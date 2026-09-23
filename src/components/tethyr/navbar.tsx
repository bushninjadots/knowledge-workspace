import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Menu, X, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { CreateProjectButton } from "./create-project-button";

/**
 * The one and only top navigation. Every public page renders this same bar:
 * same section links, same auth-aware actions, same mobile menu — so moving
 * between landing, explore, profiles and project pages never changes the
 * chrome under the user's hands.
 */
const primaryNavigation = [
  { to: "/explore", label: "Explore" },
  { to: "/skills", label: "Skills" },
  { to: "/challenges", label: "Challenges" },
  { to: "/teams", label: "Teams" },
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
      className={`sticky top-0 z-50 border-b bg-background/95 bg-noise backdrop-blur transition-shadow duration-300 ${
        scrolled ? "border-border shadow-[0_8px_24px_-16px_rgba(0,0,0,0.4)]" : "border-border/70"
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
              <Button asChild variant="default" size="sm" className="rounded-full">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <button
                onClick={handleSignOut}
                className="rounded-full p-2 text-muted-foreground transition-lift hover:bg-surface hover:text-foreground"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
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
                  <div className="flex flex-col gap-2">
                    <CreateProjectButton
                      size="default"
                      label="Create project"
                      className="w-full rounded-full"
                      onCreated={() => setOpen(false)}
                    />
                    <Button asChild variant="default" className="w-full rounded-full">
                      <Link to="/dashboard" onClick={() => setOpen(false)}>
                        Dashboard
                      </Link>
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={handleSignOut}>
                      <LogOut className="mr-1.5 h-4 w-4" />
                      Sign out
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
