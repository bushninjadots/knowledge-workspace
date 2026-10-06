// Small shared Studio controls (icon buttons, segmented choices, steppers).
//
// Split out of g-studio-surface.tsx so the surface, inspector, and customize
// panel can share them without importing each other.

import { type ReactNode } from "react";
import type { LayoutBlockInstance, LayoutGridItem, LayoutSection } from "@/lib/page-blocks";
import { cn } from "@/lib/utils";

export function Choice({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <div className="mb-4">
      <p className="t-label mb-1.5">{label}</p>
      {hint && <p className="mb-1.5 text-2xs leading-snug text-muted-foreground-subtle">{hint}</p>}
      <div
        className={cn(
          "grid gap-1 border border-border bg-[var(--surface-sunken)] p-0.5",
          // Four choices sit in one row; more wrap in threes.
          options.length === 2
            ? "grid-cols-2"
            : options.length === 4
              ? "grid-cols-4"
              : "grid-cols-3",
        )}
      >
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-sm px-1 py-1.5 pointer-coarse:py-3 text-2xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-sunken)]",
              value === option
                ? "bg-[var(--surface-elevated)] text-foreground"
                : "text-muted-foreground",
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WidthStepper({
  block,
  section,
  onResize,
}: {
  block: LayoutBlockInstance;
  section: LayoutSection;
  onResize: (sectionId: string, grid: LayoutGridItem[]) => void;
}) {
  const item = section.grid?.find((candidate) => candidate.i === block.id);
  if (!item) return null;
  return (
    <span className="flex shrink-0 items-center border border-border">
      <IconButton
        label="Narrower"
        disabled={item.w <= (item.minW ?? 2)}
        onClick={() =>
          onResize(
            section.id,
            (section.grid ?? []).map((candidate) =>
              candidate.i === block.id
                ? { ...candidate, w: Math.max(candidate.minW ?? 2, candidate.w - 1) }
                : candidate,
            ),
          )
        }
      >
        −
      </IconButton>
      <span className="w-5 text-center font-mono text-3xs">{item.w}</span>
      <IconButton
        label="Wider"
        disabled={item.w >= 12}
        onClick={() =>
          onResize(
            section.id,
            (section.grid ?? []).map((candidate) =>
              candidate.i === block.id
                ? { ...candidate, w: Math.min(12, candidate.w + 1) }
                : candidate,
            ),
          )
        }
      >
        +
      </IconButton>
    </span>
  );
}

export function IconButton({
  label,
  children,
  active,
  className,
  ...rest
}: {
  label: string;
  children: ReactNode;
  active?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-7 w-7 pointer-coarse:h-10 pointer-coarse:w-10 shrink-0 items-center justify-center rounded-sm border text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface-elevated)]",
        active
          ? "border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)] text-[var(--user-accent-text)]"
          : "border-transparent hover:border-border hover:bg-[var(--surface-sunken)] hover:text-foreground",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
