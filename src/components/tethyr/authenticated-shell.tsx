import { useState } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { Menu, Search, X } from "lucide-react";
import { DashboardSidebar } from "./dashboard-sidebar";
import { NotificationDropdown } from "./notifications/notification-dropdown";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, GraduationCap } from "lucide-react";

function MobileSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const trimmed = q.trim();
  const enabled = trimmed.length >= 1;
  const safeTerm = trimmed.replace(/[,%()\\|]/g, (c) => `\\${c}`);
  const like = `%${safeTerm}%`;

  const { data: profiles = [] } = useQuery({
    queryKey: ["mobile-search", "profiles", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, handle, display_name, category, creator_title")
        .or(
          `display_name.ilike.${like},handle.ilike.${like},category.ilike.${like},creator_title.ilike.${like}`,
        )
        .limit(6);
      return data ?? [];
    },
  });

  const { data: skills = [] } = useQuery({
    queryKey: ["mobile-search", "skills", trimmed],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("skills")
        .select("id, name, category")
        .ilike("name", like)
        .limit(6);
      return data ?? [];
    },
  });

  function goToProfile(handle: string) {
    setQ("");
    onOpenChange(false);
    navigate({ to: "/u/$handle", params: { handle } });
  }

  function goToSkill(name: string) {
    setQ("");
    onOpenChange(false);
    navigate({
      to: "/skills/$slug",
      params: {
        slug: name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border/60 px-4 py-3">
          <DialogTitle className="text-sm font-medium">Search</DialogTitle>
        </DialogHeader>
        <div className="p-3">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people, skills…"
            className="h-10 rounded-full border-border/60 bg-surface/60 pl-9"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-1 pb-2">
          {profiles.length > 0 && (
            <div className="mb-1">
              <p className="px-3 pt-1 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                People
              </p>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  disabled={!p.handle}
                  onClick={() => p.handle && goToProfile(p.handle)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-surface disabled:opacity-50"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{p.display_name || p.handle || "Untitled"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.creator_title, p.category].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {skills.length > 0 && (
            <div>
              <p className="px-3 pt-1 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                Skills
              </p>
              {skills.map((s) => (
                <button
                  key={s.id}
                  onClick={() => goToSkill(s.name)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-surface"
                >
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.category}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {enabled && profiles.length === 0 && skills.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">No results.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

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

      <MobileSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
