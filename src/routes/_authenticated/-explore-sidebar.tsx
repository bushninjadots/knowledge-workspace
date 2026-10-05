// Explore page side panel and small shared pieces (stat rows, load-more).
//
// Split out of -explore-page.tsx; the tabs and their filter state stay there.

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Folder, Users, Briefcase, Sparkles, TrendingUp, Hash, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCountUp } from "@/hooks/use-count-up";
import { supabase } from "@/integrations/supabase/client";
import { useTrendingSkills } from "@/hooks/use-current-user";

export type Tab = "projects" | "creators" | "opportunities";

export function ExploreStat({ value, label }: { value: number; label: string }) {
  const { ref, value: count } = useCountUp(value);
  return (
    <div>
      <p
        ref={ref}
        className="font-title text-2xl font-semibold tracking-[-0.04em] text-foreground tabular-nums sm:text-3xl"
      >
        {count}
      </p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

export function DiscoverSidebar({ tab }: { tab: Tab }) {
  const { data: stats } = useQuery({
    queryKey: ["discover-sidebar-stats"],
    queryFn: async () => {
      const [projects, creators, skills, opportunities] = await Promise.all([
        supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .then(({ count }) => count ?? 0),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .then(({ count }) => count ?? 0),
        supabase
          .from("skills")
          .select("id", { count: "exact", head: true })
          .then(({ count }) => count ?? 0),
        supabase
          .from("project_open_roles")
          .select("id", { count: "exact", head: true })
          .eq("is_filled", false)
          .then(({ count }) => count ?? 0),
      ]);
      return { projects, creators, skills, opportunities };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Ranked by real usage (teach/learn/project references), not catalog insert
  // order — the old query surfaced the most-recently-added catalog batch
  // (a wall of wellness skills) instead of what the community actually uses.
  const { data: trendingSkills = [] } = useTrendingSkills();

  return (
    <div className="sticky top-24 space-y-5">
      {/* Stats card */}
      <Card className="bg-surface/60 p-4">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          Quick stats
        </h3>
        <div className="mt-3 space-y-2">
          <StatRow
            icon={<Folder className="h-3.5 w-3.5" />}
            label="Projects"
            value={stats?.projects}
          />
          <StatRow
            icon={<Users className="h-3.5 w-3.5" />}
            label="Creators"
            value={stats?.creators}
          />
          <StatRow
            icon={<Briefcase className="h-3.5 w-3.5" />}
            label="Open roles"
            value={stats?.opportunities}
          />
          <StatRow
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="Skills"
            value={stats?.skills}
          />
        </div>
      </Card>

      {/* Trending skills */}
      {trendingSkills && trendingSkills.length > 0 && (
        <Card className="bg-surface/60 p-4">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Hash className="h-3.5 w-3.5" />
            Trending skills
          </h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {trendingSkills.slice(0, 8).map((s) => (
              <Link
                key={s.id}
                to="/skills/$slug"
                params={{ slug: s.slug }}
                preload="intent"
                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground hover:bg-surface-elevated"
              >
                {s.name}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Contextual hint based on tab */}
      <div className="rounded-xl border border-border/40 bg-surface/30 p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {tab === "projects"
            ? "Browse projects from the community. Use the shelf to flip through covers, or search for something specific."
            : tab === "creators"
              ? "Find people to collaborate with. Filter by craft or search by name."
              : "Open roles waiting for someone like you. Match based on your skills."}
        </p>
      </div>
    </div>
  );
}

function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="numeric font-medium tabular-nums text-foreground">
        {value != null ? value.toLocaleString() : "–"}
      </span>
    </div>
  );
}

export function LoadMoreButton({
  canLoadMore,
  isLoading,
  onLoadMore,
}: {
  canLoadMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}) {
  if (!canLoadMore) return null;
  return (
    <div className="flex justify-center pt-6">
      <Button
        variant="outline"
        size="sm"
        onClick={onLoadMore}
        disabled={isLoading}
        className="rounded-full text-muted-foreground"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Loading…
          </>
        ) : (
          "Load more"
        )}
      </Button>
    </div>
  );
}
