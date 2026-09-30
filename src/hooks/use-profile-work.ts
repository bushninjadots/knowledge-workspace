// ── Public Profile Work Evidence ──────────────────────────────────────────────
// A person's work and the people they build with, read straight from
// `project_contributors` — the single source of truth for "who is part of
// this project".
//
// Why this is derived and never authored: you do not add your projects to your
// profile, you join a project and you appear on it. That makes a person's work
// a *fact about them* rather than content they wrote, which is the whole basis
// of Tethyr's "known through what they build" claim. So it must be readable on
// a profile whose owner has never opened the Studio editor — see
// `routes/-u.$handle-page.tsx`, which renders this as the default evidence for
// anyone who has not published a Studio.
//
// This deliberately reads the same tables as
// `blocks/profile/projects-block.tsx` and `blocks/profile/collaborators-block.tsx`.
// Those two are the owner's *arrangement* of their work (chosen presentation,
// toggles, placement) and only exist once a Studio is published. This hook is
// the *default arrangement* — same facts, no configuration, no second source.
// Publishing a Studio changes how the work is presented, never whether it shows.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Keep the fallback readable: this is a summary, not the project's home. */
const MAX_PROJECTS = 6;
const MAX_COLLABORATORS = 12;

type ProfileWorkProject = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  progress_percent: number;
  cover_url: string | null;
  role: string;
};

type ProfileWorkCollaborator = {
  profile_id: string;
  sharedProjectCount: number;
  profile: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
    creator_title: string | null;
  } | null;
};

export type ProfileWorkEvidence = {
  projects: ProfileWorkProject[];
  collaborators: ProfileWorkCollaborator[];
  /** True when the person has real work; false when the page should stay quiet. */
  hasWork: boolean;
};

type MembershipRow = {
  project_id: string;
  role: string;
  projects: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    progress_percent: number;
    cover_url: string | null;
  } | null;
};

type CrewRow = {
  project_id: string;
  profile_id: string;
  profile: ProfileWorkCollaborator["profile"];
};

/**
 * RLS note: `project_contributors` is `USING (true)` for SELECT, so anon can
 * read membership rows. The nested `projects(...)` embed is filtered by the
 * `projects` policy (`visibility = 'public' OR owner OR contributor`), so a
 * private project never leaks here — the membership row comes back with a null
 * `projects` and is dropped by the `project !== null` guard below. Do not add a
 * client-side visibility filter to "fix" this; the database already does it.
 */
async function fetchWork(profileId: string): Promise<ProfileWorkEvidence> {
  const { data: memberships, error } = await supabase
    .from("project_contributors")
    .select(
      "project_id, role, projects(id, title, description, status, progress_percent, cover_url)",
    )
    .eq("profile_id", profileId)
    .limit(MAX_PROJECTS);

  if (error) throw error;

  const rows = (memberships ?? []) as unknown as MembershipRow[];
  const projects: ProfileWorkProject[] = rows
    .filter((r): r is MembershipRow & { projects: NonNullable<MembershipRow["projects"]> } =>
      Boolean(r.projects),
    )
    .map((r) => ({
      id: r.projects.id,
      title: r.projects.title,
      description: r.projects.description,
      status: r.projects.status,
      progress_percent: r.projects.progress_percent ?? 0,
      cover_url: r.projects.cover_url,
      role: r.role,
    }));

  if (projects.length === 0) {
    return { projects: [], collaborators: [], hasWork: false };
  }

  // Everyone else on those projects, excluding the person themselves and the
  // projects' creators (the owner already reads as the author elsewhere).
  const projectIds = projects.map((p) => p.id);
  const { data: crew } = await supabase
    .from("project_contributors")
    .select(
      "project_id, profile_id, role, profile:profiles(display_name, handle, avatar_url, creator_title)",
    )
    .in("project_id", projectIds)
    .neq("profile_id", profileId)
    .neq("role", "creator")
    .limit(MAX_COLLABORATORS * 2);

  // Collapse to one entry per person, keeping how many projects they share.
  // Two people on three projects are collaborators, not three rows.
  const byPerson = new Map<string, ProfileWorkCollaborator>();
  for (const row of (crew ?? []) as unknown as CrewRow[]) {
    if (!row.profile?.handle) continue; // unaddressable person — not linkable
    const existing = byPerson.get(row.profile_id);
    if (existing) {
      existing.sharedProjectCount += 1;
    } else {
      byPerson.set(row.profile_id, {
        profile_id: row.profile_id,
        sharedProjectCount: 1,
        profile: row.profile,
      });
    }
  }

  // Strongest relationship first: someone you share more work with leads.
  const collaborators = [...byPerson.values()]
    .sort((a, b) => b.sharedProjectCount - a.sharedProjectCount)
    .slice(0, MAX_COLLABORATORS);

  return { projects, collaborators, hasWork: projects.length > 0 };
}

export function useProfileWork(profileId: string | null | undefined) {
  return useQuery({
    queryKey: ["profile-work-evidence", profileId],
    queryFn: () => fetchWork(profileId as string),
    enabled: !!profileId,
    // Work changes when the owner joins or leaves a project, not on a timer.
    // A visitor landing on a profile should see current work, not a cache from
    // a previous visit to a different person.
    staleTime: 60_000,
  });
}

/** Unfilled needs + open roles per project, for the "needs people" signal. */
export type ProjectOpenWork = {
  roles: number;
  needs: number;
};

/**
 * Which of the given projects currently need people, in one batched read per
 * table — the same facts the project page's "N needs" header pill and Explore's
 * open-role counts show, surfaced where a visitor decides whether to enter.
 * Projects missing from the result have no open work (the badge just doesn't
 * render); a failed read degrades to "no signal", never an error state.
 *
 * Only ids the caller already resolved to visible projects may be passed — the
 * profile work paths filter private projects out before this runs, so nothing
 * here can leak an unfilled need behind a private door.
 */
export function useProjectOpenWork(projectIds: string[] | null | undefined) {
  const key = (projectIds ?? []).join(",");
  return useQuery({
    queryKey: ["profile-open-work", key],
    queryFn: async () => {
      const ids = key ? key.split(",") : [];
      if (ids.length === 0) return new Map<string, ProjectOpenWork>();
      const [needsRes, rolesRes] = await Promise.all([
        supabase.from("project_needs").select("project_id, is_filled").in("project_id", ids),
        supabase.from("project_open_roles").select("project_id, is_filled").in("project_id", ids),
      ]);
      // A read failure means we cannot say — render no badge rather than a
      // wrong one. The cards themselves are unaffected.
      if (needsRes.error || rolesRes.error) return new Map<string, ProjectOpenWork>();
      const open = new Map<string, ProjectOpenWork>();
      const bump = (projectId: string, field: keyof ProjectOpenWork) => {
        if (!projectId) return;
        const entry = open.get(projectId) ?? { roles: 0, needs: 0 };
        entry[field] += 1;
        open.set(projectId, entry);
      };
      for (const row of (needsRes.data ?? []) as { project_id: string; is_filled: boolean }[]) {
        if (!row.is_filled) bump(row.project_id, "needs");
      }
      for (const row of (rolesRes.data ?? []) as { project_id: string; is_filled: boolean }[]) {
        if (!row.is_filled) bump(row.project_id, "roles");
      }
      return open;
    },
    enabled: !!projectIds && projectIds.length > 0,
    // Same lifecycle as the work evidence itself: changes when someone joins,
    // not on a timer.
    staleTime: 60_000,
  });
}

/** True when the project has any unfilled need or open role. */
export function hasOpenWork(open: Map<string, ProjectOpenWork> | undefined, projectId: string) {
  const entry = open?.get(projectId);
  return Boolean(entry && (entry.roles > 0 || entry.needs > 0));
}
