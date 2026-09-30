// ── Open-work badge ───────────────────────────────────────────────────────────
// The "this project needs people right now" chip, shared by both profile work
// surfaces (the Studio block and the default work-evidence list). The facts
// come from useProjectOpenWork — the same unfilled needs/roles the project
// page's header pill and Explore's role cards count — surfaced where a visitor
// decides whether to enter the work.
//
// Copy uses the product's existing nouns, not a new one: Explore's actionable
// unit is an "open role" (apply), the project page's is a "need" (help now).
// The chip says whichever it is — roles first, needs only when there are no
// roles — so the number names the action a visitor can actually take.
//
// Accent-tinted like Explore's skill-match badge (subtle background, accent
// border): the one place the user accent is allowed to act as a signal, and
// here it signals opportunity. Renders nothing when there is no open work —
// optional signals never reserve layout space.
import { Users } from "lucide-react";

import { type ProjectOpenWork } from "@/hooks/use-profile-work";

/** The chip text: roles first (the apply action), needs when there are no roles. */
function openWorkLabel(entry: ProjectOpenWork): string | null {
  if (entry.roles > 0) {
    return entry.roles === 1 ? "1 open role" : `${entry.roles} open roles`;
  }
  if (entry.needs > 0) {
    return entry.needs === 1 ? "1 need" : `${entry.needs} needs`;
  }
  return null;
}

export function OpenWorkBadge({
  openWork,
  projectId,
  className,
}: {
  openWork: Map<string, ProjectOpenWork> | undefined;
  projectId: string;
  className?: string;
}) {
  const entry = openWork?.get(projectId);
  if (!entry) return null;
  const label = openWorkLabel(entry);
  if (!label) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] px-2 py-0.5 text-[11px] leading-snug font-medium text-[var(--user-accent-emphasis,var(--user-accent,var(--primary)))] ${className ?? ""}`}
    >
      <Users className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}
