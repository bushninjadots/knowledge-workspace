// ── Profile Projects Block ────────────────────────────────────────────────────
// Shows projects the person contributed to, with role, status, and progress.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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

const ROLE_LABEL: Record<string, string> = {
  creator: "Creator",
  mentor: "Mentor",
  contributor: "Contributor",
};
const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

function ProfileProjectsBlock({ context, config }: BlockProps) {
  const profileId = context.ownerType === "profile" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["profile-projects-block", profileId],
    queryFn: async (): Promise<ProjectRow[]> => {
      if (!profileId) return [];
      const { data } = await supabase
        .from("project_contributors")
        .select(
          "project_id, role, projects(id, title, description, status, progress_percent, cover_url)",
        )
        .eq("profile_id", profileId)
        .limit(6);
      return (data ?? []) as unknown as ProjectRow[];
    },
    enabled: !!profileId,
  });

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

  if (!data || data.length === 0) {
    if (context.isEditing) {
      return (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 px-4 py-3 text-xs text-muted-foreground">
          Projects block — contributed projects will appear here.
        </div>
      );
    }
    return null;
  }

  const showStatus = config.showStatus !== false;
  const showProgress = config.showProgress !== false;
  const presentation = getProfileProjectPresentation(config.presentation);
  const projects = data
    .map((row) => ({ project: row.projects, role: row.role }))
    .filter(
      (row): row is { project: NonNullable<ProjectRow["projects"]>; role: string } =>
        row.project !== null,
    );

  const heading = <h3 className="mb-3 text-sm font-medium text-foreground">Projects</h3>;

  if (presentation.id === "minimal-list") {
    return (
      <div>
        {heading}
        <div className="divide-y divide-border rounded-lg border border-border">
          {projects.map(({ project, role }) => (
            <Link
              key={project.id}
              to="/projects/$id"
              params={{ id: project.id }}
              className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-surface"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{project.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {ROLE_LABEL[role] ?? role}
                  {showStatus && project.status ? (
                    <span className="ml-2 text-muted-foreground/70">
                      {STATUS_LABEL[project.status] ?? project.status}
                    </span>
                  ) : null}
                </p>
              </div>
              {showProgress && project.progress_percent > 0 && (
                <Progress value={project.progress_percent} className="h-1 w-24" />
              )}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const cardCls =
    "group flex h-fit flex-col rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-elevated";
  const ProjectImage = ({ project }: { project: { id: string; cover_url: string | null; title: string } }) => {
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
          {ROLE_LABEL[role] ?? role}
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

  if (presentation.id === "horizontal-scroll") {
    return (
      <div>
        {heading}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {projects.map(({ project, role }) => (
            <Link
              key={project.id}
              to="/projects/$id"
              params={{ id: project.id }}
              className="min-w-[240px] shrink-0 rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-elevated sm:min-w-[280px]"
            >
              <ProjectImage project={project} />
              {body(project, role)}
            </Link>
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
            <Link
              key={featured.project.id}
              to="/projects/$id"
              params={{ id: featured.project.id }}
              className={`${cardCls} md:col-span-2 md:row-span-2`}
            >
              <ProjectImage project={featured.project} />
              {body(featured.project, featured.role)}
            </Link>
          )}
          {rest.map(({ project, role }) => (
            <Link
              key={project.id}
              to="/projects/$id"
              params={{ id: project.id }}
              className={cardCls}
            >
              <ProjectImage project={project} />
              {body(project, role)}
            </Link>
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
          <Link
            key={featured.project.id}
            to="/projects/$id"
            params={{ id: featured.project.id }}
            className={`${cardCls} sm:px-4 sm:py-4`}
          >
            {featured.project.cover_url ? <ProjectImage project={featured.project} /> : null}
            <span className="mb-1 text-[11px] text-muted-foreground">
              {ROLE_LABEL[featured.role] ?? featured.role}
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
          </Link>
        )}
        {rest.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {rest.map(({ project, role }) => (
              <Link
                key={project.id}
                to="/projects/$id"
                params={{ id: project.id }}
                className={cardCls}
              >
                <ProjectImage project={project} />
                {body(project, role)}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
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
