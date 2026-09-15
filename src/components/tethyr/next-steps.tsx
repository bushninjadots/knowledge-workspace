import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import type { Section } from "@/lib/profile-completeness";

/**
 * The ongoing "what's left" list. The first undone item is the single
 * highest-value next move, so it leads with the user accent; the rest read as
 * a quiet to-do list.
 */
export const NextStepsList = memo(function NextStepsList({ items }: { items: Section[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-surface/60 p-6 text-center">
        <p className="text-sm font-medium">🎉 Your profile is complete.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Keep it fresh — add new projects or skills as you grow.
        </p>
      </div>
    );
  }
  const [first, ...rest] = items;
  return (
    <ul className="space-y-1.5">
      <li key={first.key} className="flex">
        <Link
          to={first.cta?.href ?? "/profile"}
          className="group flex flex-1 items-center gap-3 rounded-xl border border-[var(--user-accent-border,var(--border-strong))] bg-[var(--user-accent-subtle,var(--surface-elevated))] px-4 py-3 transition-lift hover:bg-[var(--user-accent-subtle,var(--surface-elevated))]"
        >
          <Check className="h-4 w-4 shrink-0 text-[var(--user-accent,var(--trust))]" />
          <span className="text-sm font-medium text-foreground">{first.label}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] font-medium text-[var(--user-accent,var(--trust))]">
            Do this next
            <ArrowRight className="h-3 w-3 transition-spatial group-hover:translate-x-0.5" />
          </span>
        </Link>
      </li>
      {rest.length > 0 && (
        <li>
          <ul className="space-y-1.5">
            {rest.map((s) => (
              <li key={s.key}>
                <Link
                  to={s.cta?.href ?? "/profile"}
                  className="group flex items-center gap-3 rounded-xl border border-border/60 bg-surface/50 px-4 py-2.5 transition-lift hover:border-border-strong hover:bg-surface-elevated"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full border border-muted-foreground/50" />
                  <span className="truncate text-sm text-muted-foreground">{s.label}</span>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-fade group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        </li>
      )}
    </ul>
  );
});
