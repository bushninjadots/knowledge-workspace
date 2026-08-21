import {
  BANNER_OVERLAYS,
  bannerOverlayStyle,
  normalizeBannerOverlay,
  type BannerOverlayId,
} from "@/lib/background-themes";
import { cn } from "@/lib/utils";

/**
 * The treatment layer above a banner image. Rendered inside the banner's
 * `relative` frame, beneath captions and controls, so text stays readable on
 * busy photos without changing the page's surface hierarchy.
 */
export function BannerOverlay({ overlay }: { overlay?: string | null }) {
  const style = bannerOverlayStyle(overlay ?? "none");
  if (!style) return null;
  return <div aria-hidden="true" className="absolute inset-0" style={style} />;
}

/** Picker used in both Settings → Appearance and the Studio background editor. */
export function BannerOverlayPicker({
  value,
  onChange,
  className,
}: {
  value?: string | null;
  onChange: (value: BannerOverlayId) => void;
  className?: string;
}) {
  const current = normalizeBannerOverlay(value);
  return (
    <div
      className={cn("grid gap-2 sm:grid-cols-3", className)}
      role="group"
      aria-label="Banner overlay"
    >
      {BANNER_OVERLAYS.map((option) => {
        const style = bannerOverlayStyle(option.id);
        const selected = current === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              "min-w-0 overflow-hidden rounded-lg border text-left transition",
              selected
                ? "border-[var(--user-accent,var(--primary))]"
                : "border-border/60 hover:border-[var(--user-accent-border,var(--border-strong))]",
            )}
          >
            <span className="relative block h-10 w-full bg-[linear-gradient(120deg,var(--brand-purple)_0%,var(--brand-green)_100%)]">
              {style && <span aria-hidden="true" className="absolute inset-0" style={style} />}
            </span>
            <span className="block px-2 py-1.5">
              <span className="block truncate text-xs font-medium">{option.label}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {option.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
