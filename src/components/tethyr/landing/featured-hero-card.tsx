import { Link } from "@tanstack/react-router";
import { Clock, FolderKanban, Star, Users } from "lucide-react";
import { STATUS_STYLES } from "../project-shelf/project-shelf-cover";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { useContributorCount, useFeaturedProjects } from "./data";

export function FeaturedHeroCard() {
  const { data: projects, isLoading } = useFeaturedProjects();
  // Show a genuinely featured project when one exists, otherwise the newest one
  // (labeled accordingly — never a misleading "Featured" badge).
  const featuredProject = projects?.find((p) => p.is_featured) ?? null;
  const latestProject = featuredProject ? null : (projects?.[0] ?? null);
  const project = featuredProject ?? latestProject;
  const isFeatured = featuredProject != null;
  const { data: contributorCount } = useContributorCount(project?.id);
  // Signed client-side (raw path in query data) so SSR and hydration match.
  const { data: coverUrl } = useSignedStorageUrl("project-media", project?.cover_url);

  if (isLoading) {
    return (
      <div className="animate-pulse overflow-hidden rounded-xl bg-surface-elevated/30">
        <div className="h-36 bg-surface-sunken" />
        <div className="space-y-3 p-5">
          <div className="h-3 w-28 rounded bg-surface-elevated" />
          <div className="h-4 w-3/4 rounded bg-surface-elevated" />
          <div className="h-3 w-full rounded bg-surface-elevated" />
        </div>
      </div>
    );
  }
  if (!project) return null;

  const status = STATUS_STYLES[project.status] ?? STATUS_STYLES.active;
  const authorName = project.profiles?.display_name || project.profiles?.handle || "Member";
  const progress = project.progress_percent ?? 0;

  return (
    <Link
      to="/projects/$id"
      params={{ id: project.id }}
      className="group overflow-hidden rounded-xl bg-surface-elevated/30 backdrop-blur-sm transition-lift hover:bg-surface-elevated/50"
    >
      <div className="relative h-36 overflow-hidden bg-surface-sunken">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            decoding="async"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FolderKanban className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm">
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {isFeatured ? (
            <>
              <Star className="h-3 w-3 text-primary" /> Featured project
            </>
          ) : (
            <>
              <Clock className="h-3 w-3 text-primary" /> Latest project
            </>
          )}
        </div>
        <h3 className="mt-2 truncate font-display text-lg font-semibold group-hover:text-primary">
          {project.title}
        </h3>
        {project.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">by {authorName}</p>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> {contributorCount ?? "–"} contributors
            </span>
            <span className="numeric">{progress}% complete</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary/80" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </Link>
  );
}
