// Challenges on a project page — structured builds tied to the project.

import { lazy, Suspense } from "react";
import { Link } from "@tanstack/react-router";
import type { useProjectChallenges } from "@/hooks/use-challenges";

const CreateChallengeDialog = lazy(() =>
  import("@/components/tethyr/community/create-challenge-dialog").then((m) => ({
    default: m.CreateChallengeDialog,
  })),
);

type ProjectChallenge = NonNullable<ReturnType<typeof useProjectChallenges>["data"]>[number];

export function ProjectChallengesSection({
  projectId,
  challenges,
  canCreate,
}: {
  projectId: string;
  challenges: ProjectChallenge[];
  canCreate: boolean;
}) {
  return (
    <section
      id="project-challenges"
      aria-labelledby="project-challenges-heading"
      className="mt-10 scroll-mt-24 border-t border-border/60 pt-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="project-challenges-heading"
            className="font-display text-lg font-semibold tracking-tight"
          >
            Challenges
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Structured builds tied to this project — join one to level up and earn evidence.
          </p>
        </div>
        {canCreate && (
          <Suspense fallback={null}>
            <CreateChallengeDialog projectId={projectId} />
          </Suspense>
        )}
      </div>

      {challenges.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No challenges tied to this project yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border/50">
          {challenges.map((c) => (
            <li key={c.id}>
              <Link
                to="/challenges/$id"
                params={{ id: c.id }}
                className="flex items-center justify-between gap-4 py-3 transition-lift hover:bg-surface-elevated/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.difficulty}
                    {c.end_date ? ` · ends ${new Date(c.end_date).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                  {c.type.replace(/_/g, " ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
