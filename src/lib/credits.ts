/**
 * Credits roll compilation — pure, testable logic.
 *
 * A "credit" is a single line built from the evidence a project already
 * generates (project_activity events + the contributor roster). The roll is
 * not new data; it is a rendering layer that regroups the evidence trail by
 * person, orders it by role then chronology, and turns it into the editorial
 * "who built this" list that closes the Build → Contribute → Become known loop.
 */

export type CreditRole = "creator" | "mentor" | "contributor";

export type ProjectCredit = {
  profile_id: string;
  display_name: string;
  handle: string | null;
  role: CreditRole;
  credit_text: string;
  at: string;
  credit_count: number;
};

/** One project_activity row (the fields the roll reads). */
export type ProjectCreditEvent = {
  actor_id: string | null;
  kind: string;
  title: string;
  created_at: string;
};

export type ContributorRole = { profile_id: string; role: string };

export type ProfileLite = {
  id: string;
  display_name: string | null;
  handle: string | null;
};

/**
 * Display order for the roll: Creator → Contributors → Special thanks.
 * (Merge strength still uses ROLE_PRECEDENCE below, where mentor outranks
 * contributor; that only affects which label a multi-role actor gets.)
 */
export const CREDIT_ROLE_ORDER: CreditRole[] = ["creator", "contributor", "mentor"];

export const ROLE_PRECEDENCE: Record<CreditRole, number> = {
  creator: 0,
  mentor: 1,
  contributor: 2,
};

export function normalizeRole(role: string): CreditRole {
  return role === "creator" || role === "mentor" ? role : "contributor";
}

/**
 * Map a project_activity event to a human credit sentence. Events whose title
 * is already a complete sentence (file_added, role_filled, need_filled) are
 * passed through verbatim.
 */
export function creditTextFor(row: { kind: string; title: string }): string {
  switch (row.kind) {
    case "update":
      return `Posted update “${row.title}”`;
    case "discussion":
      return `Started discussion “${row.title}”`;
    case "contributor_joined":
      return "Joined the project as a contributor";
    default:
      return row.title;
  }
}

/**
 * Compile a project's credits from its contributor roster and activity events.
 *
 * - Every project gets a "Created the project" credit for its creator.
 * - Activity events are grouped by actor; each actor yields one line carrying
 *   their strongest role and most recent credit (the creator's headline stays
 *   "Created the project" while extra actions bump their count).
 * - Events without an actor (e.g. milestone completions that predate the
 *   completed_by capture) are skipped — they are evidence but can't be
 *   credited to a person.
 */
export function compileProjectCredits(input: {
  contributors: ContributorRole[];
  activity: ProjectCreditEvent[];
  project: { profile_id: string; created_at: string } | null;
  profiles: ProfileLite[];
}): ProjectCredit[] {
  // Strongest role per person (contributor rows are unique per project+person).
  const roleMap = new Map<string, CreditRole>();
  for (const c of input.contributors) {
    const role = normalizeRole(c.role);
    const existing = roleMap.get(c.profile_id);
    if (!existing || ROLE_PRECEDENCE[role] < ROLE_PRECEDENCE[existing]) {
      roleMap.set(c.profile_id, role);
    }
  }

  const creatorId = input.project?.profile_id ?? null;

  type Acc = { role: CreditRole; text: string; at: string; count: number };
  const acc = new Map<string, Acc>();

  if (input.project) {
    acc.set(input.project.profile_id, {
      role: roleMap.get(input.project.profile_id) ?? "creator",
      text: "Created the project",
      at: input.project.created_at,
      count: 1,
    });
  }

  for (const row of input.activity) {
    if (!row.actor_id) continue;
    const role = roleMap.get(row.actor_id) ?? "contributor";
    const text = creditTextFor(row);
    const existing = acc.get(row.actor_id);
    if (!existing) {
      acc.set(row.actor_id, { role, text, at: row.created_at, count: 1 });
      continue;
    }
    const strongest = ROLE_PRECEDENCE[role] < ROLE_PRECEDENCE[existing.role] ? role : existing.role;
    if (row.actor_id === creatorId) {
      // The creator keeps "Created the project" as their headline; extra work
      // only bumps the count so their identity stays legible.
      acc.set(row.actor_id, { ...existing, role: strongest, count: existing.count + 1 });
      continue;
    }
    const isNewer = new Date(row.created_at).getTime() > new Date(existing.at).getTime();
    acc.set(row.actor_id, {
      role: strongest,
      text: isNewer ? text : existing.text,
      at: isNewer ? row.created_at : existing.at,
      count: existing.count + 1,
    });
  }

  const profileMap = new Map<string, ProfileLite>(input.profiles.map((p) => [p.id, p]));

  return [...acc.entries()]
    .map(([profile_id, c]): ProjectCredit => {
      const p = profileMap.get(profile_id);
      return {
        profile_id,
        display_name: p?.display_name || p?.handle || "Unknown",
        handle: p?.handle ?? null,
        role: c.role,
        credit_text: c.text,
        at: c.at,
        credit_count: c.count,
      };
    })
    .sort((a, b) => {
      const r = ROLE_PRECEDENCE[a.role] - ROLE_PRECEDENCE[b.role];
      if (r !== 0) return r;
      return new Date(a.at).getTime() - new Date(b.at).getTime();
    });
}
