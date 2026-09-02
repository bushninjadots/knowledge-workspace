import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, LinkIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import { safeHref } from "@/lib/validators";
import type { BlockProps } from "@/lib/page-blocks";

type LinksData = {
  portfolio_links: { label: string; url: string }[];
  social_links: Record<string, string>;
};

function ProfileLinksBlock({ context, config }: BlockProps) {
  const profileId = context.ownerType === "profile" ? context.ownerId : null;
  const { onBlockEmptyChange, isEditing, blockId } = context;

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

  const hasPortfolio = (data?.portfolio_links?.length ?? 0) > 0;
  const hasSocial = Object.values(data?.social_links ?? {}).some((v) => !!v);
  const hasContent = hasPortfolio || hasSocial;
  // Report emptiness so the page renderer can collapse this section in view mode.
  useEffect(() => {
    if (isEditing || !blockId) return;
    onBlockEmptyChange?.(blockId, !hasContent);
  }, [isEditing, blockId, onBlockEmptyChange, hasContent]);

  if (isLoading) return <Skeleton className="h-16 w-full rounded-xl" />;
  if (!data) {
    if (context.isEditing)
      return (
        <BlockEmptyState label="Links" detail="Share where people can find and follow your work." />
      );
    return null;
  }
  const portfolio = data.portfolio_links ?? [];
  const social = Object.entries(data.social_links ?? {}).filter(([, v]) => !!v);
  if (portfolio.length === 0 && social.length === 0) {
    if (context.isEditing)
      return (
        <BlockEmptyState label="Links" detail="Add places where people can follow your work." />
      );
    return null;
  }

  const showCategories = config.showCategories !== false;

  return (
    <div className="space-y-2">
      {showCategories && (
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Links
        </h4>
      )}
      <div className="flex flex-wrap gap-2">
        {portfolio.map((link) => (
          <a
            key={link.url}
            href={safeHref(link.url)}
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
            href={safeHref(url)}
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
  fields: [{ key: "showCategories", label: "Show category headers", type: "toggle" }],
  component: ProfileLinksBlock,
});
export { ProfileLinksBlock };
