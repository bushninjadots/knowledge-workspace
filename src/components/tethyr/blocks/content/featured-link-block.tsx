// ── Featured Link Block ───────────────────────────────────────────────────────
// One link worth a whole card: a talk, an article, a launch, a case study.

import { ArrowUpRight } from "lucide-react";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { isSafeUrl } from "@/lib/validators";
import { safeHref, str, useReportEmpty } from "./content-shared";

function FeaturedLinkBlock({ config, context }: BlockProps) {
  const href = safeHref(str(config, "url"));
  const image = str(config, "imageUrl");
  const domain =
    href && !href.startsWith("mailto:") ? new URL(href).hostname.replace(/^www\./, "") : "";
  const title = str(config, "title") || domain;
  const description = str(config, "description");
  const kicker = str(config, "kicker");
  const empty = !href;
  useReportEmpty(context, empty);
  if (empty) {
    return context.isEditing ? (
      <BlockEmptyState
        label="Featured link"
        detail="Feature one link — a talk, an article, a launch, a case study."
      />
    ) : null;
  }
  return (
    <a
      href={href!}
      target="_blank"
      rel="noreferrer"
      // The block's own frame is the card; the link fills it without a second border.
      className="group flex min-w-0 flex-col gap-4 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] sm:flex-row"
    >
      {image && isSafeUrl(image) && (
        <img
          src={image}
          alt=""
          loading="lazy"
          className="aspect-[16/9] w-full rounded-[calc(var(--studio-radius,0.5rem)*0.6)] object-cover sm:aspect-auto sm:w-2/5"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {kicker && (
          <span className="font-mono text-2xs uppercase tracking-wider text-[var(--user-accent-text,var(--primary))]">
            {kicker}
          </span>
        )}
        <span className="flex items-start justify-between gap-2 font-display text-base font-semibold leading-snug text-foreground">
          {title}
          <ArrowUpRight
            aria-hidden
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </span>
        {description && (
          <span className="text-sm leading-relaxed text-muted-foreground">{description}</span>
        )}
        {domain && <span className="mt-1 font-mono text-2xs text-muted-foreground">{domain}</span>}
      </span>
    </a>
  );
}

registerBlock({
  type: "featured-link",
  category: "content",
  label: "Featured link",
  description: "One link as a card: a talk, an article, a launch, a case study.",
  icon: "Link2",
  defaults: { url: "", title: "", description: "", kicker: "", imageUrl: "" },
  fields: [
    { key: "url", label: "Link", type: "url", placeholder: "https://" },
    { key: "kicker", label: "Label above", type: "text", placeholder: "Talk · 2025" },
    { key: "title", label: "Title", type: "text", placeholder: "Defaults to the site name" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "imageUrl", label: "Image", type: "image", help: "A link to an image (optional)." },
  ],
  component: FeaturedLinkBlock,
});

export { FeaturedLinkBlock };
