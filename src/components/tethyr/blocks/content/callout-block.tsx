// ── Callout Block ─────────────────────────────────────────────────────────────
// A short note that stands out: availability news, a launch, a heads-up.

import { Info, Megaphone, Sparkles } from "lucide-react";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { cn } from "@/lib/utils";
import { str, useReportEmpty } from "./content-shared";

const TONES = {
  note: { icon: Info, className: "bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)]" },
  accent: { icon: Sparkles, className: "bg-[var(--user-accent-subtle,var(--surface-sunken))]" },
  news: { icon: Megaphone, className: "bg-trust/10" },
} as const;

function CalloutBlock({ config, context }: BlockProps) {
  const text = str(config, "text");
  const heading = str(config, "heading");
  const tone = TONES[(config.tone as keyof typeof TONES) ?? "accent"] ?? TONES.accent;
  const Icon = tone.icon;
  const empty = !text && !heading;
  useReportEmpty(context, empty);
  if (empty) {
    return context.isEditing ? (
      <BlockEmptyState label="Callout" detail="Add a short note that should stand out." />
    ) : null;
  }
  return (
    <aside
      className={cn(
        "flex min-w-0 gap-3 rounded-[calc(var(--studio-radius,0.5rem)*0.6)] p-4",
        tone.className,
      )}
    >
      <Icon
        aria-hidden
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--user-accent-text,var(--primary))]"
      />
      <div className="min-w-0">
        {heading && <p className="text-sm font-semibold text-foreground">{heading}</p>}
        {text && (
          <p
            className={cn(
              "whitespace-pre-wrap text-sm leading-relaxed text-foreground/85",
              heading && "mt-0.5",
            )}
          >
            {text}
          </p>
        )}
      </div>
    </aside>
  );
}

registerBlock({
  type: "callout",
  category: "content",
  label: "Callout",
  description: "A short note that stands out: news, availability, a heads-up.",
  icon: "Megaphone",
  defaults: { heading: "", text: "", tone: "accent" },
  fields: [
    { key: "heading", label: "Heading", type: "text", placeholder: "Booking for June" },
    { key: "text", label: "Text", type: "textarea" },
    {
      key: "tone",
      label: "Tone",
      type: "select",
      options: [
        { label: "Accent", value: "accent" },
        { label: "Note", value: "note" },
        { label: "News", value: "news" },
      ],
    },
  ],
  component: CalloutBlock,
});

export { CalloutBlock };
