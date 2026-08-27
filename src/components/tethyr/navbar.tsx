import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, X, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { CreateProjectButton } from "./create-project-button";

export function Navbar({ publicOnly = false }: { publicOnly?: boolean }) {
  const { data: me, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isAuthed = Boolean(me?.userId);

  // Close the mobile menu on Escape — a menu that can't be dismissed by
  // keyboard is a focus trap.
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
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 bg-noise backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        {!publicOnly && (
          <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
            <Link
              to="/"
              className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors duration-200 hover:bg-surface hover:text-foreground"
              activeProps={{ className: "text-foreground bg-surface" }}
              activeOptions={{ exact: true }}
            >
              Home
            </Link>
          </nav>
        )}
        <div className="hidden items-center gap-2 md:flex">
          {!publicOnly && <ThemeToggle />}
          {publicOnly || isLoading ? (
            publicOnly ? (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild variant="default" size="sm" className="rounded-full">
                  <Link to="/signup">Join Tethyr</Link>
                </Button>
              </>
            ) : (
              <div className="h-8 w-20 animate-pulse rounded-full bg-surface-elevated" />
            )
          ) : isAuthed ? (
            <>
              <CreateProjectButton size="sm" label="Create project" className="rounded-full" />
              <Button asChild variant="default" size="sm" className="rounded-full">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <button
                onClick={handleSignOut}
                className="rounded-full p-2 text-muted-foreground transition hover:bg-surface hover:text-foreground"
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
        {!publicOnly && (
          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-md p-2 transition-colors hover:bg-surface md:hidden"
              aria-label="Toggle menu"
              aria-expanded={open}
              aria-controls="mobile-menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        )}
      </div>
      {open && !publicOnly && (
        <div
          id="mobile-menu"
          className="border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden"
        >
          <div className="flex flex-col gap-1 px-4 py-4">
            <Link
              to="/"
              onClick={() => setOpen(false)}
              className="rounded-md px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              Home
            </Link>
            {publicOnly ? (
              <div className="mt-2 flex gap-2">
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
            ) : isAuthed ? (
              <div className="mt-2 space-y-2">
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
                <Button variant="outline" className="w-full rounded-full" onClick={handleSignOut}>
                  <LogOut className="mr-1 h-4 w-4" />
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/login" onClick={() => setOpen(false)}>
                    Log in
                  </Link>
                </Button>
                <Button asChild variant="default" className="flex-1 rounded-full">
                  <Link to="/signup" onClick={() => setOpen(false)}>
                    Join
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
