import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CoverGradient } from "./cover-gradient";
import { STATUS_STYLES } from "./project-shelf-cover";
import type { ProjectRow } from "@/routes/_authenticated/explore";

interface ProjectShelfThumbnailsProps {
  projects: ProjectRow[];
  activeIndex: number;
  prefersReducedMotion: boolean;
  onSelect: (index: number) => void;
}

export function ProjectShelfThumbnails({
  projects,
  activeIndex,
  prefersReducedMotion,
  onSelect,
}: ProjectShelfThumbnailsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Keep the active thumbnail in view when the selection moves.
  useEffect(() => {
    const el = scrollerRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeIndex, prefersReducedMotion]);

  return (
    <div
      ref={scrollerRef}
      role="tablist"
      aria-label="Jump to project"
      className="scrollbar-none flex gap-2 overflow-x-auto pb-1 [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%_-_24px),transparent)]"
    >
      {projects.map((project, i) => {
        const isActive = i === activeIndex;
        return (
          <button
            key={project.id}
            role="tab"
            aria-selected={isActive}
            data-active={isActive || undefined}
            onClick={() => onSelect(i)}
            title={project.title}
            aria-label={`Go to project ${i + 1}: ${project.title}`}
            className={cn(
              "relative h-12 w-20 shrink-0 cursor-pointer overflow-hidden rounded-md border bg-surface text-left outline-none transition-all duration-150",
              isActive
                ? "border-transparent"
                : "border-border/60 hover:-translate-y-0.5 hover:border-[var(--user-accent-border,var(--border-strong))] hover:shadow-sm",
            )}
          >
            <CoverGradient
              tags={project.tags}
              coverUrl={project.cover_url}
              progress={project.progress_percent}
              animated={false}
            />
            {/* Progress tick */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-0.5 bg-black/30">
              <div
                className="h-full bg-white/70"
                style={{ width: `${project.progress_percent}%` }}
              />
            </div>
            {/* Status dot */}
            <span
              title={STATUS_STYLES[project.status]?.label ?? project.status}
              className={cn(
                "pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-full ring-1 ring-black/25",
                STATUS_STYLES[project.status]?.dot ?? "bg-muted-foreground/40",
              )}
            />
            {/* Active pill — morphs between thumbnails */}
            {isActive && (
              <motion.div
                layoutId="shelf-thumb-active"
                className="pointer-events-none absolute inset-0 rounded-md border-2 border-primary/80"
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 400, damping: 30 }
                }
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
