// ── Profile Projects Block ────────────────────────────────────────────────────
// Shows projects the person contributed to, with role, status, and progress.
// Role verbs say whether they BUILT it or CONTRIBUTED to it, and each card
// carries the avatar cluster of the people they collaborated with.

import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { registerBlock } from "@/lib/block-registry";
import {
  getProfileProjectPresentation,
  PROFILE_PROJECT_PRESENTATIONS,
} from "@/components/tethyr/studio/project-presentation";
import type { BlockProps } from "@/lib/page-blocks";

type ProjectRow = {
  project_id: string;
  role: string;
  projects: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    progress_percent: number;
    cover_url: string | null;
  } | null;
};

/** A fellow contributor on one of the profile-owner's projects. */
type CollaboratorRow = {
  profile_id: string;
  profile: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  } | null;
};

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

/** Role verbs make the owner's part clear: built it, or contributed to it. */
const ROLE_VERB: Record<string, string> = {
  creator: "Built",
  mentor: "Mentored",
  contributor: "Contributed to",
};

const CARD_CLS =
  "flex h-fit flex-col rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-elevated";

function ProfileProjectsBlock({ context, config }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["profile-projects-block", profileId],
    queryFn: async () => {
      if (!profileId) return { rows: [], collaborators: new Map<string, CollaboratorRow[]>() };
      const { data: memberships } = await supabase
        .from("project_contributors")
        .select(
          "project_id, role, projects(id, title, description, status, progress_percent, cover_url)",
        )
        .eq("profile_id", profileId)
        .limit(6);
      const rows = (memberships ?? []) as unknown as ProjectRow[];
      const projectIds = rows.map((r) => r.project_id).filter(Boolean);
      const collaborators = new Map<string, CollaboratorRow[]>();
      if (projectIds.length > 0) {
        const { data: crew } = await supabase
          .from("project_contributors")
          .select("project_id, profile_id, profile:profiles(display_name, handle, avatar_url)")
          .in("project_id", projectIds)
          .neq("profile_id", profileId);
        for (const row of (crew ?? []) as unknown as Array<{
          project_id: string;
          profile_id: string;
          profile: CollaboratorRow["profile"];
        }>) {
          const list = collaborators.get(row.project_id) ?? [];
          if (!list.some((c) => c.profile_id === row.profile_id)) {
            list.push({ profile_id: row.profile_id, profile: row.profile });
          }
          collaborators.set(row.project_id, list);
        }
      }
      return { rows, collaborators };
    },
    enabled: !!profileId,
  });

  const projects = (data?.rows ?? [])
    .map((row) => ({ project: row.projects, role: row.role }))
    .filter(
      (row): row is { project: NonNullable<ProjectRow["projects"]>; role: string } =>
        row.project !== null,
    );
  useEffect(() => {
    if (isLoading || isEditing || !blockId) return;
    onBlockEmptyChange?.(blockId, projects.length === 0);
  }, [blockId, isEditing, isLoading, onBlockEmptyChange, projects.length]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data || projects.length === 0) {
    if (context.isEditing) {
      return (
        <BlockEmptyState
          label="Projects"
          detail="Show the work you are building with other people."
          actionLabel="Add your first project"
          onAction={context.onAddProject}
        />
      );
    }
    return null;
  }

  const collaborators = data.collaborators;
  const showStatus = config.showStatus !== false;
  const showProgress = config.showProgress !== false;
  const presentation = getProfileProjectPresentation(config.presentation);
  const heading = <h3 className="mb-3 text-sm font-medium text-foreground">Projects</h3>;

  const ProjectImage = ({
    project,
  }: {
    project: { id: string; cover_url: string | null; title: string };
  }) => {
    const { data: signedUrl } = useSignedStorageUrl("project-media", project.cover_url);
    const src = signedUrl ?? (project.cover_url?.startsWith("http") ? project.cover_url : null);
    return src ? (
      <img
        src={src}
        alt={`${project.title} cover`}
        className="mb-2 aspect-[16/9] w-full rounded-md object-cover"
        loading="lazy"
        decoding="async"
      />
    ) : null;
  };
  const body = (
    project: {
      title: string;
      description: string | null;
      status: string;
      progress_percent: number;
    },
    role: string,
  ) => (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-foreground line-clamp-1">{project.title}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {ROLE_VERB[role] ?? role}
        </span>
      </div>
      {project.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
      )}
      <div className="mt-2 flex items-center gap-2">
        {showStatus && (
          <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] text-muted-foreground">
            {STATUS_LABEL[project.status] ?? project.status}
          </span>
        )}
        {showProgress && project.progress_percent > 0 && (
          <Progress value={project.progress_percent} className="h-1 flex-1" />
        )}
      </div>
    </>
  );

  if (presentation.id === "minimal-list") {
    return (
      <div>
        {heading}
        <div className="divide-y divide-border rounded-lg border border-border">
          {projects.map(({ project, role }) => (
            <ProjectRowLink
              key={project.id}
              id={project.id}
              label={project.title}
              showProgress={showProgress}
              progress={project.progress_percent}
            >
              <p className="truncate text-sm font-medium text-foreground">{project.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {ROLE_VERB[role] ?? role}
                {showStatus && project.status ? (
                  <span className="ml-2 text-muted-foreground/70">
                    {STATUS_LABEL[project.status] ?? project.status}
                  </span>
                ) : null}
              </p>
              <CollaboratorRowInline
                people={collaborators.get(project.id) ?? []}
                className="relative z-10 mt-1.5"
              />
            </ProjectRowLink>
          ))}
        </div>
      </div>
    );
  }

  if (presentation.id === "horizontal-scroll") {
    return (
      <div>
        {heading}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {projects.map(({ project, role }) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              label={project.title}
              className="min-w-[240px] shrink-0 sm:min-w-[280px]"
            >
              <ProjectImage project={project} />
              {body(project, role)}
              <CollaboratorRowInline
                people={collaborators.get(project.id) ?? []}
                className="relative z-10 mt-2"
              />
            </ProjectCard>
          ))}
        </div>
      </div>
    );
  }

  const [featured, ...rest] = projects;

  if (presentation.id === "editorial-grid") {
    return (
      <div>
        {heading}
        <div className="grid items-start gap-3 md:grid-cols-3">
          {featured && (
            <ProjectCard
              key={featured.project.id}
              id={featured.project.id}
              label={featured.project.title}
              className="md:col-span-2 md:row-span-2"
            >
              <ProjectImage project={featured.project} />
              {body(featured.project, featured.role)}
              <CollaboratorRowInline
                people={collaborators.get(featured.project.id) ?? []}
                className="relative z-10 mt-2"
              />
            </ProjectCard>
          )}
          {rest.map(({ project, role }) => (
            <ProjectCard key={project.id} id={project.id} label={project.title}>
              <ProjectImage project={project} />
              {body(project, role)}
              <CollaboratorRowInline
                people={collaborators.get(project.id) ?? []}
                className="relative z-10 mt-2"
              />
            </ProjectCard>
          ))}
        </div>
      </div>
    );
  }

  // spotlight
  return (
    <div>
      {heading}
      <div className="flex flex-col gap-3">
        {featured && (
          <ProjectCard
            key={featured.project.id}
            id={featured.project.id}
            label={featured.project.title}
            className="sm:px-4 sm:py-4"
          >
            {featured.project.cover_url ? <ProjectImage project={featured.project} /> : null}
            <span className="mb-1 text-[11px] text-muted-foreground">
              {ROLE_VERB[featured.role] ?? featured.role}
            </span>
            <div className="flex items-start justify-between gap-2">
              <span className="text-base font-semibold text-foreground line-clamp-1">
                {featured.project.title}
              </span>
            </div>
            {featured.project.description && (
              <p className="mt-1 text-xs text-muted-foreground">{featured.project.description}</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              {showStatus && (
                <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] text-muted-foreground">
                  {STATUS_LABEL[featured.project.status] ?? featured.project.status}
                </span>
              )}
              {showProgress && featured.project.progress_percent > 0 && (
                <Progress value={featured.project.progress_percent} className="h-1 flex-1" />
              )}
            </div>
            <CollaboratorRowInline
              people={collaborators.get(featured.project.id) ?? []}
              className="relative z-10 mt-2"
            />
          </ProjectCard>
        )}
        {rest.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {rest.map(({ project, role }) => (
              <ProjectCard key={project.id} id={project.id} label={project.title}>
                <ProjectImage project={project} />
                {body(project, role)}
                <CollaboratorRowInline
                  people={collaborators.get(project.id) ?? []}
                  className="relative z-10 mt-2"
                />
              </ProjectCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Whole-card link that shares the card with the collaborator avatars.
 * The card is a positioned surface; the link is stretched invisibly beneath
 * the flow content, so the card is one tap target while the avatar cluster
 * (sibling, above it) remains its own link set.
 */
function ProjectCard({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`${CARD_CLS} group relative ${className ?? ""}`}>
      <Link
        to="/projects/$id"
        params={{ id }}
        aria-label={label}
        className="absolute inset-0 z-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {children}
    </div>
  );
}

/** Row strip for the minimal-list presentation. */
function ProjectRowLink({
  id,
  label,
  showProgress,
  progress,
  children,
}: {
  id: string;
  label: string;
  showProgress?: boolean | null;
  progress: number;
  children?: ReactNode;
}) {
  return (
    <div className="group relative px-3 py-2.5 transition-colors hover:bg-surface">
      <Link
        to="/projects/$id"
        params={{ id }}
        aria-label={label}
        className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">{children}</div>
        {showProgress && progress > 0 && <Progress value={progress} className="h-1 w-24" />}
      </div>
    </div>
  );
}

/** Overlapping avatar cluster + "with N people" label. Links each avatar to its Studio. */
function CollaboratorRowInline({
  people,
  className,
}: {
  people: CollaboratorRow[];
  className?: string;
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, 4);
  const extra = people.length - shown.length;
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <span className="flex -space-x-1.5">
        {shown.map((c) => (
          <CollaboratorAvatar key={c.profile_id} row={c} />
        ))}
        {extra > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-sunken text-[9px] text-muted-foreground ring-2 ring-surface">
            +{extra}
          </span>
        )}
      </span>
      <span className="text-[10px] text-muted-foreground">
        with {people.length} {people.length === 1 ? "collaborator" : "collaborators"}
      </span>
    </div>
  );
}

function CollaboratorAvatar({ row }: { row: CollaboratorRow }) {
  const { data: avatarSigned } = useSignedStorageUrl("avatars", row.profile?.avatar_url ?? null);
  const initial = (row.profile?.display_name ?? row.profile?.handle ?? "?").charAt(0).toUpperCase();
  const fullName = row.profile?.display_name ?? row.profile?.handle ?? "Collaborator";
  if (row.profile?.handle) {
    return (
      <Link
        to="/u/$handle"
        params={{ handle: row.profile.handle }}
        title={fullName}
        className="block h-5 w-5 shrink-0 rounded-full ring-2 ring-surface transition-transform hover:scale-110"
      >
        {avatarSigned ? (
          <img src={avatarSigned} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded-full bg-foreground/10 text-[9px] font-semibold text-foreground">
            {initial}
          </span>
        )}
      </Link>
    );
  }
  return (
    <span className="block h-5 w-5 shrink-0 rounded-full ring-2 ring-surface" title={fullName}>
      {avatarSigned ? (
        <img src={avatarSigned} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-foreground/10 text-[9px] font-semibold text-foreground">
          {initial}
        </span>
      )}
    </span>
  );
}

registerBlock({
  type: "profile-projects",
  category: "people",
  label: "Featured Projects",
  description: "Projects the person has contributed to, with role and status.",
  icon: "Folder",
  defaults: { presentation: "spotlight", showStatus: true, showProgress: true },
  fields: [
    {
      key: "presentation",
      label: "Presentation",
      type: "select",
      options: PROFILE_PROJECT_PRESENTATIONS.map((p) => ({ value: p.id, label: p.label })),
    },
    { key: "showStatus", label: "Show project status", type: "toggle" },
    { key: "showProgress", label: "Show progress bars", type: "toggle" },
  ],
  component: ProfileProjectsBlock,
});

export { ProfileProjectsBlock };
