import { Link } from "@tanstack/react-router";
import { CheckCircle2, Compass } from "lucide-react";
import { useRelatedProjects } from "@/hooks/use-related-projects";
import type { RelatedProject } from "@/hooks/use-related-projects";

type RelatedProjectsSectionProps = {
  project: { id: string; tags: string[]; profile_id: string };
  skills: { id: string }[];
  contributors: { profile_id: string }[];
};

/**
 * "Related projects" — discovery surface at the bottom of the project page.
 * Dense rows (the F13 roster pattern, not cards) showing shared tags, shared
 * skills and shared contributors as the basis for the recommendation. Renders
 * nothing when there are no signals or no overlap.
 */
export function RelatedProjectsSection({
  project,
  skills,
  contributors,
}: RelatedProjectsSectionProps) {
  const hasSignals = project.tags.length > 0 || skills.length > 0 || contributors.length > 0;

  const { data, isPending } = useRelatedProjects({
    projectId: project.id,
    tags: project.tags,
    skillIds: skills.map((s) => s.id),
    contributorIds: contributors.map((c) => c.profile_id),
  });

  // No signals to match against — the query is disabled and there's nothing to
  // show (rendering a skeleton forever would be worse than not rendering).
  if (!hasSignals) return null;

  if (!isPending && (!data || data.length === 0)) return null;

  return (
    <section aria-labelledby="project-related-heading" className="content-safe mt-5">
      <div className="flex items-baseline gap-2">
        <Compass className="mb-1 h-4 w-4 self-end text-muted-foreground" aria-hidden="true" />
        <h2
          id="project-related-heading"
          className="font-display text-[15px] font-semibold tracking-tight"
        >
          More to explore
        </h2>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground-subtle">
          Similar work, shared skills
        </span>
      </div>

      {isPending ? (
        <ul className="mt-4 divide-y divide-border/50 rounded-xl border border-border/40 bg-background/40">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-3">
              <span className="h-8 w-8 shrink-0 rounded-full bg-foreground/10" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <span className="block h-3 w-2/5 animate-gentle-pulse rounded bg-foreground/10" />
                <span className="block h-3 w-3/5 animate-gentle-pulse rounded bg-foreground/[0.06]" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-4 divide-y divide-border/50 rounded-xl border border-border/40 bg-background/40">
          {data?.map((item) => (
            <RelatedRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RelatedRow({ item }: { item: RelatedProject }) {
  return (
    <li>
      <Link
        to="/projects/$id"
        params={{ id: item.id }}
        className="group flex items-center gap-3 px-3 py-2.5 transition hover:bg-surface-elevated/40"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-semibold text-background"
        >
          {(item.title ?? "?").charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground transition group-hover:text-[var(--user-accent,var(--foreground))]">
            {item.title}
          </p>
          {item.description && (
            <p className="truncate text-[12px] text-muted-foreground">{item.description}</p>
          )}
        </div>
        <div className="hidden shrink-0 flex-wrap items-center justify-end gap-1 sm:flex">
          {item.matchTags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {item.sharedSkills > 0 && (
            <span className="text-[11px] tabular-nums text-muted-foreground-subtle">
              +{item.sharedSkills} skill{item.sharedSkills !== 1 ? "s" : ""}
            </span>
          )}
          {item.coContributors && (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-trust"
              title="Shares a contributor"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span className="hidden xl:inline">shared contributor</span>
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
