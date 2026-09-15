import { motion } from "framer-motion";
import { FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoverGradientProps {
  coverUrl?: string | null;
  fit?: "cover" | "contain";
}

/**
 * A project that has no cover image yet.
 *
 * Deliberately quiet: a sunken theme surface with one muted project glyph. No
 * category tint, no gradient, no motion — the card's title, tags, and progress
 * already carry the identity, and this is the treatment the landing cards use,
 * so an image-less project reads the same everywhere it appears.
 */
export function ProjectCoverFallback({ iconClassName }: { iconClassName?: string } = {}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-surface-sunken">
      <FolderKanban
        className={cn("text-muted-foreground/30", iconClassName ?? "h-6 w-6")}
        aria-hidden
      />
    </div>
  );
}

/**
 * Owns how a project cover renders. With an image, the image plus a bottom fade
 * for the progress bar; without one, the shared quiet fallback. When the image
 * is letterboxed (`fit="contain"`) the same sunken surface fills the margins
 * instead of a saturated gradient.
 */
export function CoverGradient({ coverUrl, fit = "contain" }: CoverGradientProps) {
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
        className={`pointer-events-none h-full w-full select-none ${fit === "cover" ? "object-cover" : "object-contain"}`}
      />
      {/* Gentle bottom fade so the progress bar is visible */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}

export function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
      <motion.div
        className="h-full bg-white/60"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}
