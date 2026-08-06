// Central source of truth for the signed-in creator.
// Every page reads from the ["current-user"] query — mutations invalidate
// this key and the whole app re-syncs automatically.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectRow, ActivityRow } from "@/components/tethyr/profile-sections";

export type { ProjectRow, ActivityRow };

export type Profile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  creator_title: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  banner_caption: string | null;
  country: string | null;
  timezone: string | null;
  languages: string[];
  category: string | null;
  years_experience: number | null;
  portfolio_links: { label: string; url: string }[];
  social_links: Record<string, string>;
  availability: string | null;
  reputation_score: number | null;
  available_days: string[];
  available_times: string[];
  teaching_style: string | null;
  learning_goals: string | null;
  favourite_tools: string[];
  software_stack: string[];
};

// ProjectRow and ActivityRow re-exported above from profile-sections.

export type Skill = { id: string; slug: string; name: string; category: string };
export type DiscoverableSkill = Skill & { usageCount: number };

export type SkillVerificationLevel = "self_declared" | "proof_certified" | "community_recognized";
export type SkillExperienceLevel = "beginner" | "intermediate" | "advanced" | "expert";

export type TeachSkillMeta = {
  verification_level: SkillVerificationLevel;
  experience_level: SkillExperienceLevel;
  proof_url: string | null;
  proof_note: string | null;
};

export type CurrentUserData = {
  userId: string;
  profile: Profile | null;
  avatarSigned: string | null;
  bannerSigned: string | null;
  teachIds: string[];
  teachMeta: Record<string, TeachSkillMeta>;
  learnIds: string[];
  wishlistIds: string[];
  projects: ProjectRow[];
  coverUrls: Record<string, string>;
  projectSkillIds: Record<string, string[]>;
  activity: ActivityRow[];
};

export const CURRENT_USER_KEY = ["current-user"] as const;

// Columns that existed before Phase 3/4 migrations — guaranteed to exist.
const PROFILE_COLS_BASIC =
  "id, handle, display_name, creator_title, bio, avatar_url, banner_url, banner_caption, country, timezone, languages, category, years_experience, portfolio_links, social_links";

// Columns added in Phase 3+4 — may not exist yet if migrations haven't run.
const PROFILE_COLS_EXTENDED =
  "availability, reputation_score, available_days, available_times, teaching_style, learning_goals, favourite_tools, software_stack";

async function fetchProfile(userId: string) {
  // Try full column set first; fall back to basic columns if a column is missing.
  for (const cols of [`${PROFILE_COLS_BASIC}, ${PROFILE_COLS_EXTENDED}`, PROFILE_COLS_BASIC]) {
    const { data, error } = await (supabase as any)
      .from("profiles")
      .select(cols)
      .eq("id", userId)
      .maybeSingle();
    if (!error) return data as Profile | null;
    // Retry on any schema/column error (missing column, schema cache, etc.)
    if (
      !error.message?.includes("column") &&
      !error.message?.includes("schema") &&
      !error.code?.startsWith("42")
    )
      break;
  }
  // Last resort: return just the id so the app doesn't crash.
  return { id: userId } as Profile;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeQuery<T>(fn: () => any, fallback: T): Promise<T> {
  try {
    return (await fn()) as T;
  } catch {
    return fallback;
  }
}

async function fetchCurrentUser(): Promise<CurrentUserData | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const profile = await fetchProfile(userId);

  const [teach, learn, wishlist, projectsRes, activityRes] = await Promise.all([
    safeQuery(
      () =>
        supabase
          .from("profile_skills_teach")
          .select("skill_id, verification_level, experience_level, proof_url, proof_note")
          .eq("profile_id", userId),
      { data: [], error: null },
    ),
    safeQuery(
      () => supabase.from("profile_skills_learn").select("skill_id").eq("profile_id", userId),
      { data: [], error: null },
    ),
    safeQuery(
      () => supabase.from("profile_skills_wishlist").select("skill_id").eq("profile_id", userId),
      { data: [], error: null },
    ),
    safeQuery(
      () =>
        supabase
          .from("projects")
          .select("*")
          .eq("profile_id", userId)
          .order("is_featured", { ascending: false })
          .order("created_at", { ascending: false }),
      { data: [], error: null },
    ),
    safeQuery(
      () =>
        supabase
          .from("activity_events")
          .select("*")
          .eq("profile_id", userId)
          .order("created_at", { ascending: false })
          .limit(30),
      { data: [], error: null },
    ),
  ]);

  let avatarSigned: string | null = null;
  if (profile?.avatar_url) {
    const { data: s } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_url, 60 * 60 * 24);
    avatarSigned = s?.signedUrl ?? null;
  }
  let bannerSigned: string | null = null;
  if (profile?.banner_url) {
    const { data: s } = await supabase.storage
      .from("banners")
      .createSignedUrl(profile.banner_url, 60 * 60 * 24);
    bannerSigned = s?.signedUrl ?? null;
  }

  const projects = (projectsRes.data ?? []) as unknown as ProjectRow[];
  const coverUrls: Record<string, string> = {};
  await Promise.all(
    projects
      .filter((p) => p.cover_url)
      .map(async (p) => {
        const { data: s } = await supabase.storage
          .from("project-media")
          .createSignedUrl(p.cover_url as string, 60 * 60 * 24);
        if (s?.signedUrl) coverUrls[p.cover_url as string] = s.signedUrl;
      }),
  );

  const projectSkillIds: Record<string, string[]> = {};
  if (projects.length > 0) {
    const { data: projectSkillsData } = await supabase
      .from("project_skills")
      .select("project_id, skill_id")
      .in(
        "project_id",
        projects.map((p) => p.id),
      );
    for (const row of (projectSkillsData ?? []) as { project_id: string; skill_id: string }[]) {
      if (!projectSkillIds[row.project_id]) projectSkillIds[row.project_id] = [];
      projectSkillIds[row.project_id].push(row.skill_id);
    }
  }

  type TeachRow = {
    skill_id: string;
    verification_level: SkillVerificationLevel;
    experience_level: SkillExperienceLevel;
    proof_url: string | null;
    proof_note: string | null;
  };
  const teachRows = (teach.data ?? []) as TeachRow[];
  const teachMeta: Record<string, TeachSkillMeta> = {};
  for (const r of teachRows) {
    teachMeta[r.skill_id] = {
      verification_level: r.verification_level,
      experience_level: r.experience_level,
      proof_url: r.proof_url,
      proof_note: r.proof_note,
    };
  }

  return {
    userId,
    profile: (profile ?? null) as Profile | null,
    avatarSigned,
    bannerSigned,
    teachIds: teachRows.map((r) => r.skill_id),
    teachMeta,
    learnIds: (learn.data ?? []).map((r: { skill_id: string }) => r.skill_id),
    wishlistIds: (wishlist.data ?? []).map((r: { skill_id: string }) => r.skill_id),
    projects,
    coverUrls,
    projectSkillIds,
    activity: (activityRes.data ?? []) as ActivityRow[],
  };
}

export function useCurrentUser() {
  const query = useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: fetchCurrentUser,
    staleTime: 30_000,
  });
  const queryClient = useQueryClient();
  return {
    ...query,
    refresh: () => queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY }),
  };
}

export function useSkillsCatalog() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills")
        .select("*")
        .order("category")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Skill[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useTrendingSkills() {
  return useQuery({
    queryKey: ["trending-skills"],
    queryFn: async (): Promise<DiscoverableSkill[]> => {
      const [skillsRes, teachRes, learnRes, projectRes] = await Promise.all([
        supabase.from("skills").select("id, slug, name, category"),
        supabase.from("profile_skills_teach").select("skill_id"),
        supabase.from("profile_skills_learn").select("skill_id"),
        supabase.from("project_skills").select("skill_id"),
      ]);

      const firstError = [skillsRes, teachRes, learnRes, projectRes].find((result) => result.error);
      if (firstError?.error) throw firstError.error;

      const usage = new Map<string, number>();
      for (const row of [
        ...(teachRes.data ?? []),
        ...(learnRes.data ?? []),
        ...(projectRes.data ?? []),
      ] as { skill_id: string }[]) {
        usage.set(row.skill_id, (usage.get(row.skill_id) ?? 0) + 1);
      }

      return ((skillsRes.data ?? []) as Skill[])
        .map((skill) => ({ ...skill, usageCount: usage.get(skill.id) ?? 0 }))
        .sort(
          (a, b) =>
            b.usageCount - a.usageCount ||
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        );
    },
    staleTime: 5 * 60 * 1000,
  });
}
