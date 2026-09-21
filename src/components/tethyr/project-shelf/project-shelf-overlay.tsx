import { Suspense, lazy, useCallback, useEffect, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence, useReducedMotion, useMotionValue } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  ExternalLink,
  Users,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Flag,
  Activity,
  CalendarDays,
  HandHeart,
  ArrowRight,
} from "lucide-react";
import { timeAgo } from "@/lib/time";
import { canonicalProjectStatus, isLiveStatus, statusDotClass } from "@/lib/project-status";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CoverGradient } from "./cover-gradient";
import type { ProjectRow } from "@/routes/_authenticated/explore";

// The markdown renderer pulls in highlighting; keep it out of the explore
// chunk — it loads only when an overlay actually shows a README preview.
const ReadmeMarkdown = lazy(() =>
  import("@/components/tethyr/blocks/readme-markdown").then((m) => ({
    default: m.ReadmeMarkdown,
  })),
);

interface ProjectShelfOverlayProps {
  project: ProjectRow | null;
  openRoleCount?: number;
  index: number | null;
  count: number;
  onClose: () => void;
  onNav: (dir: -1 | 1) => void;
}

const STATUS_STYLES: Record<string, { label: string; dot: string; badge: string }> = {
  active: { label: "Active", dot: "bg-trust", badge: "bg-trust/15 text-trust" },
  planning: { label: "Planning", dot: "bg-teaching", badge: "bg-teaching/10 text-teaching" },
  paused: {
    label: "Paused",
    dot: "bg-muted-foreground/40",
    badge: "bg-muted-foreground/10 text-muted-foreground",
  },
  completed: { label: "Completed", dot: "bg-primary", badge: "bg-primary/15 text-primary" },
};

export function ProjectShelfOverlay({
  project,
  openRoleCount = 0,
  index,
  count,
  onClose,
  onNav,
}: ProjectShelfOverlayProps) {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // README preview — fetched lazily on open (the explore grid never pays for
  // it) and cached per project so flipping back and forth doesn't refetch.
  const { data: readme } = useQuery({
    queryKey: ["project-readme-preview", project?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("readme")
        .eq("id", project!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.readme as string | null) ?? null;
    },
    enabled: !!project,
    staleTime: Infinity,
  });

  // ── Swipe-to-dismiss ──
  const panelY = useMotionValue(0);
  const dragStartY = useRef(0);
  const dragActive = useRef(false);
  const DISMISS_THRESHOLD = 100;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragStartY.current = e.clientY;
      dragActive.current = true;
      panelY.set(0);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [panelY],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragActive.current) return;
      const dy = e.clientY - dragStartY.current;
      if (dy > 0) panelY.set(dy); // only track downward
    },
    [panelY],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragActive.current) return;
      dragActive.current = false;
      const dy = e.clientY - dragStartY.current;
      panelY.set(0);
      if (dy >= DISMISS_THRESHOLD) onClose();
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    },
    [panelY, onClose],
  );

  // Focus the close button when a project opens so keyboard users land on the
  // exit control (Radix Dialog owns the focus trap itself from there).
  useEffect(() => {
    if (project) {
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    }
  }, [project]);

  // Radix Dialog (via Root/Portal/Overlay/Content below) provides the focus
  // trap, body scroll lock, backdrop click-to-close, and Escape-to-close —
  // exactly what this lightbox used to hand-roll. We only keep the behaviors
  // that are specific to flipping between projects: arrow keys.
  useEffect(() => {
    if (!project) return;
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "ArrowLeft" && index != null && index > 0) onNav(-1);
      else if (e.key === "ArrowRight" && index != null && index < count - 1) onNav(1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [project, index, count, onNav]);

  const panelTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 200, damping: 25 };

  return (
    <DialogPrimitive.Root
      open={!!project}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {/* forceMount + AnimatePresence keeps the dialog mounted through its exit
          animation — the Radix-sanctioned way to pair Radix with framer-motion. */}
      <AnimatePresence>
        {project && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-background/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </DialogPrimitive.Overlay>

            <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Panel — capped to the viewport so the close button stays
                    reachable on short screens; content scrolls inside. */}
                <Card asChild>
                  <motion.div
                    className="relative mx-4 max-h-[calc(100dvh-2rem)] w-full max-w-[832px] overflow-y-auto overflow-x-hidden shadow-lg"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    style={{ y: panelY }}
                    transition={panelTransition}
                  >
                    <DialogPrimitive.Title className="sr-only">
                      {project.title}
                    </DialogPrimitive.Title>

                    {/* Cross-fade between projects when flipping with the arrows */}
                    <AnimatePresence initial={false}>
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={
                          prefersReducedMotion
                            ? { duration: 0.1 }
                            : { duration: 0.12, ease: "easeOut" }
                        }
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                      >
                        {/* Cover */}
                        <div className="relative aspect-video">
                          <CoverGradient coverUrl={project.cover_url} fit="contain" />

                          {/* Close button */}
                          <button
                            ref={closeButtonRef}
                            onClick={onClose}
                            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-background/60 text-foreground transition-lift hover:bg-background/80"
                            aria-label="Close overlay"
                          >
                            <X className="h-4 w-4" />
                          </button>

                          {/* Status badges */}
                          <div className="absolute left-4 top-4 flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider",
                                STATUS_STYLES[project.status]?.badge ?? STATUS_STYLES.active.badge,
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  statusDotClass(project.status),
                                  isLiveStatus(project.status, project.stage) &&
                                    "animate-status-breathe",
                                )}
                              />
                              {canonicalProjectStatus(project.status, project.stage) ??
                                STATUS_STYLES[project.status]?.label ??
                                "Active"}
                            </span>
                            {/* Matches the shelf cover: a posted role outranks the
                                generic "open to collaborators" signal. */}
                            {openRoleCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-trust/20 px-2 py-0.5 text-[11px] font-medium text-trust">
                                <Users className="h-2.5 w-2.5" />
                                {openRoleCount} role{openRoleCount !== 1 ? "s" : ""} open
                              </span>
                            ) : (
                              project.looking_for_collaborators && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--user-accent,var(--ai))]/20 px-2 py-0.5 text-[11px] font-medium text-[var(--user-accent,var(--ai))]">
                                  <Users className="h-2.5 w-2.5" />
                                  Open
                                </span>
                              )
                            )}
                          </div>

                          {/* Title overlay — guaranteed scrim so white text is always
                            readable over any cover image. The title block is a real
                            link: the cover/title is the most obvious click target, so
                            it must lead to the full project page (README, files,
                            people) instead of dead-ending in this preview. */}
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 on-media-scrim" />
                          <Link
                            to="/projects/$id"
                            params={{ id: project.id }}
                            onClick={onClose}
                            className="group/link absolute bottom-4 left-4 right-4 z-10 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <p className="text-xl font-bold text-white drop-shadow-lg underline-offset-4 group-hover/link:underline decoration-white/60">
                              {project.title}
                            </p>
                            {project.profiles && (
                              <p className="text-sm text-white/80 drop-shadow">
                                by{" "}
                                {project.profiles.display_name ||
                                  project.profiles.handle ||
                                  "Member"}
                              </p>
                            )}
                          </Link>
                        </div>

                        {/* Content */}
                        <div className="space-y-5 p-6 sm:p-8">
                          {project.description && (
                            <p className="text-sm leading-relaxed text-muted-foreground/90">
                              {project.description}
                            </p>
                          )}

                          {/* Facts strip — the "what am I looking at" line:
                              stage, momentum, age, and collaboration intent. */}
                          <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <dt className="sr-only">Status</dt>
                              <Flag className="h-3.5 w-3.5" />
                              <dd>
                                {canonicalProjectStatus(project.status, project.stage) ??
                                  "In motion"}
                              </dd>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <dt className="sr-only">Momentum</dt>
                              <Activity
                                className="h-3.5 w-3.5"
                                aria-label="Momentum — set by the builder, nudged by completed milestones and recent activity"
                              />
                              <dd
                                className="tabular-nums"
                                title="Momentum — set by the builder, nudged by completed milestones and recent activity"
                              >
                                {project.progress_percent}% complete
                              </dd>
                            </div>
                            {project.created_at && (
                              <div className="flex items-center gap-1.5">
                                <dt className="sr-only">Started</dt>
                                <CalendarDays className="h-3.5 w-3.5" />
                                <dd>{timeAgo(project.created_at)}</dd>
                              </div>
                            )}
                            {(project.looking_for_collaborators ||
                              project.looking_for_feedback) && (
                              <div className="flex items-center gap-1.5">
                                <dt className="sr-only">Looking for</dt>
                                <HandHeart className="h-3.5 w-3.5" />
                                <dd>
                                  {project.looking_for_collaborators &&
                                    (project.looking_for_feedback
                                      ? "Collaborators · feedback"
                                      : "Collaborators")}
                                  {project.looking_for_feedback &&
                                    !project.looking_for_collaborators &&
                                    "Feedback"}
                                </dd>
                              </div>
                            )}
                          </dl>

                          {/* Momentum bar — mirrors the card cover and the
                              project page's progress strip. */}
                          <div
                            className="h-1 overflow-hidden rounded-full bg-surface-elevated"
                            role="progressbar"
                            aria-valuenow={project.progress_percent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${project.progress_percent}% complete`}
                          >
                            <div
                              className="h-full rounded-full bg-[var(--user-accent,var(--primary))]"
                              style={{ width: `${project.progress_percent}%` }}
                            />
                          </div>

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

                          {/* README preview — a taste of the project homepage
                              (the README is Tethyr's project front page). The
                              clamped preview is non-interactive so truncated
                              controls (copy buttons) can't half-work; the full
                              read is one click away. */}
                          {readme && readme.trim() && (
                            <section
                              aria-label="README preview"
                              className="space-y-2 border-t border-border/60 pt-4"
                            >
                              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                README
                              </p>
                              <div className="pointer-events-none line-clamp-6">
                                <Suspense fallback={null}>
                                  <ReadmeMarkdown>{readme}</ReadmeMarkdown>
                                </Suspense>
                              </div>
                              <Link
                                to="/projects/$id"
                                params={{ id: project.id }}
                                onClick={onClose}
                                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--user-accent,var(--primary))] hover:underline"
                              >
                                Read the full README
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            </section>
                          )}
                        </div>

                        {/* Footer: flip nav + actions */}
                        <div className="flex items-center justify-between border-t border-border/60 px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onNav(-1)}
                              disabled={index == null || index <= 0}
                              aria-label="Previous project"
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-lift hover:bg-surface-sunken hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
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
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-lift hover:bg-surface-sunken hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
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
                              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-fade hover:opacity-90"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              View Project
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </motion.div>
                </Card>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
