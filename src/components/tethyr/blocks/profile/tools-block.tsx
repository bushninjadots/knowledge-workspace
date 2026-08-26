import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type ToolsData = { favourite_tools: string[]; software_stack: string[] };

function ProfileToolsBlock({ context }: BlockProps) {
  const profileId = context.ownerType === "profile" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["profile-tools-block", profileId],
    queryFn: async (): Promise<ToolsData | null> => {
      if (!profileId) return null;
      const { data: d } = await supabase
        .from("profiles")
        .select("favourite_tools, software_stack")
        .eq("id", profileId)
        .maybeSingle();
      return d as unknown as ToolsData | null;
    },
    enabled: !!profileId,
  });

  if (isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;
  if (!data) {
    if (context.isEditing)
      return (
        <BlockEmptyState
          label="Tools & Stack"
          detail="Tools will appear here when added to your profile."
        />
      );
    return null;
  }
  const tools = data.favourite_tools ?? [];
  const stack = data.software_stack ?? [];
  if (tools.length === 0 && stack.length === 0) {
    if (context.isEditing)
      return (
        <BlockEmptyState label="Tools & Stack" detail="Add tools and software to your profile." />
      );
    return null;
  }

  return (
    <div className="space-y-3">
      {tools.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> favourite tools
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {tools.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-surface-sunken px-2.5 py-1 text-xs text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      {stack.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> software stack
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {stack.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-surface-sunken px-2.5 py-1 text-xs text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

registerBlock({
  type: "profile-tools",
  category: "people",
  label: "Tools & Stack",
  description: "Favourite tools and software stack.",
  icon: "Wrench",
  defaults: {},
  component: ProfileToolsBlock,
});
export { ProfileToolsBlock };
