// ── Quote Block ───────────────────────────────────────────────────────────────
// A pull quote or testimonial: words, who said them, and their role.

import { Quote } from "lucide-react";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { cn } from "@/lib/utils";
import { str, useReportEmpty } from "./content-shared";

function QuoteBlock({ config, context }: BlockProps) {
  const quote = str(config, "quote");
  const who = str(config, "attribution");
  const role = str(config, "role");
  const large = config.size === "large";
  useReportEmpty(context, !quote);
  if (!quote) {
    return context.isEditing ? (
      <BlockEmptyState
        label="Quote"
        detail="Add the words in its settings — a testimonial, a principle, a line you live by."
      />
    ) : null;
  }
  return (
    <figure className="relative min-w-0">
      <Quote
        aria-hidden
        className="mb-2 h-5 w-5 text-[var(--user-accent-text,var(--primary))] opacity-80"
      />
      <blockquote
        className={cn(
          "font-display text-foreground",
          large ? "text-xl leading-snug sm:text-2xl" : "text-base leading-relaxed",
        )}
      >
        {quote}
      </blockquote>
      {(who || role) && (
        <figcaption className="mt-3 text-sm text-muted-foreground">
          {who && <span className="font-medium text-foreground">{who}</span>}
          {who && role && " · "}
          {role}
        </figcaption>
      )}
    </figure>
  );
}

registerBlock({
  type: "quote",
  category: "content",
  label: "Quote",
  description: "A testimonial or pull quote with who said it.",
  icon: "Quote",
  defaults: { quote: "", attribution: "", role: "", size: "regular" },
  fields: [
    { key: "quote", label: "Quote", type: "textarea", placeholder: "“Working with them was…”" },
    { key: "attribution", label: "Who said it", type: "text", placeholder: "Name" },
    { key: "role", label: "Their role", type: "text", placeholder: "Founder, Atlas" },
    {
      key: "size",
      label: "Size",
      type: "select",
      options: [
        { label: "Regular", value: "regular" },
        { label: "Large", value: "large" },
      ],
    },
  ],
  component: QuoteBlock,
});

export { QuoteBlock };
