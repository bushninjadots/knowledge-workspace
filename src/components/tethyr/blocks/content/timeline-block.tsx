// ── Timeline Block ────────────────────────────────────────────────────────────
// A career or project timeline the member writes: when, what, a line of detail.

import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { listItems, useReportEmpty } from "./content-shared";

function TimelineBlock({ config, context }: BlockProps) {
  const items = listItems(config, "items").filter((item) => item.title);
  useReportEmpty(context, items.length === 0);
  if (items.length === 0) {
    return context.isEditing ? (
      <BlockEmptyState
        label="Timeline"
        detail="Add the moments that shaped your work — roles, launches, turning points."
      />
    ) : null;
  }
  return (
    <div className="min-w-0">
      <BlockTitle config={config}>Timeline</BlockTitle>
      <ol className="relative space-y-5 border-l border-border pl-5">
        {items.map((item, index) => (
          <li key={index} className="relative">
            <span
              aria-hidden
              className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface-elevated,var(--background))] bg-[var(--user-accent,var(--primary))]"
            />
            {item.date && (
              <p className="font-mono text-2xs uppercase tracking-wider text-muted-foreground">
                {item.date}
              </p>
            )}
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            {item.detail && (
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

registerBlock({
  type: "timeline",
  category: "work",
  label: "Timeline",
  title: "Timeline",
  description: "Your path in moments: roles, launches and turning points.",
  icon: "GitCommitVertical",
  defaults: { items: [{ date: "", title: "", detail: "" }] },
  fields: [
    {
      key: "items",
      label: "Moments",
      type: "list",
      itemLabel: "moment",
      maxItems: 12,
      itemFields: [
        { key: "date", label: "When", type: "text", placeholder: "2024 – now" },
        { key: "title", label: "What", type: "text", placeholder: "Lead designer, Atlas" },
        {
          key: "detail",
          label: "Detail",
          type: "textarea",
          placeholder: "One line on what changed.",
        },
      ],
    },
  ],
  component: TimelineBlock,
});

export { TimelineBlock };
