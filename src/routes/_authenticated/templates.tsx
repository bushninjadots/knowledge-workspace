// ── Templates Route ───────────────────────────────────────────────────────────
// Browse public templates created by the Tethyr community.
// Search by name, filter by category, sort by popularity or newest.
// Clicking a template navigates to its detail page.

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { usePublicTemplates } from "@/hooks/use-templates";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Blocks, GitFork, LayoutGrid, Search, TrendingUp, User } from "lucide-react";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most used" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "", label: "All" },
  { value: "minimal", label: "Minimal" },
  { value: "developer", label: "Developer" },
  { value: "portfolio", label: "Portfolio" },
  { value: "documentation", label: "Documentation" },
  { value: "startup", label: "Startup" },
  { value: "community", label: "Community" },
  { value: "creative", label: "Creative" },
] as const;

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({ meta: [{ title: "Templates — Tethyr" }] }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"newest" | "popular">("newest");

  const { data: templates = [], isLoading, isError } = usePublicTemplates({
    category: category || undefined,
    search: search || undefined,
    sort,
  });

  return (
    <div className="min-h-screen bg-noise px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-xl font-semibold">Templates</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Layouts created by the community. Apply one to give your profile or project a new look.
        </p>

        {/* Search & filters */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  category === opt.value
                    ? "bg-[var(--user-accent,var(--trust))] text-[var(--user-accent-foreground,white)]"
                    : "bg-surface text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                }`}
                onClick={() => setCategory(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 ml-auto">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  sort === opt.value
                    ? "bg-surface-elevated text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSort(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
            <p className="text-sm text-destructive">Couldn't load templates.</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && templates.length === 0 && (
          <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 text-center">
            <LayoutGrid className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search || category ? "No templates match your filters." : "No templates published yet."}
            </p>
            <p className="text-xs text-muted-foreground">
              Templates are created when users save their layouts for others to use.
            </p>
          </div>
        )}

        {/* Grid */}
        {!isLoading && !isError && templates.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <Link
                key={t.id}
                to="/templates/$id"
                params={{ id: t.id }}
                className="group relative rounded-xl border border-card-border bg-surface p-4 transition-shadow hover:shadow-sm"
              >
                {/* Preview strip */}
                <div className="mb-3 flex flex-col gap-1">
                  {(t.sections ?? [])
                    .slice(0, 3)
                    .map((s: { id: string; layout: string }, i: number) => (
                      <div
                        key={s.id ?? i}
                        className="h-1.5 rounded-sm bg-muted/60"
                        style={{
                          width:
                            s.layout === "full"
                              ? "100%"
                              : s.layout?.includes("column")
                                ? "48%"
                                : "72%",
                        }}
                      />
                    ))}
                </div>

                <h3 className="mb-0.5 text-sm font-semibold group-hover:text-[var(--user-accent,var(--trust))] transition-colors">
                  {t.name}
                </h3>
                <p className="mb-0.5 text-[11px] text-muted-foreground capitalize">
                  {t.type.replace(/_/g, " ")}
                </p>

                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Blocks className="h-3 w-3" />
                    {(t.sections ?? []).reduce(
                      (sum: number, s: { blocks: unknown[] }) => sum + (s.blocks?.length ?? 0),
                      0,
                    )}{" "}
                    blocks
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {t.usageCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitFork className="h-3 w-3" />
                    {t.forkCount}
                  </span>
                  {t.creatorHandle && (
                    <span className="flex items-center gap-1 ml-auto truncate max-w-[100px]">
                      <User className="h-3 w-3 shrink-0" />
                      @{t.creatorHandle}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}