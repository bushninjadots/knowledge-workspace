import { BarChart3 } from "lucide-react";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

const DEFAULT_STATS = [
  { label: "Projects", value: "8" },
  { label: "Contributions", value: "42" },
  { label: "Collaborators", value: "12" },
];

function ProfileContributionStatsBlock({ config }: BlockProps) {
  const stats =
    Array.isArray(config.stats) && config.stats.length > 0 ? config.stats : DEFAULT_STATS;
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Contribution stats">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <BarChart3 className="size-4 text-primary" />
        Contribution stats
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.slice(0, 3).map((stat, index) => {
          const item =
            typeof stat === "object" && stat !== null
              ? (stat as { label?: unknown; value?: unknown })
              : {};
          return (
            <div
              key={`${String(item.label ?? "stat")}-${index}`}
              className="border-l border-border pl-3"
            >
              <div className="text-xl font-semibold tracking-tight text-foreground">
                {String(item.value ?? "—")}
              </div>
              <div className="text-xs text-muted-foreground">
                {String(item.label ?? "Activity")}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Evidence-based activity from work shared on Tethyr.
      </p>
    </section>
  );
}

registerBlock({
  type: "profile-contribution-stats",
  category: "community",
  label: "Contribution stats",
  description: "A restrained summary of meaningful work and collaboration.",
  icon: "BarChart3",
  contentSource: "data",
  defaults: { showProjects: true, showContributions: true, showCollaborators: true },
  fields: [
    { key: "showProjects", label: "Show projects", type: "toggle" },
    { key: "showContributions", label: "Show contributions", type: "toggle" },
    { key: "showCollaborators", label: "Show collaborators", type: "toggle" },
  ],
  component: ProfileContributionStatsBlock,
});

export { ProfileContributionStatsBlock };
