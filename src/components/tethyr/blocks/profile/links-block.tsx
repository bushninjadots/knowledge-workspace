import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, LinkIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type LinksData = {
  portfolio_links: { label: string; url: string }[];
  social_links: Record<string, string>;
};

function ProfileLinksBlock({ context }: BlockProps) {
  const profileId = context.ownerType === "profile" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["profile-links-block", profileId],
    queryFn: async (): Promise<LinksData | null> => {
      if (!profileId) return null;
      const { data: d } = await supabase
        .from("profiles")
        .select("portfolio_links, social_links")
        .eq("id", profileId)
        .maybeSingle();
      return d as unknown as LinksData | null;
    },
    enabled: !!profileId,
  });

  if (isLoading) return <Skeleton className="h-16 w-full rounded-xl" />;
  if (!data) {
    if (context.isEditing)
      return <BlockEmptyState label="Links" detail="Links will appear here when added." />;
    return null;
  }
  const portfolio = data.portfolio_links ?? [];
  const social = Object.entries(data.social_links ?? {}).filter(([, v]) => !!v);
  if (portfolio.length === 0 && social.length === 0) {
    if (context.isEditing)
      return (
        <BlockEmptyState label="Links" detail="Add portfolio and social links to your profile." />
      );
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Links</h4>
      <div className="flex flex-wrap gap-2">
        {portfolio.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-surface-elevated transition-colors"
          >
            <ExternalLink className="h-3 w-3" /> {link.label}
          </a>
        ))}
        {social.map(([platform, url]) => (
          <a
            key={platform}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-surface-elevated transition-colors"
          >
            <LinkIcon className="h-3 w-3" /> {platform}
          </a>
        ))}
      </div>
    </div>
  );
}

registerBlock({
  type: "profile-links",
  category: "people",
  label: "Links",
  description: "Portfolio and social links.",
  icon: "ExternalLink",
  defaults: { showCategories: true },
  fields: [
    { key: "showCategories", label: "Show category headers", type: "toggle" },
  ],
  component: ProfileLinksBlock,
});
export { ProfileLinksBlock };
