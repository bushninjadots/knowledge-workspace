import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Film } from "lucide-react";
import { useProjectCredits } from "@/hooks/use-credits";
import { CREDIT_ROLE_ORDER, type CreditRole, type ProjectCredit } from "@/lib/credits";
import { timeAgo } from "@/lib/time";

const ROLE_HEADING: Record<CreditRole, string> = {
  creator: "Creator",
  mentor: "Special thanks",
  contributor: "Contributors",
};

/**
 * The project Credits roll — a quiet, editorial list of everyone who built the
 * project and what they actually did. Compiled from the project's evidence
 * trail (project_activity) rather than hand-maintained.
 */
export function ProjectCredits({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, refetch } = useProjectCredits(projectId);
  return <CreditsRoll credits={data} isLoading={isLoading} isError={isError} onRetry={refetch} />;
}

/**
 * Presentational roll shared by the project page and the team page. Mentors
 * render under a collapsed "Special thanks" group so the core build team stays
 * legible while the helpers remain one tap away.
 */
export function CreditsRoll({
  credits,
  isLoading,
  isError,
  onRetry,
}: {
  credits: ProjectCredit[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const [showThanks, setShowThanks] = useState(false);

  if (isLoading) {
    return (
      <section className="mt-14" aria-hidden="true">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 rounded bg-surface" />
          <div className="h-3 w-2/3 rounded bg-surface" />
          <div className="h-3 w-1/2 rounded bg-surface" />
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="mt-14">
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 px-4 py-3">
          <p className="text-sm text-muted-foreground">Couldn't load credits.</p>
          <button
            onClick={onRetry}
            className="text-sm text-primary hover:underline"
            aria-label="Retry loading credits"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  // A project always carries its creator credit, so this only hides the
  // section when there is genuinely no one to credit.
  if (!credits || credits.length === 0) return null;

  const groups = CREDIT_ROLE_ORDER.map((role) => ({
    role,
    items: credits.filter((c) => c.role === role),
  })).filter((g) => g.items.length > 0);

  return (
    <section aria-labelledby="project-credits-heading" className="mt-14">
      <div className="mb-6 flex items-center gap-2">
        <Film className="h-4 w-4 text-muted-foreground" />
        <h2
          id="project-credits-heading"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          Credits
        </h2>
      </div>

      <div className="space-y-7">
        {groups.map(({ role, items }) => {
          if (role === "mentor") {
            return (
              <div key={role}>
                <button
                  type="button"
                  onClick={() => setShowThanks((v) => !v)}
                  aria-expanded={showThanks}
                  className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 transition hover:text-foreground"
                >
                  {showThanks ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  {ROLE_HEADING[role]}
                  <span className="normal-case tracking-normal text-muted-foreground/60">
                    {items.length} {items.length === 1 ? "mentor" : "mentors"}
                  </span>
                </button>
                {showThanks && (
                  <ul className="mt-3 space-y-2.5 border-l border-border/60 pl-4">
                    {items.map((credit) => (
                      <CreditLine key={credit.profile_id} credit={credit} />
                    ))}
                  </ul>
                )}
              </div>
            );
          }

          return (
            <div key={role}>
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {ROLE_HEADING[role]}
              </h3>
              <ul className="space-y-2.5 border-l border-border/60 pl-4">
                {items.map((credit) => (
                  <CreditLine key={credit.profile_id} credit={credit} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CreditLine({ credit }: { credit: ProjectCredit }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 text-sm leading-relaxed">
      {credit.handle ? (
        <Link
          to="/u/$handle"
          params={{ handle: credit.handle }}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {credit.display_name}
        </Link>
      ) : (
        <span className="font-medium text-foreground">{credit.display_name}</span>
      )}
      <span aria-hidden className="text-muted-foreground/60">
        —
      </span>
      <span className="text-muted-foreground">{credit.credit_text}</span>
      <span className="ml-auto whitespace-nowrap text-xs tabular-nums text-muted-foreground/60">
        {timeAgo(credit.at)}
      </span>
    </li>
  );
}
