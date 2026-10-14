import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// ── Page frame ────────────────────────────────────────────────────────────────
// Every app page opens the same way: an optional eyebrow, one title at one
// size, a short description, and its actions on the right. The container
// gives every page the same gutters, top spacing and one of two widths, so
// moving between pages never shifts where the content starts.

const WIDTHS = {
  /** Lists, feeds, grids — most pages. */
  default: "max-w-6xl",
  /** Forms and single-column reading (settings, a challenge, reports). */
  narrow: "max-w-3xl",
} as const;

/** The container's classes, for a page whose wrapper is already an element. */
export function pageContainerClass(width: keyof typeof WIDTHS = "default", className?: string) {
  return cn("mx-auto w-full px-4 py-8 sm:px-6", WIDTHS[width], className);
}

export function PageContainer({
  width = "default",
  className,
  children,
}: {
  width?: keyof typeof WIDTHS;
  className?: string;
  children: ReactNode;
}) {
  return <div className={pageContainerClass(width, className)}>{children}</div>;
}

export function PageHeader({
  title,
  eyebrow,
  description,
  meta,
  actions,
  className,
}: {
  title: ReactNode;
  /** A short section label above the title. */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Small inline detail next to the title (a count, a status). */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn("mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-4", className)}
    >
      <div className="min-w-0 flex-1 basis-80">
        {eyebrow && <p className="section-label mb-2">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {meta}
        </div>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
