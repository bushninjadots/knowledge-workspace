import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type TocSection = { id: string; text: string; level: number };

/**
 * Scroll-spy table of contents for the README, built from the document's own
 * headings (h2 + h3). Sticky in the right rail on large screens; each link is
 * a real anchor so it works without JS, and the browser's native jump is
 * offset by the scroll-margin set on prose headings (clear of the sticky
 * workbench and rail).
 */
export function ReadmeToc({ sections }: { sections: TocSection[] }) {
  const items = useMemo(() => sections.filter((s) => s.level >= 2 && s.level <= 3), [sections]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) return;
    const targets = items
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // The heading nearest the top of the viewport is "active".
        let best: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!best || entry.boundingClientRect.top < best.boundingClientRect.top) {
            best = entry;
          }
        }
        if (best) setActiveId(best.target.id);
      },
      // Watch within the reading area below the sticky workbench + header.
      // IntersectionObserver only accepts px or % for rootMargin (no rem/em).
      { rootMargin: "-112px 0px -55% 0px", threshold: 0 },
    );

    for (const el of targets) observer.observe(el);
    setActiveId(targets[0]?.id ?? null);
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="On this page">
      <h3 className="section-label flex items-center gap-1.5">
        <span className="text-muted-foreground">On this page</span>
      </h3>
      <ul className="mt-2.5 space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={() => setActiveId(item.id)}
              className={cn(
                "block truncate border-l-2 py-0.5 pl-2.5 text-[13px] transition-colors",
                item.level === 3 && "pl-5",
                activeId === item.id
                  ? "border-[var(--user-accent,var(--primary))] font-medium text-foreground"
                  : "border-border/60 text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
              aria-current={activeId === item.id ? "location" : undefined}
              title={item.text}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Compact collapsible TOC for small screens (the rail is hidden below lg). */
export function ReadmeTocCollapsed({ sections }: { sections: TocSection[] }) {
  const items = useMemo(() => sections.filter((s) => s.level >= 2 && s.level <= 3), [sections]);
  if (items.length === 0) return null;

  return (
    <details className="lg:hidden border-b border-border/40">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-xs font-medium text-muted-foreground transition hover:text-foreground [&::-webkit-details-marker]:hidden">
        On this page
        <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">
          {items.length} section{items.length !== 1 ? "s" : ""}
        </span>
      </summary>
      <ul className="space-y-1 px-4 pb-3">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                "block truncate text-[13px] text-muted-foreground transition hover:text-foreground",
                item.level === 3 && "pl-3",
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
