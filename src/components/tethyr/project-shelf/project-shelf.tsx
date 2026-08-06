import { useState, useCallback, useRef, useEffect } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useMotionValue,
  useTransform,
  useMotionValueEvent,
  animate,
} from "framer-motion";
import { ChevronLeft, ChevronRight, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectShelfHeader } from "./project-shelf-header";
import { ProjectShelfCover, STATUS_STYLES, getCardWidth } from "./project-shelf-cover";
import { ProjectShelfOverlay } from "./project-shelf-overlay";
import { CATEGORY_COLORS, inferCategory } from "@/lib/category-colors";
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

const SCROLL_SENSITIVITY = 0.001;
const SNAP_DELAY_MS = 180;

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
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastWheelTimeRef = useRef(0);
  const wheelVelocityRef = useRef(0); // units per ms
  const overlayIndexRef = useRef<number | null>(null);
  const dragSuppressClickRef = useRef(false);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    lastX: number;
    lastT: number;
    startOffset: number;
    velocity: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const displayOffset = useMotionValue(0);
  const maxOffset = Math.max(0, projects.length - 1);
  const shownIndex = Math.min(activeIndex, maxOffset);

  const updateOverlayIndex = useCallback((v: number | null) => {
    overlayIndexRef.current = v;
    setOverlayIndex(v);
  }, []);

  useEffect(() => {
    if (projects.length === 0) return;
    const clamped = Math.min(displayOffset.get(), maxOffset);
    if (clamped !== displayOffset.get()) displayOffset.set(clamped);
  }, [maxOffset, projects.length, displayOffset]);

  // Keep the overlay index valid when the project list changes.
  useEffect(() => {
    if (projects.length === 0) updateOverlayIndex(null);
    else if (overlayIndexRef.current != null)
      updateOverlayIndex(Math.min(overlayIndexRef.current, maxOffset));
  }, [projects.length, maxOffset, updateOverlayIndex]);

  useMotionValueEvent(displayOffset, "change", (v) => {
    const idx = clamp(Math.round(v), 0, maxOffset);
    setActiveIndex((prev) => (prev === idx ? prev : idx));
    const container = containerRef.current;
    if (container) {
      const id = projects[idx] ? `shelf-card-${projects[idx].id}` : undefined;
      if (id) container.setAttribute("aria-activedescendant", id);
      else container.removeAttribute("aria-activedescendant");
    }
  });

  const snapToNearest = useCallback(
    (velocityUnitsPerMs = 0) => {
      if (maxOffset <= 0) return;
      const nearest = clamp(Math.round(displayOffset.get()), 0, maxOffset);
      animate(displayOffset, nearest, {
        type: "spring",
        stiffness: prefersReducedMotion ? 500 : 300,
        damping: prefersReducedMotion ? 100 : 28,
        mass: prefersReducedMotion ? 1 : 0.9,
        velocity: prefersReducedMotion ? 0 : velocityUnitsPerMs * 500,
      });
    },
    [maxOffset, displayOffset, prefersReducedMotion],
  );

  const navigate = useCallback(
    (dir: -1 | 1) => {
      if (maxOffset <= 0) return;
      displayOffset.stop();
      const current = Math.round(displayOffset.get());
      const next = clamp(current + dir, 0, maxOffset);
      if (next === current) {
        // At the edge — a small "thunk" so it feels physical.
        if (!prefersReducedMotion) {
          animate(
            displayOffset,
            [current, clamp(current + dir * 0.12, 0, maxOffset + 0.2), current],
            { duration: 0.16, ease: "easeInOut" },
          );
        }
        return;
      }
      animate(displayOffset, next, {
        type: "spring",
        stiffness: 340,
        damping: 32,
        mass: 0.9,
        velocity: prefersReducedMotion ? 0 : dir * 2.4,
      });
    },
    [maxOffset, displayOffset, prefersReducedMotion],
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (overlayIndexRef.current != null) return; // overlay handles its own keys
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
      if (e.key === "Enter" && projects[activeIndex]) updateOverlayIndex(activeIndex);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigate, activeIndex, projects, updateOverlayIndex]);

  // Wheel scroll with inertia.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || isMobile) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      displayOffset.stop();

      const now = performance.now();
      const dt = Math.max(1, now - lastWheelTimeRef.current);
      lastWheelTimeRef.current = now;

      let delta = -e.deltaY * SCROLL_SENSITIVITY;
      if (dt < 50) delta *= 1.2;

      const instVel = delta / dt; // units per ms
      wheelVelocityRef.current = wheelVelocityRef.current * 0.55 + instVel * 0.45;

      const next = clamp(displayOffset.get() + delta, 0, maxOffset);
      displayOffset.set(next);

      clearTimeout(snapTimerRef.current);
      snapTimerRef.current = setTimeout(
        () => snapToNearest(wheelVelocityRef.current),
        SNAP_DELAY_MS,
      );
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
      clearTimeout(snapTimerRef.current);
    };
  }, [isMobile, maxOffset, displayOffset, snapToNearest]);

  const getPxPerStep = useCallback(() => {
    const w = containerRef.current?.clientWidth ?? 900;
    return Math.max(240, w * 0.34);
  }, []);

  // Drag-to-flip with momentum (desktop).
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const s = dragStateRef.current;
      if (!s || s.pointerId !== e.pointerId) return;
      const now = performance.now();
      const dt = Math.max(1, now - s.lastT);
      const instVel = ((e.clientX - s.lastX) / dt) * 1000; // px/s
      s.velocity = s.velocity * 0.82 + instVel * 0.18;
      s.lastX = e.clientX;
      s.lastT = now;
      if (Math.abs(e.clientX - s.startX) > 5) s.moved = true;
      if (s.moved) {
        setIsDragging(true);
        displayOffset.set(
          clamp(s.startOffset - (e.clientX - s.startX) / getPxPerStep(), 0, maxOffset),
        );
      }
    };

    const handlePointerEnd = (e: PointerEvent) => {
      const s = dragStateRef.current;
      if (!s || s.pointerId !== e.pointerId) return;
      dragStateRef.current = null;
      if (s.moved) {
        dragSuppressClickRef.current = true;
        const pxPerStep = getPxPerStep();
        const flickUnits = (s.velocity * 0.16) / pxPerStep;
        const target = clamp(Math.round(displayOffset.get() + flickUnits), 0, maxOffset);
        animate(displayOffset, target, {
          type: "spring",
          stiffness: prefersReducedMotion ? 500 : 320,
          damping: prefersReducedMotion ? 100 : 30,
          mass: 0.9,
          velocity: prefersReducedMotion ? 0 : (s.velocity / pxPerStep) * 0.6,
        });
      }
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [maxOffset, displayOffset, getPxPerStep, prefersReducedMotion]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (overlayIndexRef.current != null || projects.length <= 1) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // A fresh gesture is never a click-suppression carry-over.
    dragSuppressClickRef.current = false;
    displayOffset.stop();
    clearTimeout(snapTimerRef.current);
    wheelVelocityRef.current = 0;
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      lastX: e.clientX,
      lastT: performance.now(),
      startOffset: displayOffset.get(),
      velocity: 0,
      moved: false,
    };
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragSuppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      dragSuppressClickRef.current = false;
    }
  };

  const handleCardClick = useCallback(
    (project: ProjectRow, index: number) => {
      lastFocusedRef.current = document.activeElement as HTMLElement;
      displayOffset.stop();
      displayOffset.set(index);
      updateOverlayIndex(index);
    },
    [displayOffset, updateOverlayIndex],
  );

  const overlayNav = useCallback(
    (dir: -1 | 1) => {
      const cur = overlayIndexRef.current;
      if (cur == null || maxOffset <= 0) return;
      const next = clamp(cur + dir, 0, maxOffset);
      if (prefersReducedMotion) displayOffset.set(next);
      else
        animate(displayOffset, next, {
          type: "spring",
          stiffness: 320,
          damping: 30,
          mass: 0.9,
        });
      updateOverlayIndex(next);
    },
    [maxOffset, displayOffset, updateOverlayIndex, prefersReducedMotion],
  );

  const closeOverlay = useCallback(() => {
    updateOverlayIndex(null);
    setTimeout(() => lastFocusedRef.current?.focus(), 200);
  }, [updateOverlayIndex]);

  const activeProject =
    projects.length > 0 ? projects[Math.min(activeIndex, projects.length - 1)] : undefined;
  const spotlightColors = activeProject
    ? (CATEGORY_COLORS[inferCategory(activeProject.tags)] ?? CATEGORY_COLORS.Design)
    : CATEGORY_COLORS.Design;
  const spotlightBg = `radial-gradient(closest-side, oklch(0.62 ${spotlightColors.sat / 100} ${spotlightColors.hue} / 0.16), transparent 74%)`;
  const floorShadowY = useTransform(displayOffset, () => getCardWidth(0) * (9 / 32) + 8);

  return (
    <div className="space-y-6">
      <ProjectShelfHeader
        q={q}
        setQ={setQ}
        category={category}
        setCategory={setCategory}
        count={projects.length}
      />

      {isMobile ? (
        <div className="space-y-3 px-4">
          {projects.map((project, i) => (
            <ProjectShelfCover
              key={project.id}
              project={project}
              index={i}
              offset={displayOffset}
              meId={meId}
              isContributor={contributorIds.has(project.id)}
              prefersReducedMotion={prefersReducedMotion ?? false}
              forceFace
              onClick={() => handleCardClick(project, i)}
            />
          ))}
        </div>
      ) : (
        <>
          <div
            className="relative"
            style={{
              perspective: "1200px",
              height: "50vh",
              minHeight: "320px",
              maxHeight: "480px",
            }}
          >
            {/* Stage spotlight — follows the active project's category colour */}
            <AnimatePresence>
              {activeProject && (
                <motion.div
                  key={activeProject.id}
                  className="pointer-events-none absolute left-1/2 top-1/2 h-[88%] w-[min(60vw,640px)] -translate-x-1/2 -translate-y-1/2 rounded-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4 }}
                  style={{ background: spotlightBg }}
                />
              )}
            </AnimatePresence>

            {/* Floor contact shadow under the front card */}
            <motion.div
              className="pointer-events-none absolute left-1/2 top-1/2 h-5 rounded-[50%] bg-black/10 blur-xl dark:bg-black/45"
              style={{ width: "min(48vw, 440px)", x: "-50%", y: floorShadowY }}
            />

            <div
              ref={containerRef}
              className={cn(
                "absolute inset-0 select-none overflow-hidden",
                isDragging ? "cursor-grabbing" : "cursor-grab",
              )}
              style={{ touchAction: "pan-y" }}
              role="listbox"
              aria-label="Projects"
              onPointerDown={handlePointerDown}
              onClickCapture={handleClickCapture}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${q}-${category}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
                >
                  {projects.map((project, i) => (
                    <ProjectShelfCover
                      key={project.id}
                      project={project}
                      index={i}
                      offset={displayOffset}
                      meId={meId}
                      isContributor={contributorIds.has(project.id)}
                      prefersReducedMotion={prefersReducedMotion ?? false}
                      isActive={Math.abs(i - activeIndex) < 0.6}
                      onClick={() => handleCardClick(project, i)}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Prev / Next arrows */}
            {projects.length > 1 && (
              <>
                <div className="absolute inset-y-0 left-3 z-30 flex items-center">
                  <button
                    onClick={() => navigate(-1)}
                    disabled={activeIndex <= 0}
                    aria-label="Previous project"
                    title="Previous project (←)"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/70 text-foreground shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-background active:scale-95 disabled:pointer-events-none disabled:opacity-25"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                </div>
                <div className="absolute inset-y-0 right-3 z-30 flex items-center">
                  <button
                    onClick={() => navigate(1)}
                    disabled={activeIndex >= maxOffset}
                    aria-label="Next project"
                    title="Next project (→)"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/70 text-foreground shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-background active:scale-95 disabled:pointer-events-none disabled:opacity-25"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Caption + position bar */}
          {projects.length > 0 && (
            <div className="flex items-center gap-4 px-1">
              <div className="min-w-0 flex-1" aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeProject?.id ?? "empty"}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.15 }}
                    className="min-w-0"
                  >
                    <p className="truncate text-sm font-semibold text-foreground">
                      {activeProject?.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      by{" "}
                      {activeProject?.profiles?.display_name ||
                        activeProject?.profiles?.handle ||
                        "Member"}{" "}
                      · {STATUS_STYLES[activeProject?.status ?? ""]?.label ?? "Active"} ·{" "}
                      {activeProject?.progress_percent ?? 0}% complete
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="numeric text-xs text-muted-foreground-subtle">
                  {shownIndex + 1} / {projects.length}
                </span>
                <div className="h-1 w-24 overflow-hidden rounded-full bg-border">
                  <motion.div
                    className="h-full rounded-full bg-primary/80"
                    animate={{ width: `${((shownIndex + 1) / projects.length) * 100}%` }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 300, damping: 30 }
                    }
                  />
                </div>
                <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground-subtle md:flex">
                  <Keyboard className="h-3.5 w-3.5" />← → to browse
                </span>
              </div>
            </div>
          )}
        </>
      )}

      <ProjectShelfOverlay
        project={
          overlayIndex == null
            ? null
            : (projects[Math.min(overlayIndex, projects.length - 1)] ?? null)
        }
        index={overlayIndex}
        count={projects.length}
        onClose={closeOverlay}
        onNav={overlayNav}
      />
    </div>
  );
}
