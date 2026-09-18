import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { CoverGradient, ProgressBar } from "./cover-gradient";
import { ownerAccentStyle } from "@/lib/background-themes";
import type { ProjectRow } from "@/routes/_authenticated/explore";

export const STATUS_STYLES: Record<string, { label: string; dot: string }> = {
  active: { label: "Active", dot: "bg-trust" },
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
  openRoleCount?: number;
  onClick: () => void;
}

export function ProjectShelfCover(props: ProjectShelfCoverProps) {
  return <ProjectShelfFace {...props} />;
}

/**
 * Clean, static project card — full cover image at 16:9,
 * info panel below. No 3D transforms, no animation math.
 */
function ProjectShelfFace({
  project,
  meId,
  isContributor,
  openRoleCount = 0,
  onClick,
}: ProjectShelfCoverProps) {
  const status = STATUS_STYLES[project.status] ?? STATUS_STYLES.active;
  const isOwn = project.profiles?.id === meId;
  const ownerAccent = ownerAccentStyle(project.profiles?.background);

  return (
    <Card asChild>
      <button
        onClick={onClick}
        style={ownerAccent}
        className="group relative w-full cursor-pointer overflow-hidden text-left transition-spatial duration-150 hover:-translate-y-1 hover:border-[var(--user-accent-border,var(--border-strong))]"
        aria-label={`View ${project.title}`}
      >
        {/* Cover image — 16:9, object-contain to show the whole image */}
        <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
          <CoverGradient coverUrl={project.cover_url} fit="contain" hoverZoom />

          {/* Subtle specular sheen on hover */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-transparent opacity-0 transition-opacity duration-150 group-hover:opacity-100" />

          {/* Status badge */}
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-foreground">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  status.dot,
                  project.status === "active" && "animate-status-breathe",
                )}
              />
              {status.label}
            </span>
            {isOwn && (
              <span className="rounded-full bg-trust/25 px-2 py-0.5 text-[11px] font-medium text-trust">
                Your project
              </span>
            )}
            {isContributor && (
              <span className="rounded-full bg-[var(--user-accent,var(--ai))]/25 px-2 py-0.5 text-[11px] font-medium text-[var(--user-accent,var(--ai))]">
                Contributing
              </span>
            )}
          </div>

          {/* Progress bar at the bottom of the cover */}
          <div className="absolute bottom-0 left-0 right-0 z-10">
            <ProgressBar
              progress={project.progress_percent}
              variant={project.cover_url ? "on-image" : "on-surface"}
            />
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
              {/* A posted role is more specific than "open to collaborators",
                  so the count wins when both are true. */}
              {openRoleCount > 0 ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-trust/15 px-2 py-0.5 text-[11px] font-medium text-trust">
                  {openRoleCount} role{openRoleCount !== 1 ? "s" : ""} open
                </span>
              ) : (
                project.looking_for_collaborators && (
                  <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--user-accent,var(--ai))]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--user-accent,var(--ai))]">
                    Open
                  </span>
                )
              )}
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {project.progress_percent}%
              </span>
            </div>
          </div>

          {project.profiles && (
            <p
              className="truncate text-xs text-muted-foreground"
              title={
                project.profiles.availability === "available"
                  ? `${project.profiles.display_name || project.profiles.handle || "Member"} · open to collaboration`
                  : `by ${project.profiles.display_name || project.profiles.handle || "Member"} · ${status.label}`
              }
            >
              {project.profiles.availability === "available" && (
                <span
                  aria-hidden="true"
                  className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-trust align-middle"
                />
              )}
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

          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {project.tags.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="rounded-full border card-border bg-surface-elevated/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
              {project.tags.length > 4 && (
                <span className="text-[11px] text-muted-foreground/50">
                  +{project.tags.length - 4}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    </Card>
  );
}
