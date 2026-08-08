import { motion, useTransform, type MotionValue } from "framer-motion";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS, CATEGORY_ICON, inferCategory } from "@/lib/category-colors";
import { CoverGradient, ProgressBar } from "./cover-gradient";
import type { ProjectRow } from "@/routes/_authenticated/explore";

export const STATUS_STYLES: Record<string, { label: string; dot: string }> = {
  active: { label: "Active", dot: "bg-brand-green" },
  planning: { label: "Planning", dot: "bg-teaching" },
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
  isActive?: boolean;
  onClick: () => void;
}

function getMaxCardWidth(): number {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  return Math.min(vw * 0.65, 600);
}

export function getCardWidth(absDist: number): number {
  const maxW = getMaxCardWidth();
  if (absDist < 0.4) return maxW;
  if (absDist < 1.5) return maxW - (maxW - 320) * ((absDist - 0.4) / 1.1);
  if (absDist < 3) return 320 - 80 * ((absDist - 1.5) / 1.5);
  return 240;
}

/** Height of the project-info panel shown under the cover on the front card. */
export const ACTIVE_INFO_H = 132;

/**
 * Card height. Near the centre the card grows to show the cover image (16:9)
 * plus the project-info panel; farther out it collapses back to the
 * spine-height so distant cards stay slim books.
 */
export function getCardHeight(absDist: number): number {
  const w = getCardWidth(absDist);
  const base = Math.max((w * 9) / 16, 280);
  if (absDist < 0.6) return base + ACTIVE_INFO_H;
  if (absDist < 1) return base + ACTIVE_INFO_H * (1 - (absDist - 0.6) / 0.4);
  return base;
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

function getCardShadow(absDist: number): string {
  if (absDist < 0.4) {
    return [
      "0 20px 44px -16px oklch(0.2 0.02 265 / 0.4)",
      "0 6px 16px -6px oklch(0.2 0.02 265 / 0.25)",
      "0 1px 2px oklch(0.2 0.02 265 / 0.12)",
    ].join(", ");
  }
  if (absDist < 2) {
    const t = Math.min(1, (absDist - 0.4) / 1.6);
    return [
      `0 ${(20 - 14 * t).toFixed(1)}px ${(44 - 30 * t).toFixed(1)}px -16px oklch(0.2 0.02 265 / ${(0.4 - 0.26 * t).toFixed(3)})`,
      `0 ${(6 - 4 * t).toFixed(1)}px ${(16 - 10 * t).toFixed(1)}px -6px oklch(0.2 0.02 265 / ${(0.25 - 0.14 * t).toFixed(3)})`,
    ].join(", ");
  }
  return "0 4px 10px -6px oklch(0.2 0.02 265 / 0.14)";
}

export function ProjectShelfCover(props: ProjectShelfCoverProps) {
  if (props.forceFace) return <ProjectShelfFace {...props} />;
  return <ProjectShelfCoverAnimated {...props} />;
}

function ProjectShelfFace({ project, meId, isContributor, onClick }: ProjectShelfCoverProps) {
  const status = STATUS_STYLES[project.status] ?? STATUS_STYLES.active;
  const isOwn = project.profiles?.id === meId;

  return (
    <motion.button
      layoutId={`shelf-card-${project.id}`}
      id={`shelf-card-${project.id}`}
      onClick={onClick}
      className="relative w-full cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-surface text-left outline-none shadow-sm transition-shadow hover:shadow-md"
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      aria-selected
      role="option"
    >
      {/* Cover image — nothing overlaid on the picture */}
      <div className="relative w-full shrink-0" style={{ aspectRatio: "16 / 9" }}>
        <CoverGradient
          tags={project.tags}
          coverUrl={project.cover_url}
          progress={project.progress_percent}
        />
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
        <div className="absolute bottom-0 left-0 right-0">
          <ProgressBar progress={project.progress_percent} />
        </div>
      </div>
      <ProjectCardInfo project={project} status={status} />
    </motion.button>
  );
}

function ProjectShelfCoverAnimated({
  project,
  index,
  offset,
  meId,
  isContributor,
  prefersReducedMotion,
  isActive,
  onClick,
}: ProjectShelfCoverProps) {
  const category = inferCategory(project.tags);
  const Icon = CATEGORY_ICON[category] ?? CATEGORY_ICON.Design;
  const status = STATUS_STYLES[project.status] ?? STATUS_STYLES.active;
  const isOwn = project.profiles?.id === meId;
  const catColors = CATEGORY_COLORS[category];

  const dist = useTransform(offset, (o) => index - o);
  const absDist = useTransform(dist, (d) => Math.abs(d));
  const centerX = useTransform(dist, getCardCenter);
  const w = useTransform(absDist, getCardWidth);
  const h = useTransform(absDist, getCardHeight);
  const rotateY = useTransform(dist, getRotateY);
  const cardScale = useTransform(absDist, getScale);
  const blurFilter = useTransform(absDist, getBlur);
  const cardOpacity = useTransform(absDist, getOpacity);
  const zIdx = useTransform(absDist, getZIndex);
  const cardShadow = useTransform(absDist, getCardShadow);
  // Face fades out by dist 1.0 — the same point the card height finishes
  // collapsing back to spine-height — so the info panel is never half-clipped.
  const faceOpacity = useTransform(absDist, [0, 0.7, 1.0, 5], [1, 1, 0, 0]);
  const spineOpacity = useTransform(absDist, [0, 0.7, 1.2, 5], [0, 0, 1, 1]);
  const ringColor = `oklch(0.6 ${catColors.sat / 100} ${catColors.hue} / 0.55)`;
  const glowColor = `oklch(0.6 ${catColors.sat / 100} ${catColors.hue} / 0.32)`;
  const ringOpacity = useTransform(absDist, [0, 0.5, 1.1], [1, 0.5, 0]);

  return (
    <motion.div
      className="absolute"
      style={{ left: "50%", top: "50%", x: centerX, y: "-50%", zIndex: zIdx }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { delay: Math.min(index * 0.045, 0.5), type: "spring", stiffness: 260, damping: 24 }
      }
    >
      {/* Category ring / glow — on the wrapper so the bloom isn't clipped */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          boxShadow: `0 0 0 1.5px ${ringColor}, 0 0 32px -4px ${glowColor}`,
          opacity: ringOpacity,
        }}
      />
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
          boxShadow: cardShadow,
        }}
        onClick={onClick}
        aria-selected={isActive ?? Math.abs(index) < 0.6}
        role="option"
      >
        {/* Spine view */}
        <motion.div
          className="absolute inset-0 flex flex-col gap-2 p-4"
          style={{ opacity: spineOpacity }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: `oklch(0.5 ${(catColors?.sat ?? 60) / 100} ${catColors?.hue ?? 270} / 0.12)`,
              }}
            >
              <Icon
                className="h-4 w-4"
                style={{
                  color: `oklch(0.65 ${(catColors?.sat ?? 60) / 100} ${catColors?.hue ?? 270})`,
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground" title={project.title}>
                {project.title}
              </p>
              {project.profiles && (
                <p className="truncate text-[11px] text-muted-foreground">
                  {project.profiles.display_name || project.profiles.handle || "Member"}
                </p>
              )}
            </div>
            <span className={cn("h-2 w-2 shrink-0 rounded-full", status.dot)} />
          </div>

          {/* Tags */}
          {project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {project.tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border/50 bg-surface-elevated/50 px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
              {project.tags.length > 3 && (
                <span className="text-[11px] text-muted-foreground/50">
                  +{project.tags.length - 3}
                </span>
              )}
            </div>
          )}

          <div className="mt-auto space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{project.progress_percent}%</span>
              <span>{status.label}</span>
            </div>
            <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${project.progress_percent}%`,
                  backgroundColor: `oklch(0.6 ${(catColors?.sat ?? 60) / 100} ${catColors?.hue ?? 270} / 0.7)`,
                }}
              />
            </div>
          </div>

          {/* Page-edge texture */}
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-70"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, transparent 0px, transparent 6px, rgba(255,255,255,0.06) 6px, rgba(255,255,255,0.06) 7px)",
            }}
          />
        </motion.div>

        {/* Face view — cover image on top (nothing covering it), info below */}
        <motion.div className="absolute inset-0 flex flex-col" style={{ opacity: faceOpacity }}>
          {/* Cover image — clean 16:9 strip, no text on the picture */}
          <div className="relative w-full shrink-0" style={{ aspectRatio: "16 / 9" }}>
            <CoverGradient
              tags={project.tags}
              coverUrl={project.cover_url}
              progress={project.progress_percent}
            />
            {/* Specular sheen */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
            {/* Dimensional edge highlights */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/20 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-black/20 to-transparent" />

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
          </div>

          {/* Project info — the front card shows what this project is about */}
          <ProjectCardInfo project={project} status={status} />
        </motion.div>
      </motion.button>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------------
 * Project info panel — sits under the cover image on the front card. Kept off
 * the picture itself so the artwork is never covered or cropped by text.
 * ------------------------------------------------------------------------- */

function ProjectCardInfo({
  project,
  status,
}: {
  project: ProjectRow;
  status: { label: string; dot: string };
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden border-t border-black/10 p-3 dark:border-white/10">
      <div className="flex items-start justify-between gap-2">
        <p
          className="min-w-0 truncate text-[13px] font-semibold text-foreground"
          title={project.title}
        >
          {project.title}
        </p>
        {project.looking_for_collaborators && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-brand-purple/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-purple">
            Open
          </span>
        )}
      </div>
      {project.profiles && (
        <p className="truncate text-[11px] text-muted-foreground">
          by {project.profiles.display_name || project.profiles.handle || "Member"}
        </p>
      )}
      {project.description && (
        <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground/90">
          {project.description}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
        {project.tags.slice(0, 3).map((t) => (
          <span
            key={t}
            className="rounded-full border border-border/60 bg-surface-elevated/60 px-2 py-0.5 text-[10px] text-muted-foreground"
          >
            {t}
          </span>
        ))}
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-muted-foreground">
          {project.progress_percent}% · {status.label}
        </span>
      </div>
    </div>
  );
}
