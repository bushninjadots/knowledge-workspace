// Explore — foundation for creator discovery.
// Server-safe: reads a small, public projection of profiles + supports
// keyword search across handle, display_name, creator_title and category.
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Compass, Search } from "lucide-react";
import { DashboardSidebar } from "@/components/tethyr/dashboard-sidebar";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/tethyr/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

type Creator = {
  id: string;
  handle: string | null;
  display_name: string | null;
  creator_title: string | null;
  category: string | null;
  country: string | null;
};

const CATEGORIES = [
  "All",
  "Design",
  "Development",
  "Video",
  "Photography",
  "Music",
  "Writing",
  "Marketing",
] as const;

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({
    meta: [
      { title: "Explore — Tethyr" },
      { name: "description", content: "Discover creators to learn from, teach and build with." },
    ],
  }),
  component: ExplorePage,
});

function ExplorePage() {
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");

  const { data, isLoading } = useQuery({
    queryKey: ["explore-creators", meId ?? "anon"],
    queryFn: async (): Promise<Creator[]> => {
      let query = supabase
        .from("profiles")
        .select("id, handle, display_name, creator_title, category, country")
        .not("display_name", "is", null)
        .order("updated_at", { ascending: false })
        .limit(60);
      if (meId) query = query.neq("id", meId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Creator[];
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((c) => {
      if (category !== "All") {
        if (!c.category || c.category.toLowerCase() !== category.toLowerCase()) return false;
      }
      if (!needle) return true;
      return [c.handle, c.display_name, c.creator_title, c.category].some((v) =>
        (v ?? "").toLowerCase().includes(needle),
      );
    });
  }, [data, q, category]);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block">
        <DashboardSidebar />
      </div>
      <main className="flex-1">
        <div className="mx-auto max-w-6xl p-4 md:p-8">
          <header className="mb-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Explore</p>
            <h1 className="font-display text-2xl font-semibold">Discover creators</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Search the network to find people to learn from, teach or build with.
            </p>
          </header>

          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border/60 bg-surface px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, handle, craft…"
              className="border-0 bg-transparent focus-visible:ring-0"
            />
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  category === c
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl border border-border/60 bg-surface"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Compass className="h-5 w-5" />}
              title="No creators match yet"
              description="Try clearing filters or searching a different craft."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => {
                const initial = (c.display_name ?? c.handle ?? "?").charAt(0).toUpperCase();
                return (
                  <Link
                    key={c.id}
                    to="/u/$handle"
                    params={{ handle: c.handle ?? "" }}
                    className="rounded-2xl border border-border/60 bg-surface p-4 transition hover:border-primary/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-purple text-sm font-semibold text-background">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {c.display_name || c.handle || "Untitled creator"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.creator_title || c.category || "New creator"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                      {c.handle ? <span className="truncate">@{c.handle}</span> : <span />}
                      {c.country && <span>{c.country}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
