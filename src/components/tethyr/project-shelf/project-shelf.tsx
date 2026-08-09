import { useState, useCallback, useRef, useEffect } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useMotionValue,
} from "framer-motion";
import { ChevronLeft, ChevronRight, Keyboard, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectShelfHeader } from "./project-shelf-header";
import { ProjectShelfCover, STATUS_STYLES } from "./project-shelf-cover";
import { ProjectShelfOverlay } from "./project-shelf-overlay";
import { ProjectShelfThumbnails } from "./project-shelf-thumbnails";
import type { ProjectRow } from "@/routes/_authenticated/explore";

interface ProjectShelfProps {
  projects: ProjectRow[];
  meId: string | null;
  contributorIds: Set<string>;
  q: string;
  setQ: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function ProjectShelf({
  projects,
  meId,
  contributorIds,
  q,
  setQ,
  category,
  setCategory,
}: ProjectShelfProps) {
  const [overlayIndex, setOverlayIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);
  const maxOffset = Math.max(0, projects.length - 1);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Clamp index when projects change
  useEffect(() => {
    if (activeIndex > maxOffset) setActiveIndex(maxOffset);
  }, [maxOffset, activeIndex]);

  const navigate = useCallback(
    (dir: -1 | 1) => {
      if (maxOffset <= 0) return;
      setActiveIndex((prev) => clamp(prev + dir, 0, maxOffset));
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    },
    [maxOffset],
  );

  // Mouse wheel scrolling
  useEffect(() => {
    const el = containerRef.current;
    if (!el || maxOffset <= 0) return;
    let wheelAccum = 0;
    const THRESHOLD = 60;
    const onWheel = (e: WheelEvent) => {
      // Only intercept horizontal-ish scroll or when not inside a scrollable element
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], .overflow-y-auto, .overflow-auto")) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // let horizontal scroll pass
      e.preventDefault();
      wheelAccum += e.deltaY;
      if (Math.abs(wheelAccum) >= THRESHOLD) {
        const dir = wheelAccum > 0 ? 1 : -1;
        wheelAccum = 0;
        setActiveIndex((prev) => clamp(prev + dir, 0, maxOffset));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [maxOffset]);

  const jumpTo = useCallback(
    (index: number) => {
      setActiveIndex(clamp(index, 0, maxOffset));
    },
    [maxOffset],
  );

  // ── Touch / pointer drag ──
  const dragX = useMotionValue(0);
  const dragStartX = useRef(0);
  const dragActive = useRef(false);
  const SWIPE_THRESHOLD = 80;

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (maxOffset <= 0 || overlayIndex != null) return;
    dragStartX.current = e.clientX;
    dragActive.current = true;
    dragX.set(0);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [maxOffset, overlayIndex, dragX]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragActive.current) return;
    const dx = e.clientX - dragStartX.current;
    dragX.set(dx);
  }, [dragX]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragActive.current) return;
    dragActive.current = false;
    const dx = e.clientX - dragStartX.current;
    dragX.set(0);
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      const dir = dx < 0 ? 1 : -1;
      setActiveIndex((prev) => clamp(prev + dir, 0, maxOffset));
    }
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, [maxOffset, dragX]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (overlayIndex != null) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigate, overlayIndex]);

  const handleCardClick = useCallback(
    (_project: ProjectRow, index: number) => {
      setOverlayIndex(index);
    },
    [],
  );

  const closeOverlay = useCallback(() => {
    setOverlayIndex(null);
  }, []);

  const shownIndex = Math.min(activeIndex, maxOffset);
  const activeProject = projects[shownIndex] ?? undefined;

  return (
    <div className="space-y-6" ref={containerRef}>
      <ProjectShelfHeader
        q={q}
        setQ={setQ}
        category={category}
        setCategory={setCategory}
        count={projects.length}
      />

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed card-border bg-surface/50 px-6 py-20 text-center">
          <Folder className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium text-foreground">No projects match</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {q || category !== "All"
                ? "Try a different search term or category."
                : "Check back soon — new projects land here regularly."}
            </p>
          </div>
          {(q || category !== "All") && (
            <button
              onClick={() => {
                setQ("");
                setCategory("All");
              }}
              className="rounded-full border card-border bg-background/60 px-4 py-1.5 text-xs font-medium text-foreground transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface-elevated"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : isMobile ? (
        /* Mobile: stacked list of cards */
        <div className="space-y-3">
          {projects.map((project, i) => (
            <ProjectShelfCover
              key={project.id}
              project={project}
              index={i}
              meId={meId}
              isContributor={contributorIds.has(project.id)}
              prefersReducedMotion={prefersReducedMotion ?? false}
              forceFace
              onClick={() => handleCardClick(project, i)}
            />
          ))}
        </div>
      ) : (
        /* Desktop: centered card carousel */
        <div className="space-y-4">
          {/* Main carousel area */}
          <div className="relative flex items-center justify-center gap-4 sm:gap-6">
            {/* Previous card peek */}
            {activeIndex > 0 && (
              <div className="hidden sm:block w-[120px] xl:w-[160px] shrink-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`prev-${activeIndex}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 0.5, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
                  >
                    <MiniCard
                      project={projects[activeIndex - 1]}
                      onClick={() => navigate(-1)}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            )}

            {/* Center card */}
            <div className="w-full max-w-[560px] sm:max-w-[620px] xl:max-w-[700px] touch-pan-y">
              <AnimatePresence>
                <motion.div
                  key={activeProject?.id ?? "empty"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ x: dragX }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0.1 }
                      : { duration: 0.15, ease: "easeOut" }
                  }
                  className="touch-none cursor-grab active:cursor-grabbing"
                >
                  {activeProject && (
                    <ProjectShelfCover
                      project={activeProject}
                      index={activeIndex}
                      meId={meId}
                      isContributor={contributorIds.has(activeProject.id)}
                      prefersReducedMotion={prefersReducedMotion ?? false}
                      forceFace
                      onClick={() => handleCardClick(activeProject, activeIndex)}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Next card peek */}
            {activeIndex < maxOffset && (
              <div className="hidden sm:block w-[120px] xl:w-[160px] shrink-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`next-${activeIndex}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 0.5, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
                  >
                    <MiniCard
                      project={projects[activeIndex + 1]}
                      onClick={() => navigate(1)}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Navigation + counter bar */}
          <div className="flex items-center justify-between gap-4 px-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(-1)}
                disabled={activeIndex <= 0}
                aria-label="Previous project"
                className="flex h-9 w-9 items-center justify-center rounded-full border card-border bg-surface text-foreground transition hover:bg-surface-elevated hover:border-[var(--user-accent-border,var(--border-strong))] disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate(1)}
                disabled={activeIndex >= maxOffset}
                aria-label="Next project"
                className="flex h-9 w-9 items-center justify-center rounded-full border card-border bg-surface text-foreground transition hover:bg-surface-elevated hover:border-[var(--user-accent-border,var(--border-strong))] disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <span className="numeric text-xs text-muted-foreground">
              {shownIndex + 1} / {projects.length}
            </span>

            <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
              <Keyboard className="h-3.5 w-3.5" />← → to browse
            </span>
          </div>

          {/* Thumbnail strip */}
          {projects.length > 1 && (
            <ProjectShelfThumbnails
              projects={projects}
              activeIndex={shownIndex}
              prefersReducedMotion={prefersReducedMotion ?? false}
              onSelect={jumpTo}
            />
          )}
        </div>
      )}

      <ProjectShelfOverlay
        project={overlayIndex == null ? null : (projects[overlayIndex] ?? null)}
        index={overlayIndex}
        count={projects.length}
        onClose={closeOverlay}
        onNav={(dir) => {
          const next = clamp((overlayIndex ?? 0) + dir, 0, maxOffset);
          setActiveIndex(next);
          setOverlayIndex(next);
        }}
      />
    </div>
  );
}

/* Small peek card for prev/next previews */
function MiniCard({ project, onClick }: { project: ProjectRow; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full cursor-pointer overflow-hidden rounded-xl border card-border bg-surface text-left transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:shadow-md"
    >
      <div className="relative aspect-[3/4] w-full">
        {project.cover_url ? (
          <img
            src={project.cover_url}
            alt=""
            className="h-full w-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
            draggable={false}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-surface-elevated to-surface-sunken" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="truncate text-[11px] font-medium text-white drop-shadow-sm">{project.title}</p>
      </div>
    </button>
  );
}
