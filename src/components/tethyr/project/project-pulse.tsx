import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { GitBranch, Save, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type CollaborationBrief,
  type GalleryItem,
  type MilestoneRow,
  type ProjectDetail,
  type ProjectLineage,
  type ProjectSeason,
} from "@/hooks/use-projects";
import { useUpdateProjectDirection } from "@/hooks/use-project-loop";
import { SEASONS, getSeasonMeta } from "@/lib/project-seasons";
import { ProjectLinkPicker } from "./project-link-picker";

export function ProjectPulse({
  project,
  isOwner,
  editing,
  onEditingChange,
  gallery = [],
  milestones = [],
  openNeedCount = 0,
}: {
  project: ProjectDetail;
  isOwner: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  gallery?: GalleryItem[];
  milestones?: MilestoneRow[];
  openNeedCount?: number;
}) {
  const [season, setSeason] = useState<ProjectSeason>(project.season ?? "building");
  const [brief, setBrief] = useState<CollaborationBrief>(project.collaboration_brief ?? {});
  const [lineage, setLineage] = useState<ProjectLineage>(project.lineage ?? {});
  const update = useUpdateProjectDirection();

  useEffect(() => {
    if (!editing) {
      setSeason(project.season ?? "building");
      setBrief(project.collaboration_brief ?? {});
      setLineage(project.lineage ?? {});
    }
  }, [editing, project.season, project.collaboration_brief, project.lineage]);

  const save = async () => {
    try {
      await update.mutateAsync({
        projectId: project.id,
        season,
        brief: {
          need: brief.need?.trim() || null,
          why_now: brief.why_now?.trim() || null,
          contribution_shape: brief.contribution_shape?.trim() || null,
          time_shape: brief.time_shape?.trim() || null,
        },
        lineage: {
          previous_project_id: lineage.previous_project_id?.trim() || null,
          next_project_id: lineage.next_project_id?.trim() || null,
          label: lineage.label?.trim() || null,
        },
      });
      onEditingChange(false);
      toast.success("Project direction saved");
    } catch {
      toast.error("Couldn't save project direction");
    }
  };

  const seasonMeta = getSeasonMeta(project.season);
  const currentMilestone =
    milestones.find((milestone) => milestone.status === "in_progress") ??
    milestones.find((milestone) => milestone.status === "pending");
  const latestDemo = gallery[0];
  const hasBrief = Object.values(project.collaboration_brief ?? {}).some((value) => !!value);
  const hasLineage = !!project.lineage?.previous_project_id || !!project.lineage?.next_project_id;

  // Lean projects with no direction content keep the page uncluttered: the
  // watch control lives in the workbench, and this band only renders when
  // there is a brief, lineage, or the owner is actively shaping direction.
  if (!editing && !hasBrief && !hasLineage) return null;

  return (
    <section
      aria-labelledby="project-pulse-heading"
      className="mx-auto mt-4 max-w-7xl border-y border-border/60 bg-surface/30 px-4 py-4 sm:px-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p id="project-pulse-heading" className="section-label">
              Project pulse
            </p>
            <span className="rounded-full border border-[var(--user-accent-border,var(--border-strong))] bg-[var(--user-accent-subtle,var(--surface-elevated))] px-2 py-0.5 text-[11px] font-medium text-foreground">
              {seasonMeta?.label ?? "Building"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {seasonMeta?.description ?? "Steady progress on the next version."}
          </p>
        </div>
      </div>

      {!editing && (
        <div className="mt-4 grid gap-3 border-t border-border/50 pt-4 sm:grid-cols-3">
          <PulseSignal
            label="Latest demonstration"
            value={
              latestDemo?.caption || (latestDemo ? "Available to explore" : "Nothing shared yet")
            }
          />
          <PulseSignal
            label="Current milestone"
            value={currentMilestone?.title ?? "No active milestone yet"}
          />
          <PulseSignal
            label="Open contribution"
            value={
              openNeedCount > 0
                ? `${openNeedCount} ask${openNeedCount === 1 ? "" : "s"} from the project`
                : "No open ask right now"
            }
          />
        </div>
      )}

      {editing && isOwner ? (
        <div className="mt-4 space-y-4 border-t border-border/50 pt-4">
          <div>
            <p className="text-xs font-medium text-foreground">Current season</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SEASONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={season === item.id}
                  onClick={() => setSeason(item.id)}
                  className={`rounded-md border px-3 py-1.5 text-xs transition ${season === item.id ? "border-[var(--user-accent,var(--primary))] bg-[var(--user-accent-subtle,var(--surface-elevated))] text-foreground" : "border-border/60 text-muted-foreground hover:text-foreground"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={brief.need ?? ""}
              onChange={(event) => setBrief({ ...brief, need: event.target.value })}
              placeholder="What contribution would help?"
              aria-label="Collaboration need"
            />
            <Input
              value={brief.time_shape ?? ""}
              onChange={(event) => setBrief({ ...brief, time_shape: event.target.value })}
              placeholder="Time shape, e.g. a few hours"
              aria-label="Contribution time shape"
            />
            <Textarea
              value={brief.why_now ?? ""}
              onChange={(event) => setBrief({ ...brief, why_now: event.target.value })}
              placeholder="Why is this useful now?"
              aria-label="Why contribution is needed now"
              rows={2}
            />
            <Textarea
              value={brief.contribution_shape ?? ""}
              onChange={(event) => setBrief({ ...brief, contribution_shape: event.target.value })}
              placeholder="What would someone actually do?"
              aria-label="Contribution shape"
              rows={2}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ProjectLinkPicker
              value={lineage.previous_project_id}
              onChange={(id) => setLineage({ ...lineage, previous_project_id: id })}
              placeholder="Previous project (optional)"
              ariaLabel="Previous project"
              excludeProjectId={project.id}
              ownerId={project.profile_id}
            />
            <ProjectLinkPicker
              value={lineage.next_project_id}
              onChange={(id) => setLineage({ ...lineage, next_project_id: id })}
              placeholder="Next project (optional)"
              ariaLabel="Next project"
              excludeProjectId={project.id}
              ownerId={project.profile_id}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onEditingChange(false)}
              className="gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={update.isPending}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {update.isPending ? "Saving…" : "Save direction"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-[1.2fr_1fr]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              Contribution brief
            </div>
            {hasBrief ? (
              <dl className="mt-2 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                {project.collaboration_brief?.need && (
                  <BriefLine label="Need" value={project.collaboration_brief.need} />
                )}
                {project.collaboration_brief?.why_now && (
                  <BriefLine label="Why now" value={project.collaboration_brief.why_now} />
                )}
                {project.collaboration_brief?.contribution_shape && (
                  <BriefLine
                    label="Contribution"
                    value={project.collaboration_brief.contribution_shape}
                  />
                )}
                {project.collaboration_brief?.time_shape && (
                  <BriefLine label="Time" value={project.collaboration_brief.time_shape} />
                )}
              </dl>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                The next useful contribution will appear here.
              </p>
            )}
          </div>
          {hasLineage && (
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                Project lineage
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {project.lineage?.previous_project_id && (
                  <Link
                    to="/projects/$id"
                    params={{ id: project.lineage.previous_project_id }}
                    className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    ← Previous project
                  </Link>
                )}
                {project.lineage?.next_project_id && (
                  <Link
                    to="/projects/$id"
                    params={{ id: project.lineage.next_project_id }}
                    className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Next project →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PulseSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-xs font-medium text-foreground/85">{value}</p>
    </div>
  );
}

function BriefLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-foreground/85">{value}</dd>
    </div>
  );
}
