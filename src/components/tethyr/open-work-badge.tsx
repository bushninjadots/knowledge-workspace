// ── Open-work badge ───────────────────────────────────────────────────────────
// The "this project needs people right now" chip, shared by both profile work
// surfaces (the Studio block and the default work-evidence list). The facts
// come from useProjectOpenWork — the same unfilled needs/roles the project
// page's header pill and Explore's role cards count — surfaced where a visitor
// decides whether to enter the work.
//
// Accent-tinted like Explore's skill-match badge (subtle background, accent
// border): the one place the user accent is allowed to act as a signal, and
// here it signals opportunity. Renders nothing when there is no open work —
// optional signals never reserve layout space.
import { Users } from "lucide-react";

import { openWorkCount, type ProjectOpenWork } from "@/hooks/use-profile-work";

export function OpenWorkBadge({
  openWork,
  projectId,
  className,
}: {
  openWork: Map<string, ProjectOpenWork> | undefined;
  projectId: string;
  className?: string;
}) {
  const count = openWorkCount(openWork, projectId);
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] px-2 py-0.5 text-[11px] leading-snug font-medium text-[var(--user-accent,var(--primary))] ${className ?? ""}`}
    >
      <Users className="h-3 w-3" aria-hidden="true" />
      {count} open {count === 1 ? "spot" : "spots"}
    </span>
  );
}
