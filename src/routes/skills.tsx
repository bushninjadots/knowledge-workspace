// Public skill directory at /skills. Groups the shared skills catalog by
// category and shows, per skill, how many people teach or learn it. Backs the
// "Skills" destination in the sidebar navigation and the search palette.
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useSkillsCatalog, useSkillProfileCounts } from "@/hooks/use-current-user";
import { groupSkillsByCategory, type SkillCategoryGroup } from "@/lib/skills";
import { EmptyState } from "@/components/tethyr/empty-state";
import { Navbar } from "@/components/tethyr/navbar";
import { Input } from "@/components/ui/input";
import { seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/skills")({
  head: () =>
    seoMeta({
      path: "/skills",
      title: "Skills directory",
      description:
        "Browse every skill in the Tethyr catalog by discipline and see how many people teach or learn each one.",
    }),
  component: SkillsDirectoryPage,
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Skills directory unavailable</h1>
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

function formatProfileCount(count: number | undefined) {
  if (count == null) return "—";
  return count === 1 ? "1 person" : `${count} people`;
}

function SkillsDirectoryPage() {
  const catalog = useSkillsCatalog();
  const counts = useSkillProfileCounts();
  const [query, setQuery] = useState("");

  const skills = useMemo(() => {
    const all = catalog.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (skill) =>
        skill.name.toLowerCase().includes(q) ||
        skill.category.toLowerCase().includes(q) ||
        (skill.description ?? "").toLowerCase().includes(q),
    );
  }, [catalog.data, query]);

  const groups = useMemo<SkillCategoryGroup[]>(() => groupSkillsByCategory(skills), [skills]);

  if (catalog.isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-12 sm:px-6">
        <div
          className="mx-auto max-w-5xl animate-pulse space-y-8"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="h-8 w-56 rounded bg-surface-sunken" />
          <div className="h-10 w-full max-w-md rounded-md bg-surface-sunken" />
          <div className="grid gap-8 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-3">
                <div className="h-5 w-32 rounded bg-surface-sunken" />
                <div className="h-16 rounded-lg bg-surface-sunken" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (catalog.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <EmptyState
          title="Couldn't load the skills directory"
          description="Something went wrong reaching the catalog. Please try again."
          actionLabel="Retry"
          onAction={() => catalog.refetch()}
          variant="skills"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar publicOnly />
      <header className="px-4 pb-8 pt-12 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Discover
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-foreground sm:text-3xl">
            Skills directory
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Every skill in the Tethyr catalog, grouped by discipline. The count next to each skill
            is how many people currently teach or learn it.
          </p>
          <div className="relative mt-6 max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skills or categories…"
              aria-label="Search skills"
              className="pl-9"
            />
          </div>
        </div>
      </header>

      <main className="px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          {groups.length === 0 ? (
            query ? (
              <EmptyState
                title="No skills match that search"
                description="Try a different skill name or category."
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
            <div className="space-y-10">
              {groups.map((group) => (
                <section key={group.category} aria-labelledby={`skills-${slugify(group.category)}`}>
                  <h2
                    id={`skills-${slugify(group.category)}`}
                    className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    {group.category}
                  </h2>
                  <ul className="mt-2 space-y-0.5">
                    {group.skills.map((skill) => (
                      <li key={skill.id}>
                        <Link
                          to="/skills/$slug"
                          params={{ slug: skill.slug }}
                          className="group flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-sunken"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-foreground group-hover:underline">
                              {skill.name}
                            </span>
                            {skill.description && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {skill.description}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                            {formatProfileCount(counts.data?.[skill.id])}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
