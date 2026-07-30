import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Users, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { CoverGradient } from "./cover-gradient";
import type { ProjectRow } from "@/routes/_authenticated/explore";

interface ProjectShelfOverlayProps {
  project: ProjectRow | null;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, { label: string; dot: string; badge: string }> = {
  active: { label: "Active", dot: "bg-brand-green", badge: "bg-brand-green/15 text-brand-green" },
  planning: { label: "Planning", dot: "bg-amber-400", badge: "bg-amber-400/15 text-amber-400" },
  paused: { label: "Paused", dot: "bg-muted-foreground/40", badge: "bg-muted-foreground/10 text-muted-foreground" },
  completed: { label: "Completed", dot: "bg-primary", badge: "bg-primary/15 text-primary" },
};

export function ProjectShelfOverlay({ project, onClose }: ProjectShelfOverlayProps) {
  const navigate = useNavigate();

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
            layoutId={`shelf-card-${project.id}`}
            className="relative mx-4 w-full max-w-2xl overflow-hidden rounded-3xl border border-border/60 bg-surface shadow-2xl"
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          >
            {/* Cover */}
            <div className="relative aspect-video">
              <CoverGradient tags={project.tags} coverUrl={project.cover_url} progress={project.progress_percent} />

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-background/60 text-foreground backdrop-blur-sm transition hover:bg-background/80"
                aria-label="Close overlay"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Status badges */}
              <div className="absolute left-4 top-4 flex items-center gap-2">
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider backdrop-blur-sm",
                  STATUS_STYLES[project.status]?.badge ?? STATUS_STYLES.active.badge,
                )}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_STYLES[project.status]?.dot ?? STATUS_STYLES.active.dot)} />
                  {STATUS_STYLES[project.status]?.label ?? "Active"}
                </span>
                {project.looking_for_collaborators && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-purple/20 px-2 py-0.5 text-[10px] font-medium text-brand-purple backdrop-blur-sm">
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

              {/* Tags */}
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

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
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
                {project.looking_for_feedback && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    Wants feedback
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
