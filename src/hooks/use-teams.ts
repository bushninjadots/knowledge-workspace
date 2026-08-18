import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase;

export type TeamRole = "lead" | "core" | "contributor";

export type TeamRow = {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  cover_url: string | null;
  created_by: string;
  created_at: string;
};

export type TeamMemberRow = {
  team_id: string;
  profile_id: string;
  role: TeamRole;
  joined_at: string;
  profile: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  } | null;
};

export type TeamProjectRow = {
  team_id: string;
  project_id: string;
  project: {
    id: string;
    title: string;
    cover_url: string | null;
    status: string;
  } | null;
};

export type TeamInviteRow = {
  id: string;
  team_id: string;
  profile_id: string;
  invited_by: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  team?: TeamRow | null;
};

export const TEAM_KEY = (slug: string) => ["team", slug] as const;
export const MY_TEAMS_KEY = ["my-teams"] as const;
export const PROJECT_TEAMS_KEY = (projectId: string) => ["project-teams", projectId] as const;

// ============================================================
// Queries
// ============================================================

export function useTeam(slug: string) {
  return useQuery({
    queryKey: TEAM_KEY(slug),
    queryFn: async () => {
      const { data: team, error } = await sb
        .from("teams")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!team) return null;

      const [{ data: members }, { data: projectLinks }] = await Promise.all([
        sb.from("team_members").select("*").eq("team_id", team.id).order("joined_at"),
        sb
          .from("team_projects")
          .select("team_id, project_id, projects(id, title, cover_url, status)")
          .eq("team_id", team.id),
      ]);

      const memberRows = (members ?? []) as Omit<TeamMemberRow, "profile">[];
      const profileIds = [...new Set(memberRows.map((m) => m.profile_id))];
      const { data: profiles } =
        profileIds.length > 0
          ? await sb
              .from("profiles")
              .select("id, display_name, handle, avatar_url")
              .in("id", profileIds)
          : { data: [] };
      type ProfileWithId = NonNullable<TeamMemberRow["profile"]> & { id: string };
      const profileMap = new Map<string, ProfileWithId>(
        ((profiles ?? []) as ProfileWithId[]).map((p) => [p.id, p]),
      );

      return {
        team: team as TeamRow,
        members: memberRows.map((m): TeamMemberRow => ({
          ...m,
          profile: profileMap.get(m.profile_id) ?? null,
        })),
        projects: (
          (projectLinks ?? []) as {
            team_id: string;
            project_id: string;
            projects: TeamProjectRow["project"];
          }[]
        ).map((l) => ({
          team_id: l.team_id,
          project_id: l.project_id,
          project: l.projects ?? null,
        })),
      };
    },
    enabled: !!slug,
  });
}

export function useProjectTeams(projectId: string) {
  return useQuery({
    queryKey: PROJECT_TEAMS_KEY(projectId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("team_projects")
        .select("team_id, teams(id, name, slug)")
        .eq("project_id", projectId);
      if (error) {
        // Table may not exist yet before the migration lands — return empty.
        if (error.code === "42P01") return [];
        throw error;
      }
      return (
        (data ?? []) as { team_id: string; teams: { id: string; name: string; slug: string } }[]
      )
        .map((r) => r.teams)
        .filter((t): t is { id: string; name: string; slug: string } => !!t);
    },
    enabled: !!projectId,
  });
}

export function useMyTeams() {
  return useQuery({
    queryKey: MY_TEAMS_KEY,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await sb
        .from("team_members")
        .select("team_id, role, teams(id, name, slug)")
        .eq("profile_id", user.id);
      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return (
        (data ?? []) as {
          team_id: string;
          role: TeamRole;
          teams: { id: string; name: string; slug: string };
        }[]
      ).map((r) => ({
        role: r.role,
        ...(r.teams ?? { id: r.team_id, name: "Untitled team", slug: "" }),
      }));
    },
    staleTime: 30_000,
  });
}

export function useMyTeamInvites() {
  return useQuery({
    queryKey: ["my-team-invites"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await sb
        .from("team_invites")
        .select("id, team_id, profile_id, invited_by, status, created_at, teams(id, name, slug)")
        .eq("profile_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return ((data ?? []) as (TeamInviteRow & { teams: TeamRow })[]).map((r) => ({
        ...r,
        team: r.teams ?? null,
      }));
    },
    staleTime: 30_000,
  });
}

// ============================================================
// Mutations
// ============================================================

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  // Short random suffix avoids collisions on the unique slug constraint.
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "crew"}-${suffix}`;
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; cover_url?: string | null }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const slug = slugify(input.name);
      const { data: team, error } = await sb
        .from("teams")
        .insert({
          name: input.name.trim(),
          slug,
          cover_url: input.cover_url ?? null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      // The creator is added as the lead by trg_team_creator_lead (SECURITY
      // DEFINER), so no manual team_members insert is needed here — a manual
      // insert would be rejected by RLS (joining requires a pending invite).

      return team as TeamRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MY_TEAMS_KEY });
    },
  });
}

export function useInviteToTeam(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (handle: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile, error: pErr } = await sb
        .from("profiles")
        .select("id")
        .eq("handle", handle.trim())
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profile) throw new Error("No member with that handle");

      // Don't invite someone who is already in the crew — their accept would
      // hit the team_members primary key and fail.
      const { data: existingMember } = await sb
        .from("team_members")
        .select("profile_id")
        .eq("team_id", teamId)
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (existingMember) throw new Error("Already a member of this crew");

      const { error } = await sb.from("team_invites").insert({
        team_id: teamId,
        profile_id: profile.id,
        invited_by: user.id,
      });
      if (error) {
        // Already invited (unique on pending) — treat as success.
        if (error.code === "23505") return profile;
        throw error;
      }
      return profile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
    },
  });
}

export function useRespondToTeamInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { inviteId: string; teamId: string; accept: boolean }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (input.accept) {
        const { error: memberErr } = await sb.from("team_members").insert({
          team_id: input.teamId,
          profile_id: user.id,
          role: "contributor",
        });
        if (memberErr) throw memberErr;
      }

      const { error } = await sb
        .from("team_invites")
        .update({ status: input.accept ? "accepted" : "declined" })
        .eq("id", input.inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MY_TEAMS_KEY });
      qc.invalidateQueries({ queryKey: ["my-team-invites"] });
      qc.invalidateQueries({ queryKey: ["team"] });
    },
  });
}

export function useAttachProjectToTeam(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await sb
        .from("team_projects")
        .insert({ team_id: teamId, project_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEAM_KEY(teamId) });
    },
  });
}

export function useSetMemberRole(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { profileId: string; role: TeamRole }) => {
      const { error } = await sb
        .from("team_members")
        .update({ role: input.role })
        .eq("team_id", teamId)
        .eq("profile_id", input.profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEAM_KEY(teamId) });
    },
  });
}

export function useRemoveMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await sb
        .from("team_members")
        .delete()
        .eq("team_id", teamId)
        .eq("profile_id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEAM_KEY(teamId) });
    },
  });
}
