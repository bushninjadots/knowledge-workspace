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
              "group min-w-0 overflow-hidden rounded-lg border bg-surface text-left transition-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-[var(--user-accent,var(--primary))] bg-[var(--user-accent-subtle,var(--accent))]"
                : "border-border/60 hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface-elevated",
            )}
          >
            {/* Preview stands in for a busy photo: layered colour noise + a
                mini caption chip, so the choice is judged on what overlays
                are for — keeping text readable. */}
            <span className="relative block h-14 w-full overflow-hidden">
              <span
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  backgroundColor: "var(--muted)",
                  backgroundImage:
                    "radial-gradient(140% 90% at 15% 20%, var(--ai) 0%, transparent 55%), radial-gradient(120% 100% at 85% 75%, var(--trust) 0%, transparent 60%), radial-gradient(100% 80% at 60% 15%, color-mix(in oklab, var(--primary) 35%, transparent) 0%, transparent 50%)",
                }}
              />
              {style && <span aria-hidden="true" className="absolute inset-0" style={style} />}
              {/* Mini caption chip at the position captions actually render */}
              <span
                aria-hidden="true"
                className="absolute bottom-1.5 right-1.5 max-w-[80%] truncate rounded-full bg-background/70 px-1.5 py-0.5 text-[8px] leading-none text-foreground backdrop-blur-sm ring-1 ring-border/40"
              >
                Your caption
              </span>
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
