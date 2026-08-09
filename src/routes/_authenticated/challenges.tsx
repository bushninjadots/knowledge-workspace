import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Trophy,
  Swords,
  Search,
  Filter,
  Plus,
} from "lucide-react";
import { useChallenges, type ChallengeType, type ChallengeDifficulty } from "@/hooks/use-challenges";
import { ChallengeCard } from "@/components/tethyr/community/challenge-card";
import { CreateChallengeDialog } from "@/components/tethyr/community/create-challenge-dialog";
import { EmptyState } from "@/components/tethyr/empty-state";
import { Button } from "@/components/ui/button";
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

const TYPE_COLORS: Record<string, string> = {
  skill: "bg-brand-purple/10 text-brand-purple border-brand-purple/20",
  project: "bg-primary/10 text-primary border-primary/20",
  learning: "bg-brand-green/10 text-brand-green border-brand-green/20",
};

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
  const { data: challenges = [], isLoading } = useChallenges("active");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ChallengeType | "all">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<ChallengeDifficulty | "all">("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [createOpen, setCreateOpen] = useState(false);

  // When status changes, refetch. We use the hook's filter for "active" vs "all".
  const { data: filteredChallenges = [], isLoading: filteredLoading } = useChallenges(
    statusFilter === "active" ? "active" : "all",
  );

  const displayed = useMemo(() => {
    let list = statusFilter === "active"
      ? challenges
      : filteredChallenges;

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
          <CreateChallengeDialog open={createOpen} onOpenChange={setCreateOpen} />
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-xl border border-border/50 bg-surface/60"
              />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={<Swords className="h-5 w-5" />}
            title={
              search || typeFilter !== "all" || difficultyFilter !== "all" || statusFilter !== "active"
                ? "No challenges match your filters"
                : "No challenges yet"
            }
            description={
              search || typeFilter !== "all" || difficultyFilter !== "all" || statusFilter !== "active"
                ? "Try adjusting your search or filters to find more challenges."
                : "Kick one off — a challenge gives people a shared goal to learn and build together."
            }
            {...(search || typeFilter !== "all" || difficultyFilter !== "all" || statusFilter !== "active"
              ? {}
              : { actionLabel: "Create a challenge", onAction: () => setCreateOpen(true) })}
            variant="default"
          />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {displayed.length} challenge{displayed.length !== 1 ? "s" : ""} found
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayed.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
