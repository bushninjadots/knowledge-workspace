import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: LucideIcon;
  /** Accessible name when the visible label isn't enough (e.g. icon-only). */
  ariaLabel?: string;
  /** id for the tab button; pair with ariaControls for tab semantics. */
  id?: string;
  /** id of the panel this tab controls. */
  ariaControls?: string;
  /** Hide the text label on small screens, keeping the icon (skills tabs). */
  hideLabelOnMobile?: boolean;
};

/**
 * Single shared segmented control / tab bar for the app. One container + pill
 * treatment everywhere (Explore views, Skill workshop sections) so the same
 * role isn't reimplemented per page with slightly different classes.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex gap-1 rounded-xl border card-border bg-surface p-1 ${className ?? ""}`}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={option.id}
            aria-selected={active}
            aria-label={option.ariaLabel}
            aria-controls={option.ariaControls}
            onClick={() => onChange(option.value)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-surface-elevated text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            <span className={option.hideLabelOnMobile ? "hidden sm:inline" : undefined}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
