// ── Call to Action Block ──────────────────────────────────────────────────────
// One clear next step for a visitor: a line, a sentence, and a button (a link
// or an email address), with an optional second link.

import { ArrowRight } from "lucide-react";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { cn } from "@/lib/utils";
import { safeHref, str, useReportEmpty } from "./content-shared";

function CallToActionBlock({ config, context }: BlockProps) {
  const heading = str(config, "heading");
  const text = str(config, "text");
  const label = str(config, "buttonLabel");
  const href = safeHref(str(config, "buttonUrl"));
  const secondLabel = str(config, "secondaryLabel");
  const secondHref = safeHref(str(config, "secondaryUrl"));
  const centered = config.align === "center";
  const hasButton = !!(label && href);
  const empty = !heading && !text && !hasButton;
  useReportEmpty(context, empty);
  if (empty) {
    return context.isEditing ? (
      <BlockEmptyState
        label="Call to action"
        detail="Give visitors one next step — hire me, book a call, join the project."
      />
    ) : null;
  }
  const external = (url: string) =>
    url.startsWith("mailto:") ? {} : { target: "_blank", rel: "noreferrer" };
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3",
        centered ? "items-center text-center" : "[align-items:var(--studio-block-justify,stretch)]",
      )}
    >
      {heading && (
        <p className="font-display text-xl font-semibold leading-snug text-foreground">{heading}</p>
      )}
      {text && <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{text}</p>}
      {(hasButton || (secondLabel && secondHref)) && (
        <div
          className={cn(
            "mt-1 flex flex-wrap items-center gap-3",
            // Follows the block's own alignment setting as well as its own.
            centered
              ? "justify-center"
              : "[justify-content:var(--studio-block-justify,flex-start)]",
          )}
        >
          {hasButton && (
            <a
              href={href!}
              {...external(href!)}
              className="inline-flex items-center gap-1.5 rounded-[var(--studio-radius,0.5rem)] bg-[var(--user-accent,var(--primary))] px-4 py-2 text-sm font-medium text-[var(--user-accent-foreground,var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent,var(--ring))]"
            >
              {label}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          )}
          {secondLabel && secondHref && (
            <a
              href={secondHref}
              {...external(secondHref)}
              className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-[var(--user-accent-text,var(--primary))]"
            >
              {secondLabel}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

registerBlock({
  type: "call-to-action",
  category: "content",
  label: "Call to action",
  description: "One clear next step with a button: hire me, book a call, get in touch.",
  icon: "MousePointerClick",
  defaults: { heading: "", text: "", buttonLabel: "", buttonUrl: "", align: "left" },
  fields: [
    { key: "heading", label: "Headline", type: "text", placeholder: "Let's build something" },
    {
      key: "text",
      label: "Supporting line",
      type: "textarea",
      placeholder: "I'm taking on two new projects this quarter.",
    },
    { key: "buttonLabel", label: "Button label", type: "text", placeholder: "Get in touch" },
    {
      key: "buttonUrl",
      label: "Button link",
      type: "url",
      placeholder: "https://… or you@example.com",
      help: "A web address or an email address.",
    },
    { key: "secondaryLabel", label: "Second link label", type: "text", placeholder: "See my CV" },
    { key: "secondaryUrl", label: "Second link", type: "url" },
    {
      key: "align",
      label: "Alignment",
      type: "select",
      options: [
        { label: "Left", value: "left" },
        { label: "Centred", value: "center" },
      ],
    },
  ],
  component: CallToActionBlock,
});

export { CallToActionBlock };
