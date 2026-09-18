import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ProjectCoverFallback } from "@/components/tethyr/project-cover-fallback";

interface CoverGradientProps {
  coverUrl?: string | null;
  fit?: "cover" | "contain";
  /**
   * Card-level hover affordance: a slow 1.03 image zoom on parent `group`
   * hover. Opt-in — only browsing surfaces where the whole card lifts.
   */
  hoverZoom?: boolean;
}

/**
 * Owns how a project cover renders. With an image, the image plus a bottom fade
 * for the progress bar; without one, the shared quiet fallback. When the image
 * is letterboxed (`fit="contain"`) the same sunken surface fills the margins
 * instead of a saturated gradient.
 */
export function CoverGradient({
  coverUrl,
  fit = "contain",
  hoverZoom = false,
}: CoverGradientProps) {
  if (!coverUrl) return <ProjectCoverFallback />;

  return (
    <div className="absolute inset-0 bg-surface-sunken">
      <img
        src={coverUrl}
        alt=""
        width="400"
        height="533"
        draggable={false}
        loading="lazy"
        decoding="async"
        className={`pointer-events-none h-full w-full select-none ${
          fit === "cover" ? "object-cover" : "object-contain"
        } ${
          hoverZoom ? "transition-transform duration-300 ease-out group-hover:scale-[1.03]" : ""
        }`}
      />
      {/* Gentle bottom fade so the progress bar is visible */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}

export function ProgressBar({
  progress,
  variant = "on-image",
}: {
  progress: number;
  variant?: "on-image" | "on-surface";
}) {
  // The bar sits at the bottom of the cover. Over an image, white keeps it
  // legible against the photo; over the quiet no-cover surface the same white
  // disappears, so it falls back to the track/fill pairing used elsewhere on a
  // theme surface.
  const onSurface = variant === "on-surface";
  return (
    <div
      className={cn(
        "absolute bottom-0 left-0 right-0 h-1",
        onSurface ? "bg-border" : "bg-white/10",
      )}
    >
      <motion.div
        className={cn("h-full", onSurface ? "bg-primary/80" : "bg-white/60")}
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}
