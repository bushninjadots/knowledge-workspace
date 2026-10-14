// Long content (a README, a long note) starts folded to a comfortable height
// with a fade and a "Show all" button; short content renders as-is. Measures
// itself, so it reacts to images loading and the window resizing.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function CollapsibleContent({
  children,
  maxHeight = 480,
  moreLabel = "Show all",
  lessLabel = "Show less",
  className,
}: {
  children: ReactNode;
  /** Folded height in px. Content within ~1.25× of it never folds. */
  maxHeight?: number;
  moreLabel?: string;
  lessLabel?: string;
  className?: string;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const [tall, setTall] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setTall(el.scrollHeight > maxHeight * 1.25);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxHeight]);

  const folded = tall && !open;
  return (
    <div ref={top} className={className}>
      <div
        className={cn("relative", folded && "overflow-hidden")}
        style={folded ? { maxHeight } : undefined}
      >
        <div ref={inner}>{children}</div>
        {folded && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--surface,var(--background))] to-transparent"
          />
        )}
      </div>
      {tall && (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => {
              setOpen((v) => !v);
              // Folding back up: keep the reader where the content starts.
              if (open) top.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-elevated"
          >
            {open ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            )}
            {open ? lessLabel : moreLabel}
          </button>
        </div>
      )}
    </div>
  );
}
