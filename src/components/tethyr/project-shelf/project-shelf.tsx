import { useState, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion, useMotionValue, useSpring } from "framer-motion";
import { ProjectShelfHeader } from "./project-shelf-header";
import { ProjectShelfCover } from "./project-shelf-cover";
import { ProjectShelfOverlay } from "./project-shelf-overlay";
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

export function ProjectShelf({ projects, meId, contributorIds, q, setQ, category, setCategory }: ProjectShelfProps) {
  const [overlayProject, setOverlayProject] = useState<ProjectRow | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const velocityRef = useRef(0);
  const lastWheelTimeRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const maxOffset = Math.max(0, projects.length - 1);

  const rawOffset = useMotionValue(0);
  const smoothOffset = useSpring(rawOffset, {
    stiffness: prefersReducedMotion ? 500 : 200,
    damping: prefersReducedMotion ? 100 : 25,
  });

  useEffect(() => {
    if (projects.length === 0) return;
    const clamped = Math.min(rawOffset.get(), maxOffset);
    if (clamped !== rawOffset.get()) rawOffset.set(clamped);
  }, [maxOffset, projects.length, rawOffset]);

  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    const unsub = smoothOffset.on("change", (v) => setActiveIndex(Math.round(v)));
    return unsub;
  }, [smoothOffset]);

  const activeProject = projects[activeIndex] ?? null;

  const snapToNearest = useCallback(() => {
    if (maxOffset <= 0) return;
    const nearest = Math.max(0, Math.min(maxOffset, Math.round(rawOffset.get())));
    rawOffset.set(nearest);
  }, [maxOffset, rawOffset]);

  const navigate = useCallback((dir: -1 | 1) => {
    if (maxOffset <= 0) return;
    const current = Math.round(smoothOffset.get());
    const next = Math.max(0, Math.min(maxOffset, current + dir));
    rawOffset.set(next);
  }, [maxOffset, rawOffset, smoothOffset]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (overlayProject) {
        if (e.key === "Escape") setOverlayProject(null);
        return;
      }
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
      if (e.key === "Enter" && activeProject) setOverlayProject(activeProject);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigate, activeProject, overlayProject]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isMobile) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      const dt = now - lastWheelTimeRef.current;
      lastWheelTimeRef.current = now;

      const delta = -e.deltaY * SCROLL_SENSITIVITY;
      velocityRef.current = delta;
      if (dt < 50) velocityRef.current *= 1.2;

      const current = rawOffset.get();
      const next = Math.max(0, Math.min(maxOffset, current + delta));
      rawOffset.set(next);

      clearTimeout(snapTimerRef.current);
      snapTimerRef.current = setTimeout(snapToNearest, SNAP_DELAY_MS);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
      clearTimeout(snapTimerRef.current);
    };
  }, [isMobile, maxOffset, rawOffset, snapToNearest]);

  const handleCardClick = useCallback((project: ProjectRow, index: number) => {
    lastFocusedRef.current = document.activeElement as HTMLElement;
    rawOffset.set(index);
    setOverlayProject(project);
  }, [rawOffset]);

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
              offset={smoothOffset}
              meId={meId}
              isContributor={contributorIds.has(project.id)}
              prefersReducedMotion={prefersReducedMotion ?? false}
              forceFace
              onClick={() => handleCardClick(project, i)}
            />
          ))}
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative overflow-hidden"
          style={{
            perspective: "1200px",
            height: "50vh",
            minHeight: "320px",
            maxHeight: "480px",
          }}
          role="listbox"
          aria-label="Projects"
          aria-activedescendant={activeProject ? `shelf-card-${activeProject.id}` : undefined}
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
                  offset={smoothOffset}
                  meId={meId}
                  isContributor={contributorIds.has(project.id)}
                  prefersReducedMotion={prefersReducedMotion ?? false}
                  onClick={() => handleCardClick(project, i)}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      <ProjectShelfOverlay
        project={overlayProject}
        onClose={() => {
          setOverlayProject(null);
          setTimeout(() => lastFocusedRef.current?.focus(), 200);
        }}
      />
    </div>
  );
}
