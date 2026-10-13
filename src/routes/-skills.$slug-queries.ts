// Skill hub data: stats, who shares and who is growing the skill, projects
// that use it, open needs, and related skills. Used by -skills.$slug-page.tsx.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Code-split module: the interactive page for its route. See the route
// file for the eager surface (loader/head) and the lazyRouteComponent wire-up.
const sb = supabase;

export type HubStats = {
  sharing: number;
  growing: number;
  projects: number;
  needs: number;
  endorsements: number;
};

export type SharingRow = {
  profile_id: string;
  verification_level: "self_declared" | "proof_certified" | "community_recognized" | null;
  experience_level: "beginner" | "intermediate" | "advanced" | "expert" | null;
  profiles: {
    id: string;
    handle: string | null;
    display_name: string | null;
    creator_title: string | null;
    avatar_url: string | null;
    country: string | null;
    timezone: string | null;
    availability: string | null;
  } | null;
};

export type GrowingRow = {
  profile_id: string;
  profiles: {
    id: string;
    handle: string | null;
    display_name: string | null;
    creator_title: string | null;
    avatar_url: string | null;
    country: string | null;
    timezone: string | null;
    availability: string | null;
  } | null;
};

export type SkillProjectRow = {
  project_id: string;
  projects: {
    id: string;
    title: string;
    description: string | null;
    stage: string | null;
    looking_for_collaborators: boolean;
    looking_for_feedback: boolean;
  } | null;
};

export type SkillNeedRow = {
  id: string;
  title: string;
  note: string | null;
  urgency: string;
  project_id: string;
  projects: {
    id: string;
    title: string;
    stage: string | null;
  } | null;
};

// ── Shared queries ────────────────────────────────────────────
// Overview previews and the People/Projects tabs read the *same* query keys,
// so switching tabs never refetches — the overview warms the tab data.

export function useHubStats(skillId: string | undefined) {
  return useQuery({
    queryKey: ["skill-stats", skillId ?? "none"],
    enabled: Boolean(skillId),
    queryFn: async (): Promise<HubStats> => {
      const [{ data: stats }, { count: endorseCount }] = await Promise.all([
        supabase.rpc("skill_directory_stats", { p_skill_ids: [skillId!] }),
        sb
          .from("skill_endorsements")
          .select("id", { count: "exact", head: true })
          .eq("skill_id", skillId!),
      ]);
      const row = (stats ?? [])[0];
      return {
        sharing: Number(row?.sharing_count ?? 0),
        growing: Number(row?.growing_count ?? 0),
        projects: Number(row?.project_count ?? 0),
        needs: Number(row?.need_count ?? 0),
        endorsements: endorseCount ?? 0,
      };
    },
  });
}

export function useSharingPeople(skillId: string) {
  return useQuery({
    queryKey: ["skill-sharing-people", skillId],
    queryFn: async () => {
      const { data } = await sb
        .from("profile_skills_teach")
        .select(
          "profile_id, verification_level, experience_level, profiles(id, handle, display_name, creator_title, avatar_url, country, timezone, availability)",
        )
        .eq("skill_id", skillId)
        .order("created_at", { ascending: false });
      return (data ?? []) as SharingRow[];
    },
  });
}

export function useGrowingPeople(skillId: string) {
  return useQuery({
    queryKey: ["skill-growing-people", skillId],
    queryFn: async () => {
      const { data } = await sb
        .from("profile_skills_learn")
        .select(
          "profile_id, profiles(id, handle, display_name, creator_title, avatar_url, country, timezone, availability)",
        )
        .eq("skill_id", skillId)
        .order("created_at", { ascending: false });
      return (data ?? []) as GrowingRow[];
    },
  });
}

export function useSkillProjects(skillId: string) {
  return useQuery({
    queryKey: ["skill-projects", skillId],
    queryFn: async () => {
      const { data } = await sb
        .from("project_skills")
        .select(
          "project_id, projects(id, title, description, stage, looking_for_collaborators, looking_for_feedback, profile_id)",
        )
        .eq("skill_id", skillId);
      return (data ?? []) as SkillProjectRow[];
    },
  });
}

export function useSkillNeeds(skillId: string) {
  return useQuery({
    queryKey: ["skill-needs", skillId],
    queryFn: async () => {
      const { data } = await sb
        .from("project_needs")
        .select("id, title, note, urgency, project_id, projects(id, title, stage)")
        .eq("skill_id", skillId)
        .eq("is_filled", false)
        .order("created_at", { ascending: false });
      return (data ?? []) as SkillNeedRow[];
    },
  });
}

/**
 * Related skills = skills that co-occur with this one on shared projects.
 * That is a real relationship signal (worked together / used together), not
 * "whichever project_skills rows happened to be returned first".
 */
export function useRelatedSkills(skillId: string) {
  return useQuery({
    queryKey: ["skill-related", skillId],
    queryFn: async () => {
      const { data: projectRows } = await sb
        .from("project_skills")
        .select("project_id")
        .eq("skill_id", skillId);
      const projectIds = [...new Set((projectRows ?? []).map((row) => row.project_id))].slice(
        0,
        24,
      );
      if (projectIds.length === 0) return [];
      const { data: rows } = await sb
        .from("project_skills")
        .select("skill_id, skills(id, name, slug, category)")
        .neq("skill_id", skillId)
        .in("project_id", projectIds);
      const frequency = new Map<string, number>();
      const byId = new Map<string, { id: string; name: string; slug: string; category: string }>();
      for (const row of rows ?? []) {
        frequency.set(row.skill_id, (frequency.get(row.skill_id) ?? 0) + 1);
        if (row.skills) byId.set(row.skill_id, row.skills);
      }
      return [...frequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id]) => byId.get(id))
        .filter((skill): skill is { id: string; name: string; slug: string; category: string } =>
          Boolean(skill),
        );
    },
  });
}

// ── Page ──────────────────────────────────────────────────────
