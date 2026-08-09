import { motion, useReducedMotion } from "framer-motion";
import { CATEGORY_COLORS, inferCategory } from "@/lib/category-colors";

interface CoverGradientProps {
  tags: string[];
  coverUrl?: string | null;
  progress: number;
  animated?: boolean;
  /**
   * "cover" fills the frame (crops the image); "contain" shows the whole
   * image centred on the category gradient (no cropping). Use "contain" for
   * large hero covers so nothing gets cut off.
   */
  fit?: "cover" | "contain";
}

export function CoverGradient({
  tags,
  coverUrl,
  progress,
  animated = true,
  fit = "cover",
}: CoverGradientProps) {
  const cat = inferCategory(tags);
  const c = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Design;
  const prefersReducedMotion = useReducedMotion();
  const gradient = `linear-gradient(135deg, oklch(0.4 ${c.sat / 100} ${c.hue}), oklch(0.25 ${c.sat / 100} ${c.hue + 30}))`;

  if (coverUrl) {
    return (
      <div className="absolute inset-0" style={{ background: gradient }}>
        <img
          src={coverUrl}
          alt=""
          draggable={false}
          className={`pointer-events-none h-full w-full select-none ${fit === "contain" ? "object-contain" : "object-cover"}`}
        />
        {/* Multi-layered gradient for depth — gentle bottom fade so the
            image breathes into the card, with a subtle vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.15))]" />
      </div>
    );
  }

  if (!animated || prefersReducedMotion) {
    return <div className="absolute inset-0" style={{ background: gradient }} />;
  }

  return (
    <motion.div
      className="absolute inset-0"
      animate={{
        background: [
          gradient,
          `linear-gradient(135deg, oklch(0.35 ${c.sat / 100} ${c.hue + 60}), oklch(0.4 ${c.sat / 100} ${c.hue}))`,
          gradient,
        ],
      }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    />
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
