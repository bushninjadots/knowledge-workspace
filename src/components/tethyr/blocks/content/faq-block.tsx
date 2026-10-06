// ── FAQ Block ─────────────────────────────────────────────────────────────────
// Questions people ask before working with you, each answer folded away.

import { ChevronDown } from "lucide-react";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { listItems, useReportEmpty } from "./content-shared";

function FaqBlock({ config, context }: BlockProps) {
  const items = listItems(config, "items").filter((item) => item.question);
  useReportEmpty(context, items.length === 0);
  if (items.length === 0) {
    return context.isEditing ? (
      <BlockEmptyState
        label="FAQ"
        detail="Answer what people ask before working with you — rates, process, timezone."
      />
    ) : null;
  }
  return (
    <div className="min-w-0">
      <BlockTitle config={config}>Questions people ask</BlockTitle>
      <div className="divide-y divide-border border-y border-border">
        {items.map((item, index) => (
          <details
            key={index}
            className="group py-3"
            open={index === 0 && config.openFirst === true}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDown
                aria-hidden
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              />
            </summary>
            {item.answer && (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}

registerBlock({
  type: "faq",
  category: "content",
  label: "FAQ",
  title: "Questions people ask",
  description: "Answers to what people ask before working with you.",
  icon: "MessageCircleQuestion",
  defaults: { items: [{ question: "", answer: "" }] },
  fields: [
    {
      key: "items",
      label: "Questions",
      type: "list",
      itemLabel: "question",
      maxItems: 10,
      itemFields: [
        { key: "question", label: "Question", type: "text", placeholder: "What's your timezone?" },
        { key: "answer", label: "Answer", type: "textarea" },
      ],
    },
    { key: "openFirst", label: "Open the first answer", type: "toggle" },
  ],
  component: FaqBlock,
});

export { FaqBlock };
