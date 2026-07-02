import { useSkillsCatalog } from "@/hooks/use-current-user";
import { Flame } from "lucide-react";
import { EmptyState } from "./empty-state";

export function DiscoverSkills({ limit = 12 }: { limit?: number }) {
  const { data: skills = [], isLoading } = useSkillsCatalog();
  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading trending skills…</div>;
  }
  // Simple deterministic "trending" slice — swap for real signal later.
  const trending = skills.slice(0, limit);
  if (trending.length === 0) {
    return (
      <EmptyState
        icon={<Flame className="h-5 w-5" />}
        title="No skills to discover yet"
        description="The skill catalog will populate as the community grows."
      />
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {trending.map((s) => (
        <span
          key={s.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface px-3 py-1 text-xs text-foreground"
        >
          <Flame className="h-3 w-3 text-brand-purple" />
          {s.name}
        </span>
      ))}
    </div>
  );
}
