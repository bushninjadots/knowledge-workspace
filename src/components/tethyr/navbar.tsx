import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, X, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";

const links = [{ to: "/", label: "Home" }];

export function Navbar() {
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isAuthed = Boolean(me?.userId);
  const navLinks = isAuthed ? [...links, { to: "/dashboard" as const, label: "Dashboard" }] : links;

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
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-all duration-200 hover:bg-surface hover:text-foreground"
              activeProps={{ className: "text-foreground bg-surface" }}
              activeOptions={{ exact: true }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {isAuthed ? (
            <>
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
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-full p-2 transition-colors hover:bg-surface md:hidden"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1 px-4 py-4">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            {isAuthed ? (
              <div className="mt-2 space-y-2">
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
