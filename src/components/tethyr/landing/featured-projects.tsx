import { Link } from "@tanstack/react-router";
import { ArrowRight, FolderKanban } from "lucide-react";
import { STATUS_STYLES } from "../project-shelf/project-shelf-cover";
import { useFeaturedProjects } from "./data";

export function FeaturedProjects() {
  const { data: projects = [], isLoading } = useFeaturedProjects();
  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-xl border border-border/60 bg-surface"
            />
          ))}
        </div>
      </section>
    );
  }
  if (projects.length === 0) return null;

  return (
    <section className="border-y border-border/60 bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="section-label mb-3">Featured projects</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              What the community is building
            </h2>
          </div>
          <Link
            to="/explore"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary"
          >
            Explore projects <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const status = STATUS_STYLES[p.status] ?? STATUS_STYLES.active;
            return (
              <Link
                key={p.id}
                to="/projects/$id"
                params={{ id: p.id }}
                className="group flex flex-col overflow-hidden rounded-xl bg-surface-elevated/30 transition hover:bg-surface-elevated/50"
              >
                <div className="relative h-36 overflow-hidden bg-surface-sunken">
                  {p.cover_url ? (
                    <img
                      src={p.cover_url}
                      alt=""
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
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="truncate font-display text-base font-semibold group-hover:text-primary">
                    {p.title}
                  </h3>
                  {p.description && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  {p.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-border/60 bg-surface-elevated px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <span className="text-xs text-muted-foreground">
                      {p.profiles?.display_name || p.profiles?.handle || "Member"}
                    </span>
                    <span className="numeric text-xs text-muted-foreground">
                      {p.progress_percent ?? 0}% complete
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
