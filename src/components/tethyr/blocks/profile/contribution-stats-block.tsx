import { useEffect } from "react";
import { BarChart3 } from "lucide-react";
import { registerBlock } from "@/lib/block-registry";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { useProfileWorkSummary } from "@/hooks/use-profile-work-summary";
import type { BlockProps } from "@/lib/page-blocks";

// Real counts only: a profile with no projects, contributions, or
// collaborators renders nothing publicly rather than sample numbers.
function ProfileContributionStatsBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : null;
  const { data, isLoading } = useProfileWorkSummary(profileId);

  const stats = [
    { label: "Projects", value: data?.projects ?? 0, shown: config.showProjects !== false },
    {
      label: "Contributions",
      value: data?.contributions ?? 0,
      shown: config.showContributions !== false,
    },
    {
      label: "Collaborators",
      value: data?.collaborators.length ?? 0,
      shown: config.showCollaborators !== false,
    },
  ].filter((stat) => stat.shown);
  const isEmpty = stats.every((stat) => stat.value === 0);

  useEffect(() => {
    if (isLoading || !blockId) return;
    onBlockEmptyChange?.(blockId, isEmpty);
  }, [blockId, isEmpty, isEditing, isLoading, onBlockEmptyChange]);

  if (isLoading) return null;
  if (isEmpty) {
    return isEditing ? (
      <BlockEmptyState
        label="Contribution stats"
        detail="Your project, contribution, and collaborator counts appear here once you start building."
      />
    ) : null;
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Contribution stats">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <BarChart3 className="size-4 text-primary" aria-hidden="true" />
        Contribution stats
      </div>
      <dl className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse border-l border-border pl-3">
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="text-xl font-semibold tracking-tight text-foreground tabular-nums">
              {stat.value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Counted from projects and contributions on Tethyr.
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
