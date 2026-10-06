// ── Services Block ────────────────────────────────────────────────────────────
// What the member offers, each with a line of detail and an optional price or
// timeframe — the block freelancers and consultants reach for first.

import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { listItems, useReportEmpty } from "./content-shared";

function ServicesBlock({ config, context }: BlockProps) {
  const items = listItems(config, "items").filter((item) => item.name);
  useReportEmpty(context, items.length === 0);
  if (items.length === 0) {
    return context.isEditing ? (
      <BlockEmptyState
        label="Services"
        detail="List what you offer — a line on each, and a rate or timeframe if you like."
      />
    ) : null;
  }
  return (
    <div className="min-w-0">
      <BlockTitle config={config}>What I offer</BlockTitle>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-3">
        {items.map((item, index) => (
          <li
            key={index}
            className="flex min-w-0 flex-col gap-1 rounded-[calc(var(--studio-radius,0.5rem)*0.6)] bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] p-3"
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-foreground">{item.name}</span>
              {item.price && (
                <span className="shrink-0 font-mono text-2xs text-[var(--user-accent-text,var(--primary))]">
                  {item.price}
                </span>
              )}
            </span>
            {item.detail && (
              <span className="text-sm leading-relaxed text-muted-foreground">{item.detail}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

registerBlock({
  type: "services",
  category: "identity",
  label: "Services",
  title: "What I offer",
  description: "What you offer, with a line on each and an optional rate.",
  icon: "BriefcaseBusiness",
  defaults: { items: [{ name: "", detail: "", price: "" }] },
  fields: [
    {
      key: "items",
      label: "Services",
      type: "list",
      itemLabel: "service",
      maxItems: 8,
      itemFields: [
        { key: "name", label: "Service", type: "text", placeholder: "Product design sprint" },
        {
          key: "detail",
          label: "Detail",
          type: "textarea",
          placeholder: "Two weeks from idea to tested prototype.",
        },
        {
          key: "price",
          label: "Rate or timeframe",
          type: "text",
          placeholder: "from €4k · 2 weeks",
        },
      ],
    },
  ],
  component: ServicesBlock,
});

export { ServicesBlock };
