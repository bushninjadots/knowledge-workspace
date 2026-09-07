import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Swords, Search, Filter, Sparkles, LayoutGrid, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  useChallenges,
  type ChallengeRow,
  type ChallengeType,
  type ChallengeDifficulty,
} from "@/hooks/use-challenges";
import { ChallengeCard } from "@/components/tethyr/community/challenge-card";
import { CreateChallengeDialog } from "@/components/tethyr/community/create-challenge-dialog";
import { EmptyState } from "@/components/tethyr/empty-state";
import { Input } from "@/components/ui/input";

const TYPE_FILTERS: { label: string; value: ChallengeType | "all" }[] = [
  { label: "All types", value: "all" },
  { label: "Skill", value: "skill" },
  { label: "Project", value: "project" },
  { label: "Learning", value: "learning" },
];

const DIFFICULTY_FILTERS: { label: string; value: ChallengeDifficulty | "all" }[] = [
  { label: "All levels", value: "all" },
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Advanced", value: "advanced" },
];

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "Active", value: "active" },
  { label: "Upcoming", value: "draft" },
  { label: "Completed", value: "completed" },
];

export const Route = createFileRoute("/_authenticated/challenges")({
  head: () => ({
    meta: [
      { title: "Challenges — Tethyr" },
      {
        name: "description",
        content:
          "Discover and join challenges to level up your skills, build projects, and earn reputation.",
      },
    ],
  }),
  component: ChallengesPage,
});

function ChallengesPage() {
  const { location } = useRouterState();
  const isChildRoute = location.pathname.startsWith("/challenges/");

  // `/challenges/$id` is a nested child route — render its detail page here
  // instead of the list (same pattern as /library).
  if (isChildRoute) {
    return <Outlet />;
  }

  return <ChallengesContent />;
}

const DIFFICULTY_LABELS: Record<ChallengeDifficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const TYPE_LABELS: Record<ChallengeType, string> = {
  skill: "Skill",
  project: "Project",
  learning: "Learning",
};

/** Dense single-column list used for the default "Rows" layout. */
function ChallengeListRow({ challenge }: { challenge: ChallengeRow }) {
  return (
    <Card asChild>
      <Link
        to="/challenges/$id"
        params={{ id: challenge.id }}
        className="group flex items-center gap-4 px-4 py-3 transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-surface-elevated/50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
              {challenge.title}
            </span>
            {challenge.is_joined && (
              <span className="shrink-0 rounded-full bg-trust/10 px-2 py-0.5 text-[10px] font-medium text-trust">
                Joined
              </span>
            )}
            {challenge.difficulty !== "beginner" && (
              <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                {DIFFICULTY_LABELS[challenge.difficulty]}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs leading-relaxed text-muted-foreground">
            {challenge.description}
          </p>
        </div>
        <div className="hidden shrink-0 items-center gap-3 md:flex">
          <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
            {TYPE_LABELS[challenge.type]}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {challenge.participant_count ?? 0} joined
          </span>
        </div>
      </Link>
    </Card>
  );
}

function ChallengeGrid({ challenges }: { challenges: ChallengeRow[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {challenges.map((challenge) => (
        <ChallengeCard key={challenge.id} challenge={challenge} />
      ))}
    </div>
  );
}

function ChallengeList({ challenges }: { challenges: ChallengeRow[] }) {
  return (
    <div className="flex flex-col gap-2">
      {challenges.map((challenge) => (
        <ChallengeListRow key={challenge.id} challenge={challenge} />
      ))}
    </div>
  );
}

function ChallengesContent() {
  const { data: challenges = [], isLoading } = useChallenges("active");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ChallengeType | "all">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<ChallengeDifficulty | "all">("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [createOpen, setCreateOpen] = useState(false);
  // Dense rows are the default: challenges are comparable list data (type,
  // level, participants). The card grid stays one toggle away.
  const [layout, setLayout] = useState<"grid" | "list">("list");

  // When status changes, refetch. We use the hook's filter for "active" vs "all".
  const { data: filteredChallenges = [], isLoading: filteredLoading } = useChallenges(
    statusFilter === "active" ? "active" : "all",
  );

  const displayed = useMemo(() => {
    let list = statusFilter === "active" ? challenges : filteredChallenges;

    if (typeFilter !== "all") {
      list = list.filter((c) => c.type === typeFilter);
    }
    if (difficultyFilter !== "all") {
      list = list.filter((c) => c.difficulty === difficultyFilter);
    }
    if (statusFilter === "draft") {
      list = list.filter((c) => c.status === "draft");
    } else if (statusFilter === "completed") {
      list = list.filter((c) => c.status === "completed");
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.skills.some((s) => s.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [challenges, filteredChallenges, typeFilter, difficultyFilter, statusFilter, search]);

  const loading = isLoading || filteredLoading;

  // Curated cold-start content gets its own clearly-labeled section so a new
  // user always has real, joinable ways to make a first contribution. When
  // searching/filtering, everything (starters included) flows through the
  // main grid so search still finds them.
  const isDefaultView =
    !search.trim() &&
    typeFilter === "all" &&
    difficultyFilter === "all" &&
    statusFilter === "active";
  const starters = displayed.filter((c) => c.is_starter);
  const community = displayed.filter((c) => !c.is_starter);

  return (
    <div className="animate-room-enter min-h-screen bg-noise">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">Challenges</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Structured builds that help you level up, earn badges, and grow your reputation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Challenges layout"
              className="flex rounded-lg border border-border/40 bg-surface/40 p-0.5"
            >
              <button
                onClick={() => setLayout("grid")}
                className={`rounded-md p-1.5 transition-colors ${
                  layout === "grid"
                    ? "bg-surface-elevated text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Grid view"
                aria-pressed={layout === "grid"}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setLayout("list")}
                className={`rounded-md p-1.5 transition-colors ${
                  layout === "list"
                    ? "bg-surface-elevated text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Rows view"
                aria-pressed={layout === "list"}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
            <CreateChallengeDialog open={createOpen} onOpenChange={setCreateOpen} />
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-4 rounded-xl bg-surface-elevated/30 p-4">
          {/* Search */}
          <div className="flex items-center gap-2 rounded-xl border card-border bg-background/60 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search challenges by title, description, or skills…"
              className="border-0 bg-transparent focus-visible:ring-0 h-auto py-0 text-sm"
            />
          </div>

          {/* Filter chips */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            {/* Type */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="flex flex-wrap gap-1">
                {TYPE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setTypeFilter(f.value)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      typeFilter === f.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background/60 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div className="flex flex-wrap gap-1">
              {DIFFICULTY_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setDifficultyFilter(f.value)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    difficultyFilter === f.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background/60 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Status */}
            <div className="flex flex-wrap gap-1 sm:ml-auto">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    statusFilter === f.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background/60 text-muted-foreground hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Challenge grid */}
        {loading ? (
          layout === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 animate-pulse rounded-xl border border-border/50 bg-surface/60"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl border border-border/50 bg-surface/60"
                />
              ))}
            </div>
          )
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={<Swords className="h-5 w-5" />}
            title={
              search ||
              typeFilter !== "all" ||
              difficultyFilter !== "all" ||
              statusFilter !== "active"
                ? "No challenges match your filters"
                : "No challenges yet"
            }
            description={
              search ||
              typeFilter !== "all" ||
              difficultyFilter !== "all" ||
              statusFilter !== "active"
                ? "Try adjusting your search or filters to find more challenges."
                : "Kick one off — a challenge gives people a shared goal to learn and build together."
            }
            {...(search ||
            typeFilter !== "all" ||
            difficultyFilter !== "all" ||
            statusFilter !== "active"
              ? {}
              : { actionLabel: "Create a challenge", onAction: () => setCreateOpen(true) })}
            variant="default"
          />
        ) : isDefaultView && starters.length > 0 ? (
          <>
            {/* Start here — curated cold-start content, clearly labeled */}
            <section aria-labelledby="start-here-heading" className="space-y-4">
              <div className="flex flex-col gap-1">
                <h2
                  id="start-here-heading"
                  className="font-display text-lg font-semibold tracking-tight flex items-center gap-2"
                >
                  Start here
                  <Badge
                    variant="outline"
                    className="gap-1 border-brand-purple/30 bg-brand-purple/10 text-brand-purple text-xs font-medium"
                  >
                    <Sparkles className="h-3 w-3" /> Curated by Tethyr
                  </Badge>
                </h2>
                <p className="text-sm text-muted-foreground">
                  Real, small challenges to make your first contribution — each one is reviewed and
                  graded.
                </p>
              </div>
              {layout === "grid" ? (
                <ChallengeGrid challenges={starters} />
              ) : (
                <ChallengeList challenges={starters} />
              )}
            </section>

            {/* From the community */}
            <section aria-labelledby="community-heading" className="space-y-4">
              <h2
                id="community-heading"
                className="font-display text-lg font-semibold tracking-tight"
              >
                From the community
              </h2>
              {community.length > 0 ? (
                layout === "grid" ? (
                  <ChallengeGrid challenges={community} />
                ) : (
                  <ChallengeList challenges={community} />
                )
              ) : (
                <EmptyState
                  icon={<Swords className="h-5 w-5" />}
                  title="No community challenges yet"
                  description="Kick one off — a challenge gives people a shared goal to learn and build together."
                  actionLabel="Create a challenge"
                  onAction={() => setCreateOpen(true)}
                  variant="default"
                />
              )}
            </section>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {displayed.length} challenge{displayed.length !== 1 ? "s" : ""} found
            </p>
            {layout === "grid" ? (
              <ChallengeGrid challenges={displayed} />
            ) : (
              <ChallengeList challenges={displayed} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
