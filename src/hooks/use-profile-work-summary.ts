// What a profile has actually done on Tethyr: the projects it belongs to, its
// logged contributions, and the people it has shared projects with. Shared by
// the contribution-stats and collaboration-network blocks so both read the
// same real numbers (and neither falls back to sample data).

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type ProfileCollaborator = {
  profileId: string;
  name: string;
  handle: string | null;
  sharedProjects: number;
};

export type ProfileWorkSummary = {
  projects: number;
  contributions: number;
  collaborators: ProfileCollaborator[];
};

type CollaboratorRow = {
  profile_id: string;
  project_id: string;
  profile: { display_name: string | null; handle: string | null } | null;
};

async function fetchProfileWorkSummary(profileId: string): Promise<ProfileWorkSummary> {
  const [memberships, contributions] = await Promise.all([
    supabase
      .from("project_contributors")
      .select("project_id")
      .eq("profile_id", profileId)
      .limit(200),
    supabase
      .from("contribution_log")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId),
  ]);
  const projectIds = [...new Set((memberships.data ?? []).map((row) => row.project_id))];

  let collaborators: ProfileCollaborator[] = [];
  if (projectIds.length > 0) {
    const { data } = await supabase
      .from("project_contributors")
      .select("profile_id, project_id, profile:profiles(display_name, handle)")
      .in("project_id", projectIds)
      .neq("profile_id", profileId)
      .limit(200);
    const byPerson = new Map<string, ProfileCollaborator & { projects: Set<string> }>();
    for (const row of (data ?? []) as unknown as CollaboratorRow[]) {
      const entry = byPerson.get(row.profile_id) ?? {
        profileId: row.profile_id,
        name: row.profile?.display_name || row.profile?.handle || "Member",
        handle: row.profile?.handle ?? null,
        sharedProjects: 0,
        projects: new Set<string>(),
      };
      entry.projects.add(row.project_id);
      entry.sharedProjects = entry.projects.size;
      byPerson.set(row.profile_id, entry);
    }
    collaborators = [...byPerson.values()]
      .map(({ projects: _projects, ...person }) => person)
      .sort((a, b) => b.sharedProjects - a.sharedProjects || a.name.localeCompare(b.name));
  }

  return {
    projects: projectIds.length,
    contributions: contributions.count ?? 0,
    collaborators,
  };
}

export function useProfileWorkSummary(profileId: string | null) {
  return useQuery({
    queryKey: ["profile-work-summary", profileId],
    queryFn: () => fetchProfileWorkSummary(profileId as string),
    enabled: !!profileId,
    staleTime: 60_000,
  });
}
