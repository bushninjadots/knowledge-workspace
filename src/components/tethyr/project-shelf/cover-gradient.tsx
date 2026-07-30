import { motion } from "framer-motion";
import { CATEGORY_COLORS, inferCategory } from "@/lib/category-colors";

interface CoverGradientProps {
  tags: string[];
  coverUrl?: string | null;
  progress: number;
}

export function CoverGradient({ tags, coverUrl, progress }: CoverGradientProps) {
  const cat = inferCategory(tags);
  const c = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Design;

  if (coverUrl) {
    return (
      <div className="absolute inset-0">
        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>
    );
  }

  return (
    <motion.div
      className="absolute inset-0"
      animate={{
        background: [
          `linear-gradient(135deg, oklch(0.4 ${c.sat / 100} ${c.hue}), oklch(0.25 ${c.sat / 100} ${c.hue + 30}))`,
          `linear-gradient(135deg, oklch(0.35 ${c.sat / 100} ${c.hue + 60}), oklch(0.4 ${c.sat / 100} ${c.hue}))`,
          `linear-gradient(135deg, oklch(0.4 ${c.sat / 100} ${c.hue}), oklch(0.25 ${c.sat / 100} ${c.hue + 30}))`,
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
