import { cn } from "@/lib/utils";
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
  meId: string | null;
  isContributor: boolean;
  prefersReducedMotion: boolean;
  forceFace?: boolean;
  onClick: () => void;
}

export function ProjectShelfCover(props: ProjectShelfCoverProps) {
  return <ProjectShelfFace {...props} />;
}

/**
 * Clean, static project card — full cover image at 16:9,
 * info panel below. No 3D transforms, no animation math.
 */
function ProjectShelfFace({ project, meId, isContributor, onClick }: ProjectShelfCoverProps) {
  const status = STATUS_STYLES[project.status] ?? STATUS_STYLES.active;
  const isOwn = project.profiles?.id === meId;

  return (
    <button
      onClick={onClick}
      className="group relative w-full cursor-pointer overflow-hidden rounded-xl border card-border bg-surface text-left shadow-sm transition-spatial transition-shadow duration-300 hover:-translate-y-1 hover:shadow-md hover:border-[var(--user-accent-border,var(--border-strong))]"
      aria-label={`View ${project.title}`}
    >
      {/* Cover image — 16:9, object-contain to show the whole image */}
      <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
        <CoverGradient
          tags={project.tags}
          coverUrl={project.cover_url}
          progress={project.progress_percent}
          fit="contain"
        />

        {/* Subtle specular sheen on hover */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        {/* Status badge */}
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </span>
          {isOwn && (
            <span className="rounded-full bg-brand-green/25 px-2 py-0.5 text-[11px] font-medium text-brand-green">
              Your project
            </span>
          )}
          {isContributor && (
            <span className="rounded-full bg-brand-purple/25 px-2 py-0.5 text-[11px] font-medium text-brand-purple">
              Contributing
            </span>
          )}
        </div>

        {/* Progress bar at the bottom of the cover */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <ProgressBar progress={project.progress_percent} />
        </div>
      </div>

      {/* Info panel */}
      <div className="flex flex-col gap-1.5 border-t border-black/10 bg-gradient-to-b from-surface/60 to-surface p-4 dark:border-white/10">
        <div className="flex items-start justify-between gap-2">
          <p
            className="min-w-0 text-sm font-bold text-foreground group-hover:text-primary transition-colors"
            title={project.title}
          >
            {project.title}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {project.looking_for_collaborators && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-brand-purple/15 px-2 py-0.5 text-[11px] font-medium text-brand-purple">
                Open
              </span>
            )}
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
              {project.progress_percent}%
            </span>
          </div>
        </div>

        {project.profiles && (
          <p
            className="truncate text-xs text-muted-foreground"
            title={`by ${project.profiles.display_name || project.profiles.handle || "Member"} · ${status.label}`}
          >
            by {project.profiles.display_name || project.profiles.handle || "Member"}
            {" · "}
            {status.label}
          </p>
        )}

        {project.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground/85">
            {project.description}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
          {project.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded-full border card-border bg-surface-elevated/60 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
          {project.tags.length > 4 && (
            <span className="text-[11px] text-muted-foreground/50">+{project.tags.length - 4}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// getCardHeight kept for backward compat with project-shelf-thumbnails
export function getCardHeight(_absDist: number): number {
  return 540;
}
