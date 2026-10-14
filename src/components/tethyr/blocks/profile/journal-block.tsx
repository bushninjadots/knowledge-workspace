import { useEffect } from "react";
import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { KindBadge } from "@/components/tethyr/journal/journal-parts";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicJournal } from "@/hooks/use-journal";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

/** Journal entries the member chose to share: what they built, fixed, decided, learned. */
function ProfileJournalBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : undefined;
  const count = Math.min(Math.max(Number(config.count) || 6, 1), 20);
  const { data: entries, isLoading } = usePublicJournal(profileId, count);
  const hasContent = (entries?.length ?? 0) > 0;

  useEffect(() => {
    if (isLoading || !blockId) return;
    onBlockEmptyChange?.(blockId, !hasContent);
  }, [blockId, hasContent, isEditing, isLoading, onBlockEmptyChange]);

  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!entries || !hasContent) {
    return isEditing ? (
      <BlockEmptyState
        label="Journal highlights"
        detail="In your Journal, tap the eye on an entry to share it. Shared entries show up here — everything else stays private."
      />
    ) : null;
  }
  return (
    <div>
      <BlockTitle config={config}>Journal highlights</BlockTitle>
      <ul className="mt-2 space-y-2.5">
        {entries.map((e) => (
          <li key={e.id} className="flex items-start gap-2.5">
            <KindBadge kind={e.kind} />
            <div className="min-w-0">
              <p className="text-sm break-words">
                {e.source_url ? (
                  <a
                    href={e.source_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="hover:underline"
                  >
                    {e.body}
                  </a>
                ) : (
                  e.body
                )}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(e.occurred_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
                {e.project ? ` · ${e.project.title}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

registerBlock({
  type: "profile-journal",
  category: "work",
  label: "Journal highlights",
  title: "Journal highlights",
  description: "Entries you share from your dev journal — built, fixed, decided, learned.",
  icon: "NotebookPen",
  defaults: { count: "6" },
  fields: [
    {
      key: "count",
      label: "Entries to show",
      type: "select",
      options: [
        { label: "6", value: "6" },
        { label: "10", value: "10" },
        { label: "20", value: "20" },
      ],
    },
  ],
  component: ProfileJournalBlock,
});

export { ProfileJournalBlock };
