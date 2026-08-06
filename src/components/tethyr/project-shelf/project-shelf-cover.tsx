import { motion, useTransform, type MotionValue } from "framer-motion";
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
  offset: MotionValue<number>;
  meId: string | null;
  isContributor: boolean;
  prefersReducedMotion: boolean;
  forceFace?: boolean;
  onClick: () => void;
}

function getMaxCardWidth(): number {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  return Math.min(vw * 0.65, 600);
}

function getCardWidth(absDist: number): number {
  const maxW = getMaxCardWidth();
  if (absDist < 0.4) return maxW;
  if (absDist < 1.5) return maxW - (maxW - 240) * ((absDist - 0.4) / 1.1);
  if (absDist < 3) return 240 - 100 * ((absDist - 1.5) / 1.5);
  return 140;
}

function getCardCenter(dist: number): number {
  const d = Math.abs(dist);
  const sign = dist >= 0 ? 1 : -1;
  if (d <= 0) return 0;
  const gap = 8;
  const w = [getCardWidth(0), getCardWidth(1), getCardWidth(2), getCardWidth(3), getCardWidth(4)];
  const pos = [0];
  for (let i = 1; i < w.length; i++) {
    pos[i] = pos[i - 1] + w[i - 1] / 2 + gap + w[i] / 2;
  }
  const idx = Math.min(Math.floor(d), pos.length - 2);
  const frac = d - Math.floor(d);
  return sign * (pos[idx] + (pos[idx + 1] - pos[idx]) * frac);
}

function getRotateY(dist: number): number {
  const a = Math.abs(dist);
  const sign = dist > 0 ? -1 : 1;
  if (a < 0.4) return 0;
  if (a < 1) return (sign * 18 * (a - 0.4)) / 0.6;
  if (a < 2) return sign * (18 + (a - 1) * 17);
  if (a < 4) return sign * (35 + (a - 2) * 7.5);
  return sign * 50;
}

function getScale(absDist: number): number {
  if (absDist < 0.4) return 1;
  if (absDist < 1) return 1 - (0.15 * (absDist - 0.4)) / 0.6;
  if (absDist < 2) return 0.85 - 0.15 * (absDist - 1);
  if (absDist < 3) return 0.7 - 0.15 * (absDist - 2);
  return 0.55;
}

function getBlur(absDist: number): string {
  if (absDist < 0.8) return "blur(0px)";
  if (absDist < 1.5) return `blur(${((2 * (absDist - 0.8)) / 0.7).toFixed(1)}px)`;
  if (absDist < 2.5) return `blur(${(2 + 2 * (absDist - 1.5)).toFixed(1)}px)`;
  if (absDist < 4) return `blur(${(4 + (4 * (absDist - 2.5)) / 1.5).toFixed(1)}px)`;
  return "blur(8px)";
}

function getOpacity(absDist: number): number {
  if (absDist < 1) return 1;
  if (absDist < 2) return 1 - 0.3 * (absDist - 1);
  if (absDist < 4) return 0.7 - 0.25 * (absDist - 2);
  return 0.2;
}

function getZIndex(absDist: number): number {
  if (absDist < 0.5) return 20;
  if (absDist < 1) return 15;
  if (absDist < 2) return 10;
  if (absDist < 3) return 5;
  return 1;
}

export function ProjectShelfCover({
  project,
  index,
  offset,
  meId,
  isContributor,
  prefersReducedMotion,
  forceFace,
  onClick,
}: ProjectShelfCoverProps) {
  const category = inferCategory(project.tags);
  const Icon = CATEGORY_ICON[category] ?? CATEGORY_ICON.Design;
  const status = STATUS_STYLES[project.status] ?? STATUS_STYLES.active;
  const isOwn = project.profiles?.id === meId;
  const catColors = CATEGORY_COLORS[category];

  // Hooks must run unconditionally — declared before any early return.
  const dist = useTransform(offset, (o) => index - o);
  const absDist = useTransform(dist, (d) => Math.abs(d));
  const centerX = useTransform(dist, getCardCenter);
  const w = useTransform(absDist, getCardWidth);
  const h = useTransform(w, (width) => Math.max((width * 9) / 16, 180));
  const rotateY = useTransform(dist, getRotateY);
  const cardScale = useTransform(absDist, getScale);
  const blurFilter = useTransform(absDist, getBlur);
  const cardOpacity = useTransform(absDist, getOpacity);
  const zIdx = useTransform(absDist, getZIndex);
  const faceOpacity = useTransform(absDist, [0, 0.7, 1.2, 5], [1, 1, 0, 0]);
  const spineOpacity = useTransform(absDist, [0, 0.7, 1.2, 5], [0, 0, 1, 1]);


  if (forceFace) {
    return (
      <motion.button
        layoutId={`shelf-card-${project.id}`}
        id={`shelf-card-${project.id}`}
        onClick={onClick}
        className="relative w-full cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-surface text-left outline-none"
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        aria-selected
        role="option"
      >
        <div className="aspect-video">
          <CoverGradient
            tags={project.tags}
            coverUrl={project.cover_url}
            progress={project.progress_percent}
          />
        </div>
        <ProgressBar progress={project.progress_percent} />
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
      </motion.button>
    );
  }


  return (
    <motion.div
      className="absolute"
      style={{ left: "50%", top: "50%", x: centerX, y: "-50%", zIndex: zIdx }}
    >
      <motion.button
        layoutId={`shelf-card-${project.id}`}
        id={`shelf-card-${project.id}`}
        className="relative cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-surface text-left outline-none will-change-transform"
        style={{
          x: "-50%",
          y: "-50%",
          width: w,
          height: h,
          rotateY,
          scale: cardScale,
          filter: blurFilter,
          opacity: cardOpacity,
        }}
        onClick={onClick}
        aria-selected={Math.abs(index) < 0.6}
        role="option"
      >
        {/* Spine view */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2"
          style={{ opacity: spineOpacity }}
        >
          <div
            className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: `oklch(0.5 ${(catColors?.sat ?? 60) / 100} ${catColors?.hue ?? 270} / 0.1)`,
            }}
          >
            <Icon className="h-4 w-4 text-foreground" />
          </div>
          <span className="text-[10px] font-medium text-foreground text-center line-clamp-2 leading-tight [writing-mode:vertical-rl] [text-orientation:mixed] rotate-180 max-h-20">
            {project.title}
          </span>
          <div className="h-1 w-12 shrink-0 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-white/40 rounded-full"
              style={{ width: `${project.progress_percent}%` }}
            />
          </div>
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status.dot)} />
        </motion.div>

        {/* Face view */}
        <motion.div className="absolute inset-0 overflow-hidden" style={{ opacity: faceOpacity }}>
          <CoverGradient
            tags={project.tags}
            coverUrl={project.cover_url}
            progress={project.progress_percent}
          />
          <div className="absolute bottom-0 left-0 right-0 z-10">
            <ProgressBar progress={project.progress_percent} />
          </div>

          <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
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

          <div className="absolute bottom-6 left-3 right-3 z-10">
            <p className="text-sm font-semibold text-white drop-shadow-lg line-clamp-1">
              {project.title}
            </p>
            {project.profiles && (
              <p className="text-xs text-white/70 drop-shadow">
                {project.profiles.display_name || project.profiles.handle || "Member"}
              </p>
            )}
          </div>
        </motion.div>
      </motion.button>
    </motion.div>
  );
}
