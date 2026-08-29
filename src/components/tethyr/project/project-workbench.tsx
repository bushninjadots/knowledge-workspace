import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
  MessageCircle,
  Pencil,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useProjectWatchStatus, useToggleProjectWatch } from "@/hooks/use-project-loop";
import { getSeasonMeta } from "@/lib/project-seasons";
import type {
  GalleryItem,
  MilestoneRow,
  OpenRoleRow,
  ProjectDetail,
  ProjectNeedRow,
} from "@/hooks/use-projects";
import {
  getProjectPresentationOption,
  PROJECT_PRESENTATION_OPTIONS,
  type ProjectPresentationPreset,
} from "@/lib/project-presentation";

export type ProjectWorkbenchAction =
  | "demonstrations"
  | "readme"
  | "needs"
  | "milestones"
  | "update"
  | "people"
  | "discussions"
  | "join";

export function ProjectWorkbench({
  project,
  gallery,
  milestones,
  openRoles,
  needs,
  isOwner,
  isContributor,
  onAction,
  onPresentationChange,
  presentationSaveState = "idle",
  canWatch,
  onShapeDirection,
}: {
  project: ProjectDetail;
  gallery: GalleryItem[];
  milestones: MilestoneRow[];
  openRoles: OpenRoleRow[];
  needs: ProjectNeedRow[];
  isOwner: boolean;
  isContributor: boolean;
  onAction: (action: ProjectWorkbenchAction) => void;
  onPresentationChange?: (preset: ProjectPresentationPreset) => void;
  presentationSaveState?: "idle" | "saving" | "saved" | "error";
  canWatch?: boolean;
  onShapeDirection?: () => void;
}) {
  const openNeeds = needs.filter((need) => !need.is_filled).length;
  const openRolesCount = openRoles.filter((role) => !role.is_filled).length;
  const watchStatus = useProjectWatchStatus(project.id);
  const toggleWatch = useToggleProjectWatch();
  const seasonMeta = getSeasonMeta(project.season);
  const next = chooseNextAction({
    project,
    gallery,
    milestones,
    openNeeds,
    openRolesCount,
    isOwner,
    isContributor,
  });
  const actionSignals = getActionSignals({
    gallery,
    milestones,
    openNeeds,
    openRolesCount,
    isContributor,
  });

  const watch = () => {
    toggleWatch.mutate(
      { projectId: project.id, watching: !watchStatus.data },
      {
        onSuccess: () =>
          toast.success(
            watchStatus.data
              ? "Project removed from your return shelf"
              : "Project added to your return shelf",
          ),
        onError: () => toast.error("Couldn't update your project shelf"),
      },
    );
  };

  return (
    <section
      aria-labelledby="project-workbench-heading"
      className="sticky top-16 z-20 -mx-4 border-y border-[var(--user-accent-border,var(--border))] bg-background/95 px-4 py-3 sm:-mx-8 sm:px-8"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 shrink-0 text-[var(--user-accent,var(--primary))]" />
            <p id="project-workbench-heading" className="section-label">
              Project workbench
            </p>
            <span className="rounded-full border border-[var(--user-accent-border,var(--border-strong))] bg-[var(--user-accent-subtle,var(--surface-elevated))] px-2 py-0.5 text-[11px] font-medium text-foreground">
              {seasonMeta.label}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-medium">{next.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{next.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canWatch && (
            <button
              type="button"
              onClick={watch}
              disabled={toggleWatch.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-wait disabled:opacity-60"
            >
              {watchStatus.data ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              {watchStatus.data ? "Stop watching" : "Watch"}
            </button>
          )}
          {onShapeDirection && (
            <button
              type="button"
              onClick={onShapeDirection}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
              Shape direction
            </button>
          )}
          <button
            type="button"
            onClick={() => onAction(next.action)}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-[var(--user-accent,var(--primary))] px-3 py-2 text-xs font-semibold text-[var(--user-accent-foreground,var(--background))] transition hover:opacity-90"
          >
            {next.cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {isOwner && onPresentationChange && (
          <label className="inline-flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
            <span>Presentation</span>
            <select
              aria-label="Project presentation preset"
              value={getProjectPresentationOption(project.presentation_preset).id}
              onChange={(event) =>
                onPresentationChange(event.target.value as ProjectPresentationPreset)
              }
              disabled={presentationSaveState === "saving"}
              className="max-w-40 rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs text-foreground outline-none transition focus:border-[var(--user-accent-border,var(--border-strong))] disabled:cursor-wait disabled:opacity-60"
            >
              {PROJECT_PRESENTATION_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <span
              role="status"
              aria-live="polite"
              className={
                presentationSaveState === "error"
                  ? "text-destructive"
                  : presentationSaveState === "saved"
                    ? "text-brand-green"
                    : "text-muted-foreground"
              }
            >
              {presentationSaveState === "saving"
                ? "Saving…"
                : presentationSaveState === "saved"
                  ? "Saved"
                  : presentationSaveState === "error"
                    ? "Couldn't save"
                    : null}
            </span>
          </label>
        )}
      </div>
      <div
        className="mx-auto mt-3 flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground"
        aria-label="Project loop status"
      >
        {actionSignals.map((signal) => (
          <WorkbenchSignal key={signal.label} icon={signal.icon} label={signal.label} />
        ))}
      </div>
    </section>
  );
}

function WorkbenchSignal({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

type ActionSignal = { icon: LucideIcon; label: string };

export function getActionSignals({
  gallery,
  milestones,
  openNeeds,
  openRolesCount,
  isContributor,
}: {
  gallery: GalleryItem[];
  milestones: MilestoneRow[];
  openNeeds: number;
  openRolesCount: number;
  isContributor: boolean;
}): ActionSignal[] {
  const currentMilestone =
    milestones.find((milestone) => milestone.status === "in_progress") ??
    milestones.find((milestone) => milestone.status === "pending");

  return [
    {
      icon: currentMilestone ? CheckCircle2 : Zap,
      label: currentMilestone ? `Next: ${currentMilestone.title}` : "No next milestone",
    },
    {
      icon: openNeeds > 0 ? Zap : CheckCircle2,
      label:
        openNeeds > 0 ? `${openNeeds} open need${openNeeds === 1 ? "" : "s"}` : "No open needs",
    },
    {
      icon: openRolesCount > 0 ? Users : CheckCircle2,
      label:
        openRolesCount > 0
          ? `${openRolesCount} open role${openRolesCount === 1 ? "" : "s"}`
          : "People in place",
    },
    {
      icon: gallery.length > 0 ? ImagePlus : Eye,
      label:
        gallery.length > 0
          ? `${gallery.length} demonstration${gallery.length === 1 ? "" : "s"}`
          : "No demonstrations yet",
    },
    {
      icon: MessageCircle,
      label: isContributor ? "You can add evidence" : "Follow the conversation",
    },
  ];
}

export function chooseNextAction({
  project,
  gallery,
  milestones,
  openNeeds,
  openRolesCount,
  isOwner,
  isContributor,
}: {
  project: ProjectDetail;
  gallery: GalleryItem[];
  milestones: MilestoneRow[];
  openNeeds: number;
  openRolesCount: number;
  isOwner: boolean;
  isContributor: boolean;
}): { action: ProjectWorkbenchAction; title: string; description: string; cta: string } {
  if (isOwner && gallery.length === 0) {
    return {
      action: "demonstrations",
      title: "Give people something real to see",
      description:
        "Add an image, GIF, or video demonstration to make the project legible at a glance.",
      cta: "Add demonstration",
    };
  }
  if (isOwner && !project.readme?.trim()) {
    return {
      action: "readme",
      title: "Explain what you are building",
      description:
        "A short README gives collaborators the context they need before they reach out.",
      cta: "Write README",
    };
  }
  if (isOwner && openNeeds > 0) {
    return {
      action: "needs",
      title: "Make the next contribution obvious",
      description: `${openNeeds} open need${openNeeds === 1 ? "" : "s"} can help the right person find this project.`,
      cta: "Review needs",
    };
  }
  if (isOwner && milestones.length === 0) {
    return {
      action: "milestones",
      title: "Give the work a visible next step",
      description: "A first milestone turns an idea into a shared direction.",
      cta: "Add milestone",
    };
  }
  if (isContributor) {
    return {
      action: "update",
      title: "Leave evidence of the work",
      description: "Share what changed so people can follow the project’s momentum.",
      cta: "Post update",
    };
  }
  if (openRolesCount > 0) {
    return {
      action: "join",
      title: "Find where you could help",
      description: `${openRolesCount} open role${openRolesCount === 1 ? "" : "s"} connect this project to new collaborators.`,
      cta: "Apply for a role",
    };
  }
  if (project.looking_for_feedback) {
    return {
      action: "discussions",
      title: "Help shape the direction",
      description: "The builder is looking for feedback on this work.",
      cta: "Offer feedback",
    };
  }
  return {
    action: "people",
    title: "Meet the people behind the work",
    description: "See who is contributing and where a useful conversation could begin.",
    cta: "Open people",
  };
}
