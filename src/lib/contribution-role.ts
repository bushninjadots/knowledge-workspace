// ── Contribution Role Language ───────────────────────────────────────────────
// How a person's part in a project is described. This is shared vocabulary,
// not presentation: the role a person holds on a project is a fact, and the
// same verb must be used wherever that fact is shown.
//
// It exists because three surfaces independently re-derived these labels and
// drifted — `blocks/profile/projects-block.tsx` (profile-projects block),
// `blocks/project/team-block.tsx`, and `project/project-people.tsx` each
// carried their own map. The public Studio fallback
// (`routes/-u.$handle-page.tsx`) needs the same language for the derived
// evidence it renders, so the verb now has one owner.

export type ContributorRole = "creator" | "mentor" | "contributor";

/**
 * Verb-first phrasing, because the subject is always the person being viewed:
 * "Built", not "Creator". "Creator" as a bare noun is the one label that reads
 * as a job title rather than an action, which is exactly the self-reported
 * framing Tethyr is meant to replace with evidence of work.
 */
export const CONTRIBUTION_ROLE_VERB: Record<ContributorRole, string> = {
  creator: "Built",
  mentor: "Mentored",
  contributor: "Contributed to",
};

/** Noun phrasing, for places that read as a label on a chip or a title. */
export const CONTRIBUTION_ROLE_NOUN: Record<ContributorRole, string> = {
  creator: "Creator",
  mentor: "Mentor",
  contributor: "Contributor",
};

/**
 * Tolerant lookup. Roles are stored as free text and a project can be seeded
 * or imported with a value this map has never seen, so an unknown role falls
 * back to the raw value rather than rendering blank.
 */
export function contributionRoleVerb(role: string | null | undefined): string {
  if (!role) return "Worked on";
  return CONTRIBUTION_ROLE_VERB[role as ContributorRole] ?? role;
}

/**
 * Same tolerance for the noun form. An unknown role must never render as
 * undefined (React drops that) or blank — the raw value is still information.
 */
export function contributionRoleNoun(role: string | null | undefined): string {
  if (!role) return "Contributor";
  return CONTRIBUTION_ROLE_NOUN[role as ContributorRole] ?? role;
}
