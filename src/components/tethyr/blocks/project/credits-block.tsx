import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProfileLink } from "@/components/tethyr/profile-link";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { useProjectCredits } from "@/hooks/use-credits";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

function ProjectCreditsBlock({ config, context }: BlockProps) {
  const projectId = context.ownerType === "project" ? context.ownerId : null;
  // Credits are derived from the project's evidence trail (project_activity +
  // contributors) — the same source the project page's Credits roll uses.
  const { data, isLoading } = useProjectCredits(projectId ?? "");
  if (isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;
  if (!data?.length) {
    if (context.isEditing)
      return <BlockEmptyState label="Credits" detail="Credits will appear here." />;
    return null;
  }
  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-foreground">Credits ({data.length})</h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {data.map((c) => {
          const initial = (c.display_name ?? c.handle ?? "?").charAt(0).toUpperCase();
          return (
            <div
              key={`${c.profile_id}-${c.role}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initial}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <ProfileLink
                  handle={c.handle ?? null}
                  className="text-sm font-medium hover:underline"
                >
                  {c.display_name}
                </ProfileLink>
                <p className="text-xs text-muted-foreground">
                  {c.role}
                  {c.credit_text && config.showCreditText !== false ? ` — ${c.credit_text}` : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
registerBlock({
  type: "project-credits",
  category: "people",
  label: "Credits",
  description: "People credited for contributions to this project.",
  icon: "Heart",
  defaults: { showCreditText: true },
  fields: [{ key: "showCreditText", label: "Show credit descriptions", type: "toggle" }],
  component: ProjectCreditsBlock,
});
export { ProjectCreditsBlock };
