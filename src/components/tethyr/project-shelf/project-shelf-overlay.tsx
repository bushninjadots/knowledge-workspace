import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, ExternalLink, Users, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { CoverGradient } from "./cover-gradient";
import type { ProjectRow } from "@/routes/_authenticated/explore";

interface ProjectShelfOverlayProps {
  project: ProjectRow | null;
  index: number | null;
  count: number;
  onClose: () => void;
  onNav: (dir: -1 | 1) => void;
}

const STATUS_STYLES: Record<string, { label: string; dot: string; badge: string }> = {
  active: { label: "Active", dot: "bg-brand-green", badge: "bg-brand-green/15 text-brand-green" },
  planning: { label: "Planning", dot: "bg-teaching", badge: "bg-teaching text-teaching" },
  paused: {
    label: "Paused",
    dot: "bg-muted-foreground/40",
    badge: "bg-muted-foreground/10 text-muted-foreground",
  },
  completed: { label: "Completed", dot: "bg-primary", badge: "bg-primary/15 text-primary" },
};

export function ProjectShelfOverlay({
  project,
  index,
  count,
  onClose,
  onNav,
}: ProjectShelfOverlayProps) {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (project) {
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    }
  }, [project]);

  useEffect(() => {
    if (!project) return;
    const panel = panelRef.current;
    if (!panel) return;
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    panel.addEventListener("keydown", handleTab);
    return () => panel.removeEventListener("keydown", handleTab);
  }, [project]);

  // Flip between projects from inside the overlay.
  useEffect(() => {
    if (!project) return;
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && index != null && index > 0) onNav(-1);
      else if (e.key === "ArrowRight" && index != null && index < count - 1) onNav(1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [project, index, count, onClose, onNav]);

  return (
    <AnimatePresence>
      {project && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-background/60 backdrop-blur-2xl"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            layoutId="shelf-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={project.title}
            className="relative mx-4 w-full max-w-2xl overflow-hidden rounded-3xl border border-border/60 bg-surface shadow-2xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: "spring" as const, stiffness: 200, damping: 25 }
            }
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={
                  prefersReducedMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }
                }
              >
                {/* Cover */}
                <div className="relative aspect-video">
                  <CoverGradient
                    tags={project.tags}
                    coverUrl={project.cover_url}
                    progress={project.progress_percent}
                    fit="contain"
                  />

                  {/* Close button */}
                  <button
                    ref={closeButtonRef}
                    onClick={onClose}
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-background/60 text-foreground backdrop-blur-sm transition hover:bg-background/80"
                    aria-label="Close overlay"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  {/* Status badges */}
                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider backdrop-blur-sm",
                        STATUS_STYLES[project.status]?.badge ?? STATUS_STYLES.active.badge,
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          STATUS_STYLES[project.status]?.dot ?? STATUS_STYLES.active.dot,
                        )}
                      />
                      {STATUS_STYLES[project.status]?.label ?? "Active"}
                    </span>
                    {project.looking_for_collaborators && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-purple/20 px-2 py-0.5 text-[11px] font-medium text-brand-purple backdrop-blur-sm">
                        <Users className="h-2.5 w-2.5" />
                        Open
                      </span>
                    )}
                  </div>

                  {/* Title overlay */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-lg font-semibold text-white drop-shadow-lg">
                      {project.title}
                    </p>
                    {project.profiles && (
                      <p className="text-sm text-white/80 drop-shadow">
                        by {project.profiles.display_name || project.profiles.handle || "Member"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-4 p-6">
                  {project.description && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {project.description}
                    </p>
                  )}

                  {project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {project.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-surface-elevated px-2.5 py-1 text-[11px] text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer: flip nav + actions */}
                <div className="flex items-center justify-between border-t border-border/60 px-6 py-4">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onNav(-1)}
                      disabled={index == null || index <= 0}
                      aria-label="Previous project"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:bg-surface-sunken hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="numeric px-2 text-xs text-muted-foreground">
                      {index != null ? index + 1 : "-"} / {count}
                    </span>
                    <button
                      onClick={() => onNav(1)}
                      disabled={index == null || index >= count - 1}
                      aria-label="Next project"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:bg-surface-sunken hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    {project.looking_for_feedback && (
                      <span className="hidden items-center gap-1.5 rounded-full border border-border/60 px-3 py-2 text-xs text-muted-foreground sm:inline-flex">
                        <MessageSquare className="h-3 w-3" />
                        Wants feedback
                      </span>
                    )}
                    <button
                      onClick={() => {
                        navigate({ to: "/projects/$id", params: { id: project.id } });
                        onClose();
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View Project
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
