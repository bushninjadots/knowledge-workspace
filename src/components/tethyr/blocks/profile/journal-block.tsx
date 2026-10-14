import { useEffect } from "react";
import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { KindBadge } from "@/components/tethyr/journal/journal-parts";
import { Skeleton } from "@/components/ui/skeleton";
import { useJournalSummary, usePublicJournal } from "@/hooks/use-journal";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

/**
 * "About" from the dev journal: the last 30 days in numbers (counts only —
 * private entries never show), what the member is working on now, and the
 * entries they chose to share.
 */
function ProfileJournalBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : undefined;
  const count = Math.min(Math.max(Number(config.count) || 6, 1), 20);
  const showStats = config.showStats !== false;
  const showNow = config.showNow !== false;
  const showEntries = config.showEntries !== false;
  const { data: entries, isLoading } = usePublicJournal(profileId, Math.max(count, 10));
  const { data: summary, isLoading: summaryLoading } = useJournalSummary(
    showStats ? profileId : undefined,
  );

  const now = (entries ?? []).find((e) => e.kind === "next");
  const shown = (entries ?? []).filter((e) => e.kind !== "next").slice(0, count);
  const stats = summary
    ? [
        { label: "built", value: summary.did },
        { label: "fixed", value: summary.fixed },
        { label: summary.decided === 1 ? "decision" : "decisions", value: summary.decided },
        { label: "learned", value: summary.learned },
        {
          label: summary.active_days === 1 ? "active day" : "active days",
          value: summary.active_days,
        },
      ].filter((s) => s.value > 0)
    : [];
  const hasContent =
    (showStats && stats.length > 0) || (showNow && !!now) || (showEntries && shown.length > 0);
  const loading = isLoading || (showStats && summaryLoading);

  useEffect(() => {
    if (loading || !blockId) return;
    onBlockEmptyChange?.(blockId, !hasContent);
  }, [blockId, hasContent, isEditing, loading, onBlockEmptyChange]);

  if (loading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!hasContent) {
    return isEditing ? (
      <BlockEmptyState
        label="Dev journal"
        detail="Log as you work in your Journal (or let your AI assistant and git do it). Your monthly numbers show here; tap the eye on an entry to share it. Everything else stays private."
      />
    ) : null;
  }

  return (
    <div className="space-y-4">
      <BlockTitle config={config}>Dev journal</BlockTitle>

      {showStats && stats.length > 0 && (
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Last 30 days
          </p>
          <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-2">
            {stats.map((s) => (
              <div key={s.label} className="flex items-baseline gap-1.5">
                <dd className="text-lg font-semibold tabular-nums">{s.value}</dd>
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      )}

      {showNow && now && (
        <div className="rounded-lg bg-surface-elevated/60 px-3 py-2">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Working on now
          </p>
          <p className="mt-0.5 text-sm">
            {now.body}
            {now.project && <span className="text-muted-foreground"> · {now.project.title}</span>}
          </p>
        </div>
      )}

      {showEntries && shown.length > 0 && (
        <ul className="space-y-2.5">
          {shown.map((e) => (
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
      )}
    </div>
  );
}

registerBlock({
  type: "profile-journal",
  category: "work",
  label: "Dev journal",
  title: "Dev journal",
  description:
    "From your journal: the last 30 days in numbers, what you're working on now, and entries you share.",
  icon: "NotebookPen",
  defaults: { count: "6", showStats: true, showNow: true, showEntries: true },
  fields: [
    { key: "showStats", label: "Show the last 30 days in numbers", type: "toggle" },
    { key: "showNow", label: "Show what I'm working on now", type: "toggle" },
    { key: "showEntries", label: "Show shared entries", type: "toggle" },
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
