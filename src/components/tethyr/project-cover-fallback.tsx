import { FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A project that has no cover image yet.
 *
 * Deliberately quiet: a sunken theme surface with one muted project glyph. No
 * category tint, no gradient, no motion — the card's title, tags, and progress
 * already carry the identity, so an image-less project reads the same
 * everywhere it appears.
 *
 * Lives in its own module, free of framer-motion, so lighter surfaces (the
 * community feed, for one) can reuse the treatment without pulling the
 * animation library into their route chunk. `cover-gradient` re-exports it for
 * the cover-sized consumers.
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
