import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS, CATEGORY_ICON, inferCategory } from "@/lib/category-colors";
import { CoverGradient, ProgressBar } from "./cover-gradient";
import type { ProjectRow } from "@/routes/_authenticated/explore";

const STATUS_STYLES: Record<string, { label: string; dot: string }> = {
  active: { label: "Active", dot: "bg-brand-green" },
  planning: { label: "Planning", dot: "bg-amber-400" },
  paused: { label: "Paused", dot: "bg-muted-foreground/40" },
  completed: { label: "Completed", dot: "bg-primary" },
};

interface ProjectShelfCoverProps {
  project: ProjectRow;
  index: number;
  activeIndex: number;
  meId: string | null;
  isContributor: boolean;
  onClick: () => void;
}

export function ProjectShelfCover({ project, index, activeIndex, meId, isContributor, onClick }: ProjectShelfCoverProps) {
  const distance = Math.abs(index - activeIndex);
  const isActive = index === activeIndex;
  const isOwn = project.profiles?.id === meId;
  const category = inferCategory(project.tags);
  const Icon = CATEGORY_ICON[category] ?? CATEGORY_ICON.Design;
  const status = STATUS_STYLES[project.status] ?? STATUS_STYLES.active;

  const rotateY = isActive ? 0 : index < activeIndex ? -18 : 18;
  const scale = isActive ? 1 : 0.85;
  const zIndex = isActive ? 10 : 10 - distance;
  const blur = distance <= 1 ? 0 : distance === 2 ? 2 : 4;

  return (
    <motion.button
      layout
      onClick={onClick}
      className={cn(
        "relative shrink-0 cursor-pointer overflow-hidden rounded-2xl border text-left outline-none",
        "border-border/60 bg-surface",
        isActive && "z-10",
      )}
      animate={{
        rotateY,
        scale,
        zIndex,
        filter: blur > 0 ? `blur(${blur}px)` : "blur(0px)",
        width: isActive ? "65%" : "180px",
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
      }}
      whileHover={!isActive ? { scale: 0.9, rotateY: rotateY * 0.5, transition: { type: "spring", stiffness: 400, damping: 25 } } : undefined}
      aria-selected={isActive}
      role="option"
    >
      {/* Cover / Spine face */}
      <div className={cn("relative", isActive ? "aspect-video" : "flex h-full flex-col items-center justify-center gap-2 p-3")}>
        {isActive ? (
          <>
            <CoverGradient tags={project.tags} coverUrl={project.cover_url} progress={project.progress_percent} />
            <ProgressBar progress={project.progress_percent} />
          </>
        ) : (
          /* Spine view for non-active cards */
          <div className="flex flex-col items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `oklch(0.5 ${(CATEGORY_COLORS[category]?.sat ?? 60) / 100} ${CATEGORY_COLORS[category]?.hue ?? 270} / 0.1)` }}
            >
              <Icon className="h-4 w-4 text-foreground" />
            </div>
            <span className="text-xs font-medium text-foreground leading-tight text-center line-clamp-2 [writing-mode:vertical-rl] [text-orientation:mixed] rotate-180 max-h-24">
              {project.title}
            </span>
            <div className="h-1 w-12 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-white/40 rounded-full" style={{ width: `${project.progress_percent}%` }} />
            </div>
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          </div>
        )}
      </div>

      {/* Status badges (active view only) */}
      {isActive && (
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground backdrop-blur-sm">
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </span>
          {isOwn && (
            <span className="rounded-full bg-brand-green/20 px-2 py-0.5 text-[10px] font-medium text-brand-green backdrop-blur-sm">
              You
            </span>
          )}
          {isContributor && (
            <span className="rounded-full bg-brand-purple/20 px-2 py-0.5 text-[10px] font-medium text-brand-purple backdrop-blur-sm">
              Contributing
            </span>
          )}
        </div>
      )}

      {/* Title overlay (active view) */}
      {isActive && (
        <div className="absolute bottom-6 left-3 right-3">
          <p className="text-sm font-semibold text-white drop-shadow-lg line-clamp-1">
            {project.title}
          </p>
          {project.profiles && (
            <p className="text-xs text-white/70 drop-shadow">
              {project.profiles.display_name || project.profiles.handle || "Member"}
            </p>
          )}
        </div>
      )}
    </motion.button>
  );
}
