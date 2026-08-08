import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Circle } from "lucide-react";
import type { Section } from "@/lib/profile-completeness";

export const NextStepsList = memo(function NextStepsList({ items }: { items: Section[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-surface/60 p-6 text-center">
        <p className="text-sm font-medium">🎉 Your profile is complete.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Keep it fresh — add new projects or skills as you grow.
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((s) => (
        <li key={s.key}>
          <Link
            to={s.cta?.href ?? "/profile"}
            className="group flex items-center gap-3 rounded-xl border border-border/60 bg-surface/50 px-4 py-3 transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-[var(--user-accent-subtle,var(--surface))]"
          >
            {s.done ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <span
              className={`text-sm ${s.done ? "text-muted-foreground line-through" : "text-foreground"}`}
            >
              {s.label}
            </span>
            <span className="ml-auto text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100">
              {s.cta?.label ?? "Go"} →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
});
