import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";
import { canonicalProjectStatus } from "@/lib/project-status";
import { useFeaturedProjects } from "./data";

/** A cover thumbnail only when the project has one — no placeholder art, so
 *  projects without covers read as clean typographic rows. */
function CoverThumb({ path }: { path: string | null }) {
  const { data: url } = useSignedStorageUrl("project-media", path);
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      width="96"
      height="64"
      loading="lazy"
      decoding="async"
      className="hidden h-12 w-[4.5rem] shrink-0 rounded-md object-cover sm:block"
    />
  );
}

export function FeaturedProjects() {
  const { data: projects = [], isLoading } = useFeaturedProjects();
  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" aria-hidden="true">
        <div className="space-y-px">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-gentle-pulse bg-surface" />
          ))}
        </div>
      </section>
    );
  }
  // The first project is the hero's work record; list the rest.
  const rest = projects.slice(1);
  if (rest.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" aria-labelledby="work-index-title">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="section-label mb-3">In progress</p>
          <h2
            id="work-index-title"
            className="font-display text-3xl font-semibold tracking-tight sm:text-4xl"
          >
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
      <ul className="border-t border-border/60">
        {rest.map((p) => {
          const progress = p.progress_percent ?? 0;
          const stage = canonicalProjectStatus(p.status, p.stage);
          return (
            <li key={p.id} className="border-b border-border/60">
              <Link
                to="/projects/$id"
                params={{ id: p.id }}
                className="group grid gap-x-6 gap-y-2 py-5 transition-colors hover:bg-surface/60 sm:grid-cols-[minmax(0,1fr)_7rem_9rem_8rem] sm:items-center sm:px-3"
              >
                <span className="flex min-w-0 items-center gap-4">
                  <CoverThumb path={p.cover_url} />
                  <span className="min-w-0">
                    <span className="block truncate font-display text-lg font-semibold group-hover:text-[var(--user-accent,var(--primary))]">
                      {p.title}
                    </span>
                    {p.description ? (
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {p.description}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  {stage ?? "Active"}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {p.profiles?.display_name || p.profiles?.handle || "Member"}
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className="h-1 flex-1 overflow-hidden rounded-full bg-border"
                    role="progressbar"
                    aria-label={`${p.title}: ${progress}% complete`}
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span
                      className="block h-full rounded-full bg-[var(--user-accent,var(--trust))]"
                      style={{ width: `${progress}%` }}
                    />
                  </span>
                  <span className="numeric w-9 shrink-0 text-right text-xs text-muted-foreground">
                    {progress}%
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
