// ── Highlights Block ──────────────────────────────────────────────────────────
// A row of headline numbers the member chooses ("12 years building", "40k
// users"), unlike Contribution stats, which counts Tethyr activity.

import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { listItems, useReportEmpty } from "./content-shared";

function HighlightsBlock({ config, context }: BlockProps) {
  const items = listItems(config, "items").filter((item) => item.value || item.label);
  useReportEmpty(context, items.length === 0);
  if (items.length === 0) {
    return context.isEditing ? (
      <BlockEmptyState
        label="Highlights"
        detail="Add a few numbers that tell your story — years, users, launches."
      />
    ) : null;
  }
  return (
    <div className="min-w-0">
      <BlockTitle config={config} hiddenByDefault>
        Highlights
      </BlockTitle>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-x-4 gap-y-5">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex min-w-0 flex-col-reverse border-l-2 border-[var(--user-accent-border,var(--border))] pl-3"
          >
            <dt className="mt-1 text-xs leading-snug text-muted-foreground">{item.label}</dt>
            <dd className="font-display text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

registerBlock({
  type: "highlights",
  category: "work",
  label: "Highlights",
  title: "Highlights",
  titleHiddenByDefault: true,
  description: "Headline numbers you choose: years building, users served, launches.",
  icon: "Sparkles",
  defaults: {
    items: [
      { value: "", label: "" },
      { value: "", label: "" },
      { value: "", label: "" },
    ],
  },
  fields: [
    {
      key: "items",
      label: "Numbers",
      type: "list",
      itemLabel: "number",
      maxItems: 6,
      itemFields: [
        { key: "value", label: "Number", type: "text", placeholder: "12+" },
        { key: "label", label: "Label", type: "text", placeholder: "years shipping products" },
      ],
    },
  ],
  component: HighlightsBlock,
});

export { HighlightsBlock };
