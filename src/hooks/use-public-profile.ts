import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Profile,
  TeachSkillMeta,
  SkillVerificationLevel,
  SkillExperienceLevel,
} from "./use-current-user";
import type { ProjectRow, ActivityRow } from "@/components/tethyr/profile-sections";

export type PublicProfileData = {
  profile: Profile | null;
  avatarSigned: string | null;
  bannerSigned: string | null;
  teachIds: string[];
  teachMeta: Record<string, TeachSkillMeta>;
  learnIds: string[];
  projects: ProjectRow[];
  coverUrls: Record<string, string>;
  projectSkillIds: Record<string, string[]>;
  activity: ActivityRow[];
};

const PROFILE_COLS_BASIC =
  "id, handle, display_name, creator_title, bio, avatar_url, banner_url, banner_caption, country, timezone, languages, category, years_experience, portfolio_links, social_links";
const PROFILE_COLS_EXTENDED =
  "availability, reputation_score, available_days, available_times, teaching_style, learning_goals, favourite_tools, software_stack";

async function fetchPublicProfile(userId: string): Promise<PublicProfileData | null> {
  let profile: Profile | null = null;
  for (const cols of [`${PROFILE_COLS_BASIC}, ${PROFILE_COLS_EXTENDED}`, PROFILE_COLS_BASIC]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("profiles")
      .select(cols)
      .eq("id", userId)
      .maybeSingle();
    if (!error) {
      profile = data as Profile | null;
      break;
    }
    if (
      !error.message?.includes("column") &&
      !error.message?.includes("schema") &&
      !error.code?.startsWith("42")
    )
      break;
  }

  if (!profile) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safeQuery = async <T>(fn: () => any, fallback: T): Promise<T> => {
    try {
      return (await fn()) as T;
    } catch {
      return fallback;
    }
  };

  const [teach, learn, projectsRes, activityRes] = await Promise.all([
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
  if (profile.avatar_url) {
    const { data: s } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_url, 60 * 60 * 24);
    avatarSigned = s?.signedUrl ?? null;
  }
  let bannerSigned: string | null = null;
  if (profile.banner_url) {
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
    profile,
    avatarSigned,
    bannerSigned,
    teachIds: teachRows.map((r) => r.skill_id),
    teachMeta,
    learnIds: (learn.data ?? []).map((r: { skill_id: string }) => r.skill_id),
    projects,
    coverUrls,
    projectSkillIds,
    activity: (activityRes.data ?? []) as ActivityRow[],
  };
}

export function usePublicProfile(userId: string) {
  return useQuery({
    queryKey: ["public-profile", userId],
    queryFn: () => fetchPublicProfile(userId),
    staleTime: 30_000,
    enabled: !!userId,
  });
}
