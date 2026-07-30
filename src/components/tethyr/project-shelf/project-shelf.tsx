import { useState, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
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

export function ProjectShelf({ projects, meId, contributorIds, q, setQ, category, setCategory }: ProjectShelfProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [overlayProject, setOverlayProject] = useState<ProjectRow | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeProject = projects[activeIndex];

  const scrollToActive = useCallback((idx: number) => {
    const container = containerRef.current;
    if (!container) return;
    const cards = container.querySelectorAll<HTMLElement>("[role=option]");
    const card = cards[idx];
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, []);

  const navigate = useCallback((dir: -1 | 1) => {
    setActiveIndex((prev) => Math.max(0, Math.min(projects.length - 1, prev + dir)));
  }, [projects.length]);

  useEffect(() => {
    scrollToActive(activeIndex);
  }, [activeIndex, scrollToActive]);

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

  return (
    <div className="space-y-6">
      <ProjectShelfHeader
        q={q}
        setQ={setQ}
        category={category}
        setCategory={setCategory}
        count={projects.length}
      />

      {/* Shelf */}
      <div
        ref={containerRef}
        className="overflow-x-auto scrollbar-none"
        style={{ perspective: "1200px" }}
        role="listbox"
        aria-label="Projects"
        aria-activedescendant={activeProject ? `shelf-card-${activeProject.id}` : undefined}
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key={`${q}-${category}`}
            className="flex items-center gap-4 px-4 py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {projects.map((project, i) => (
              <ProjectShelfCover
                key={project.id}
                project={project}
                index={i}
                activeIndex={activeIndex}
                meId={meId}
                isContributor={contributorIds.has(project.id)}
                onClick={() => {
                  setActiveIndex(i);
                  scrollToActive(i);
                  setOverlayProject(project);
                }}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Overlay */}
      <ProjectShelfOverlay
        project={overlayProject}
        onClose={() => setOverlayProject(null)}
      />
    </div>
  );
}
