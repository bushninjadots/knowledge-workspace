// Public skill discovery at /skills. Groups the shared skills catalog by
// discipline and shows, per skill, real activity — people sharing, people
// growing, projects using it, open needs — so the page reads as a place to
// *find* something to learn or build, not a bare taxonomy. A data-backed
// "Trending now" rail sits above the catalog for people who don't yet know
// what to search for. Backs the "Skills" destination in the sidebar
// navigation and the search palette.
import { useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Search, X } from "lucide-react";
import { z } from "zod";
import {
  useSkillsCatalog,
  useSkillDirectoryStats,
  type SkillActivityCounts,
} from "@/hooks/use-current-user";
import { groupSkillsByCategory, skillActivityTotal, type SkillCategoryGroup } from "@/lib/skills";
import { EmptyState } from "@/components/tethyr/empty-state";
import { SectionShell } from "@/components/tethyr/section-shell";
import { Input } from "@/components/ui/input";
import { seoMeta } from "@/lib/seo";

const skillsSearchSchema = z.object({
  // Optional (no .default()) so a bare /skills URL stays bare — a default
  // makes the router canonicalize /skills → /skills?q= with a 307.
  q: z.string().optional(),
});

export const Route = createFileRoute("/skills")({
  validateSearch: skillsSearchSchema,
  head: () =>
    seoMeta({
      path: "/skills",
      title: "Skills",
      description:
        "Discover what to learn, share, practice, or build with on Tethyr. Browse skills by discipline and see the people sharing and growing each one, and the projects built with it.",
    }),
  component: SkillsDirectoryRoute,
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Skills unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't load the skills directory. Please try again.
        </p>
        <Link to="/explore" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to explore
        </Link>
      </div>
    </div>
  ),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const EYEBROW = "text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

/** Compact "2 sharing · 1 growing · 3 projects" line. Shows only relationships
 * that actually exist, so a young catalog isn't zero-noise; falls back to a
 * dash while counts are still loading. */
function ActivityLine({ counts }: { counts: SkillActivityCounts | undefined }) {
  if (!counts) {
    return <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">—</p>;
  }
  const parts: { value: number; label: string }[] = [];
  if (counts.sharing > 0) parts.push({ value: counts.sharing, label: "sharing" });
  if (counts.growing > 0) parts.push({ value: counts.growing, label: "growing" });
  if (counts.projects > 0) parts.push({ value: counts.projects, label: "projects" });
  if (parts.length === 0) {
    return <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">—</p>;
  }
  return (
    <p className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
      {parts.map((part, index) => (
        <span key={part.label}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          <span className="font-semibold text-foreground">{part.value}</span> {part.label}
        </span>
      ))}
    </p>
  );
}

function SkillRow({
  name,
  description,
  counts,
}: {
  name: string;
  description: string | null | undefined;
  counts: SkillActivityCounts | undefined;
}) {
  return (
    <span className="flex items-center gap-4 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground group-hover:underline">
          {name}
        </span>
        {description && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>
        )}
      </span>
      <ActivityLine counts={counts} />
      <ArrowRight
        className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block"
        aria-hidden="true"
      />
    </span>
  );
}

// /skills/:slug hubs are child routes of /skills (filesystem routing), so the
// directory component is also the parent slot. Forward child matches to their
// Outlet so the hub renders standalone, not inside the directory layout.
function SkillsDirectoryRoute() {
  const { location } = useRouterState();
  if (location.pathname.startsWith("/skills/")) {
    return <Outlet />;
  }
  return <SkillsDirectoryPage />;
}

function SkillsDirectoryPage() {
  const catalog = useSkillsCatalog();
  const stats = useSkillDirectoryStats();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/skills" });
  // Draft mirrors the URL `q` so typing stays instant while the URL owns the
  // query (shareable searches, browser back/forward still work).
  const [draft, setDraft] = useState(search.q ?? "");
  const query = search.q ?? "";

  function setQuery(value: string) {
    setDraft(value);
    // undefined drops the param from the URL, so clearing returns to /skills.
    navigate({ search: { q: value || undefined }, replace: true });
  }

  const skills = useMemo(() => {
    const all = catalog.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (skill) =>
        skill.name.toLowerCase().includes(q) ||
        skill.category.toLowerCase().includes(q) ||
        (skill.description ?? "").toLowerCase().includes(q) ||
        (skill.tools ?? []).some((tool) => tool.toLowerCase().includes(q)),
    );
  }, [catalog.data, query]);

  const groups = useMemo<SkillCategoryGroup[]>(() => groupSkillsByCategory(skills), [skills]);

  // Trending is computed from the full catalog (not the filtered one) so the
  // discovery rail stays put while the directory below narrows. Only real
  // activity ranks a skill: sharing + growing + projects, distinct counts.
  const trending = useMemo(() => {
    const sc = stats.data ?? {};
    return (catalog.data ?? [])
      .filter((skill) => skillActivityTotal(sc[skill.id]) > 0)
      .sort(
        (a, b) =>
          skillActivityTotal(sc[b.id]) - skillActivityTotal(sc[a.id]) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 5);
  }, [catalog.data, stats.data]);

  if (catalog.isLoading) {
    return (
      <SectionShell>
        <div className="px-4 py-12 sm:px-6">
          <div
            className="mx-auto max-w-6xl animate-pulse space-y-8"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="h-8 w-40 rounded bg-surface-sunken" />
            <div className="h-10 w-full max-w-xl rounded-md bg-surface-sunken" />
            <div className="h-40 rounded-xl border border-border/40 bg-surface/40" />
            <div className="grid gap-8 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-3">
                  <div className="h-5 w-32 rounded bg-surface-sunken" />
                  <div className="h-24 rounded-lg bg-surface-sunken" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionShell>
    );
  }

  if (catalog.isError) {
    return (
      <SectionShell>
        <div className="flex min-h-[calc(100dvh-3rem)] items-center justify-center px-4">
          <EmptyState
            title="Couldn't load the skills directory"
            description="Something went wrong reaching the catalog. Please try again."
            actionLabel="Retry"
            onAction={() => catalog.refetch()}
            variant="skills"
          />
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell backTo="/explore">
      <header className="px-4 pb-10 pt-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Discover
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-foreground sm:text-3xl">
            Skills
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Find something to learn, share, practice, or build with. Each skill is a hub connecting
            the people who share it, the people growing it, and the projects using it.
          </p>
          <div className="relative mt-6 max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={draft}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skills, tools or disciplines…"
              aria-label="Search skills"
              className="h-10 pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-12">
          {trending.length > 0 && (
            <section aria-labelledby="trending-heading">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="trending-heading" className={EYEBROW}>
                  Trending now
                </h2>
                <p className="text-xs text-muted-foreground">
                  Ranked by people and projects actively using each skill
                </p>
              </div>
              <ul className="overflow-hidden rounded-xl border card-border bg-surface/40 divide-y divide-border/40">
                {trending.map((skill) => (
                  <li key={skill.id}>
                    <Link
                      to="/skills/$slug"
                      params={{ slug: skill.slug }}
                      preload="intent"
                      className="group flex items-center rounded-none transition-colors hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <SkillRow
                        name={skill.name}
                        description={skill.category}
                        counts={stats.data?.[skill.id]}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {groups.length === 0 ? (
            query ? (
              <EmptyState
                title="No skills match that search"
                description="Try a different skill, tool, or category."
                actionLabel="Clear search"
                onAction={() => setQuery("")}
                variant="skills"
              />
            ) : (
              <EmptyState
                title="The skills catalog is empty"
                description="Skills will appear here as the catalog grows."
                variant="skills"
              />
            )
          ) : (
            <div className="space-y-12">
              {groups.map((group) => (
                <section key={group.category} aria-labelledby={`skills-${slugify(group.category)}`}>
                  <h2
                    id={`skills-${slugify(group.category)}`}
                    className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    {group.category}
                  </h2>
                  <ul className="mt-3 overflow-hidden rounded-xl border card-border bg-surface/40 divide-y divide-border/40">
                    {group.skills.map((skill) => (
                      <li key={skill.id}>
                        <Link
                          to="/skills/$slug"
                          params={{ slug: skill.slug }}
                          preload="intent"
                          className="group flex items-center rounded-none transition-colors hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        >
                          <SkillRow
                            name={skill.name}
                            description={skill.description}
                            counts={stats.data?.[skill.id]}
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
