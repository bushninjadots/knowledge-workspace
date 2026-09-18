import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { useTrendingSkills } from "@/hooks/use-current-user";
import { Flame } from "lucide-react";
import { EmptyState } from "./empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export const DiscoverSkills = memo(function DiscoverSkills({ limit = 12 }: { limit?: number }) {
  const { data: skills = [], isLoading } = useTrendingSkills();
  if (isLoading) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-4 rounded-full"
            style={{ width: `${56 + ((i * 37) % 48)}px` }}
          />
        ))}
      </div>
    );
  }
  const trending = skills.slice(0, limit);
  if (trending.length === 0) {
    return (
      <EmptyState
        icon={<Flame className="h-5 w-5" />}
        title="No skills to discover yet"
        description="The catalog is ready—be the first to add a skill to your studio."
        actionLabel="Open your studio"
        actionHref="/profile"
      />
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      {trending.map((s) => (
        <Link
          key={s.id}
          to="/skills/$slug"
          params={{ slug: s.slug }}
          title={s.description ?? undefined}
          aria-label={`Explore the ${s.name} skill`}
          className="text-muted-foreground transition-lift hover:text-primary"
        >
          {s.name}
          {/* One-word skill names ("Go") read as generic link text to a11y
              heuristics — the hidden suffix disambiguates without changing
              the chip's look. */}
          <span className="sr-only"> skill</span>
        </Link>
      ))}
    </div>
  );
});
