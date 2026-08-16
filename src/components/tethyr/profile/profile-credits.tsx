import { Link } from "@tanstack/react-router";
import { Film } from "lucide-react";
import { useStudioCredits } from "@/hooks/use-credits";
import type { CreditRole } from "@/lib/credits";

const ROLE_LABEL: Record<CreditRole, string> = {
  creator: "Creator",
  mentor: "Mentor",
  contributor: "Contributor",
};

/**
 * "Credited on" — the person's rollup of projects they're credited on, each
 * with their role and most recent credit text. Replaces a bare reputation
 * number with links to the actual work.
 */
export function ProfileCredits({ profileId }: { profileId: string }) {
  const { data, isLoading, isError } = useStudioCredits(profileId);

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-xl bg-surface-elevated/30 p-5" aria-hidden="true">
        <div className="mb-4 h-4 w-28 rounded bg-surface" />
        <div className="space-y-2">
          <div className="h-3 w-2/3 rounded bg-surface" />
          <div className="h-3 w-1/2 rounded bg-surface" />
        </div>
      </div>
    );
  }

  if (isError || !data || data.length === 0) return null;

  return (
    <div className="rounded-xl bg-surface-elevated/30 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Film className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Credited on</h3>
      </div>
      <ul className="space-y-2.5">
        {data.map((credit) => (
          <li key={credit.project_id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <Link
              to="/projects/$id"
              params={{ id: credit.project_id }}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {credit.project_title}
            </Link>
            <span className="text-xs text-muted-foreground/70">{ROLE_LABEL[credit.role]}</span>
            {credit.credit_text && credit.credit_text !== "Contributed" && (
              <span aria-hidden className="text-muted-foreground/50">
                ·
              </span>
            )}
            {credit.credit_text && credit.credit_text !== "Contributed" && (
              <span className="text-xs text-muted-foreground">{credit.credit_text}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
