import { useEffect } from "react";
import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type ToolsData = { favourite_tools: string[]; software_stack: string[] };

function ProfileToolsBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange } = context;
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

  const tools = data && config.showFavourites !== false ? (data.favourite_tools ?? []) : [];
  const stack = data && config.showStack !== false ? (data.software_stack ?? []) : [];
  const hasContent = tools.length > 0 || stack.length > 0;
  useEffect(() => {
    if (isLoading || !blockId) return;
    onBlockEmptyChange?.(blockId, !hasContent);
  }, [blockId, hasContent, isEditing, isLoading, onBlockEmptyChange]);

  if (isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;
  if (!data) {
    if (context.isEditing)
      return (
        <BlockEmptyState
          label="Tools & stack"
          detail="Show the tools and software you build with."
        />
      );
    return null;
  }
  if (!hasContent) {
    if (context.isEditing)
      return <BlockEmptyState label="Tools & stack" detail="Add the tools and software you use." />;
    return null;
  }

  return (
    <div className="space-y-3">
      <BlockTitle config={config} hiddenByDefault>
        Tools & stack
      </BlockTitle>
      {tools.length > 0 && (
        <div>
          <h3 className="block-subtitle flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" aria-hidden /> Favourite tools
          </h3>
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
          <h3 className="block-subtitle flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" aria-hidden /> Software stack
          </h3>
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
  category: "skills",
  label: "Tools & stack",
  title: "Tools & stack",
  titleHiddenByDefault: true,
  description: "Favourite tools and software stack.",
  icon: "Wrench",
  defaults: { showFavourites: true, showStack: true },
  fields: [
    { key: "showFavourites", label: "Show favourite tools", type: "toggle" },
    { key: "showStack", label: "Show software stack", type: "toggle" },
  ],
  component: ProfileToolsBlock,
});
export { ProfileToolsBlock };
