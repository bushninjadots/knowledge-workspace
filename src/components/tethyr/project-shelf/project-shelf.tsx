import { useState, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion, useMotionValue, animate } from "framer-motion";
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
  const lastWheelTimeRef = useRef(0);
  const activeProjectRef = useRef<ProjectRow | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const maxOffset = Math.max(0, projects.length - 1);

  const displayOffset = useMotionValue(0);

  useEffect(() => {
    if (projects.length === 0) return;
    const clamped = Math.min(displayOffset.get(), maxOffset);
    if (clamped !== displayOffset.get()) displayOffset.set(clamped);
  }, [maxOffset, projects.length, displayOffset]);

  useEffect(() => {
    if (projects.length === 0) return;
    const unsub = displayOffset.on("change", (v) => {
      const idx = Math.round(v);
      if (idx !== (activeProjectRef.current ? projects.indexOf(activeProjectRef.current) : -1)) {
        activeProjectRef.current = projects[idx] ?? null;
      }
      const container = containerRef.current;
      if (container) {
        const id = projects[idx] ? `shelf-card-${projects[idx].id}` : undefined;
        if (id) container.setAttribute("aria-activedescendant", id);
        else container.removeAttribute("aria-activedescendant");
      }
    });
    return unsub;
  }, [displayOffset, projects]);

  const snapToNearest = useCallback(() => {
    if (maxOffset <= 0) return;
    const nearest = Math.max(0, Math.min(maxOffset, Math.round(displayOffset.get())));
    animate(displayOffset, nearest, {
      type: "spring",
      stiffness: prefersReducedMotion ? 500 : 200,
      damping: prefersReducedMotion ? 100 : 25,
    });
  }, [maxOffset, displayOffset, prefersReducedMotion]);

  const navigate = useCallback((dir: -1 | 1) => {
    if (maxOffset <= 0) return;
    displayOffset.stop();
    const current = Math.round(displayOffset.get());
    const next = Math.max(0, Math.min(maxOffset, current + dir));
    animate(displayOffset, next, {
      type: "spring",
      stiffness: 300,
      damping: 30,
    });
  }, [maxOffset, displayOffset]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (overlayProject) {
        if (e.key === "Escape") setOverlayProject(null);
        return;
      }
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
      if (e.key === "Enter" && activeProjectRef.current) setOverlayProject(activeProjectRef.current);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigate, overlayProject]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isMobile) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      displayOffset.stop();

      const now = Date.now();
      const dt = now - lastWheelTimeRef.current;
      lastWheelTimeRef.current = now;

      let delta = -e.deltaY * SCROLL_SENSITIVITY;
      if (dt < 50) delta *= 1.2;

      const current = displayOffset.get();
      const next = Math.max(0, Math.min(maxOffset, current + delta));
      displayOffset.set(next);

      clearTimeout(snapTimerRef.current);
      snapTimerRef.current = setTimeout(snapToNearest, SNAP_DELAY_MS);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
      clearTimeout(snapTimerRef.current);
    };
  }, [isMobile, maxOffset, displayOffset, snapToNearest]);

  const handleCardClick = useCallback((project: ProjectRow, index: number) => {
    lastFocusedRef.current = document.activeElement as HTMLElement;
    displayOffset.stop();
    displayOffset.set(index);
    setOverlayProject(project);
  }, [displayOffset]);

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
