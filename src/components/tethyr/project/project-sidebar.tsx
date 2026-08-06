import { Link } from "@tanstack/react-router";
import { ExternalLink, Briefcase } from "lucide-react";
import { ProjectTimeline, type ProjectStage } from "./project-timeline";
import type { ProjectDetail, OpenRoleRow } from "@/hooks/use-projects";

interface ProjectSidebarProps {
  project: ProjectDetail;
  skills: { id: string; slug: string; name: string; category: string }[];
  links: [string, string][];
  openRoles: OpenRoleRow[];
  milestones: { length: number };
  contributors: { length: number };
  isOwner: boolean;
  isContributor: boolean;
  onOpenRoleApply?: (roleId: string) => void;
}

export function ProjectSidebar({
  project,
  skills,
  links,
  openRoles,
  milestones,
  contributors,
  isOwner,
  isContributor,
  onOpenRoleApply,
}: ProjectSidebarProps) {
  return (
    <aside className="sticky top-24 self-start space-y-4">
      {!isOwner && !isContributor && (
        <button className="w-full rounded-xl bg-[var(--user-accent,var(--trust))] px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90">
          Join this Project
        </button>
      )}

      <div className="rounded-2xl border border-border/60 bg-surface p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Stage
        </h4>
        <ProjectTimeline
          currentStage={(project.stage ?? "planning") as ProjectStage}
          isOwner={isOwner}
          variant="compact"
        />
      </div>

      {skills.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-surface p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Skills
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {skills.slice(0, 6).map((s) => (
              <Link
                key={s.id}
                to="/skills/$slug"
                params={{ slug: s.slug }}
                className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] text-primary transition hover:opacity-80"
              >
                {s.name}
              </Link>
            ))}
            {skills.length > 6 && (
              <span className="text-[11px] text-muted-foreground">+{skills.length - 6} more</span>
            )}
          </div>
        </div>
      )}

      {links.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-surface p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Links
          </h4>
          <div className="space-y-1.5">
            {links.map(([key, url]) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{key}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {openRoles.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-surface p-4">
          <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Briefcase className="h-3 w-3" /> Open Roles
          </h4>
          <div className="space-y-2">
            {openRoles.slice(0, 3).map((role) => (
              <div key={role.id} className="rounded-lg bg-background/40 p-2.5">
                <p className="text-xs font-medium">{role.title}</p>
                {role.description && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">
                    {role.description}
                  </p>
                )}
                <button
                  onClick={() => onOpenRoleApply?.(role.id)}
                  className="mt-1.5 text-[10px] font-medium text-primary hover:underline"
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-surface p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Project Info
        </h4>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>
              {milestones.length} milestone{milestones.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex justify-between">
            <span>
              {contributors.length} contributor{contributors.length !== 1 ? "s" : ""}
            </span>
          </div>
          {project.progress_percent > 0 && (
            <div className="flex justify-between">
              <span>{project.progress_percent}% complete</span>
            </div>
          )}
        </div>
      </div>

      {!isOwner && !isContributor && (
        <div className="sticky bottom-4 pt-2">
          <button className="w-full rounded-xl bg-[var(--user-accent,var(--trust))] px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90">
            Request to Join
          </button>
        </div>
      )}
    </aside>
  );
}
