// Project page data: the project row with its contributors, skills, signed
// media, fork lineage and community AI tags, plus the contribution ledger the
// project graph reads. Used by ProjectPage (-projects-page.tsx).
import { notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Contributor, ProjectDetail } from "@/hooks/use-projects";
import { projectVisibleToViewer, type ProjectContributionLogEntry } from "@/lib/project-graph";
import { isColumnSchemaError } from "@/lib/supabase-errors";

const sb = supabase;

const ROLE_ORDER: Record<Contributor["role"], number> = {
  creator: 0,
  mentor: 1,
  contributor: 2,
};

type SkillLite = { id: string; slug: string; name: string; category: string };

/** Everything the project page header and sections need for one project. The
 *  fork parent is gated on `viewerId` (§29), so callers key the cache on it. */
export async function fetchProjectPage(id: string, viewerId: string | null) {
  // Try full column set first; fall back if extended columns are missing.
  const FULL_COLS =
    "id, profile_id, title, description, goal, vision, status, visibility, stage, started_at, progress_percent, cover_url, gallery, resources, links, tags, uploaded_files, readme, tools, presentation_preset, github_display, season, collaboration_brief, lineage, looking_for_feedback, looking_for_collaborators, is_featured, allow_forks, forked_from_project_id, fork_count, ai_assisted";
  // Fallback deliberately omits the newest columns (uploaded_files, readme,
  // tools, visibility) so a database that hasn't run the latest migrations
  // still loads.
  const BASIC_COLS =
    "id, profile_id, title, description, goal, status, started_at, progress_percent, cover_url, links, tags, looking_for_feedback, looking_for_collaborators, is_featured";

  let project: ProjectDetail | null = null;
  for (const cols of [FULL_COLS, BASIC_COLS]) {
    const res = await sb.from("projects").select(cols).eq("id", id).maybeSingle();
    if (!res.error) {
      project = res.data as unknown as ProjectDetail;
      break;
    }
    if (
      !res.error.message?.includes("column") &&
      !res.error.message?.includes("schema") &&
      !res.error.code?.startsWith("42")
    )
      throw res.error;
  }
  if (!project) throw notFound();

  const FULL_CONTRIB_COLS =
    "profile_id, role, contribution_score, skills_used, profiles(id, handle, display_name, creator_title, avatar_url)";
  const BASIC_CONTRIB_COLS =
    "profile_id, role, profiles(id, handle, display_name, creator_title, avatar_url)";

  let contributorsRes: { data: unknown[] | null } | null = null;
  let contributorsDegraded = false;
  for (const cols of [FULL_CONTRIB_COLS, BASIC_CONTRIB_COLS]) {
    const res = await supabase.from("project_contributors").select(cols).eq("project_id", id);
    if (!res.error) {
      contributorsRes = res;
      contributorsDegraded = cols === BASIC_CONTRIB_COLS;
      break;
    }
    if (
      !res.error.message?.includes("column") &&
      !res.error.message?.includes("schema") &&
      !res.error.code?.startsWith("42")
    ) {
      console.error("[tethyr] project contributors failed to load.", res.error);
      contributorsDegraded = true;
      break;
    }
    contributorsDegraded = true;
  }
  contributorsRes ??= { data: [] };

  const { data: skillsRes } = await supabase
    .from("project_skills")
    .select("skill_id, skills(id, slug, name, category)")
    .eq("project_id", id);

  const contributors = (
    (contributorsRes.data ?? []) as {
      profile_id: string;
      role: string;
      contribution_score: number;
      skills_used: string[];
      profiles: unknown;
    }[]
  )
    .map((r) => ({
      profile_id: r.profile_id,
      role: r.role as Contributor["role"],
      contribution_score: r.contribution_score ?? 0,
      skills_used: r.skills_used ?? [],
      profile: (r.profiles as Contributor["profile"]) ?? null,
    }))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) as Contributor[];

  const skills = (skillsRes ?? [])
    .map((r) => r.skills as SkillLite | null)
    .filter((s): s is SkillLite => !!s);

  let coverSigned: string | null = null;
  if (project.cover_url) {
    const { data: s } = await supabase.storage
      .from("project-media")
      .createSignedUrl(project.cover_url, 60 * 60);
    coverSigned = s?.signedUrl ?? null;
  }

  const avatarTargets = contributors.filter((c) => c.profile?.avatar_url);
  const avatarSigned: Record<string, string> = {};
  if (avatarTargets.length > 0) {
    // Batch the signing — the per-avatar loop was N+1 storage calls each
    // time the project page loaded (avatars bucket is private).
    const { data: signed } = await supabase.storage.from("avatars").createSignedUrls(
      avatarTargets.map((c) => c.profile!.avatar_url as string),
      60 * 60,
    );
    for (const item of signed ?? []) {
      if (!item.error && item.signedUrl) {
        const target = avatarTargets.find((c) => c.profile!.avatar_url === item.path);
        if (target) avatarSigned[target.profile_id] = item.signedUrl;
      }
    }
  }

  // Fork lineage — resolve the original project's title and owner handle so
  // the header can attribute the fork to it.
  let forkedFrom: { id: string; title: string; handle: string | null } | null = null;
  if (project.forked_from_project_id) {
    // The FK hint is load-bearing: since project_ai_tags (20261001130000)
    // added a second projects→profiles path, a bare profiles() embed is
    // ambiguous to PostgREST and 400s with PGRST201.
    // §29 — projects are SELECT-able by everyone, so RLS alone does not
    // guard a private parent's title: it may reach the header and the
    // graph only when the parent is public or the viewer owns it.
    const parentCols =
      "id, title, visibility, profile_id, profiles!projects_profile_id_fkey(handle)";
    const parentColsLegacy = "id, title, profiles!projects_profile_id_fkey(handle)";
    let parentRow: unknown = null;
    {
      const res = await sb
        .from("projects")
        .select(parentCols)
        .eq("id", project.forked_from_project_id)
        .maybeSingle();
      if (!res.error) {
        parentRow = res.data;
      } else if (isColumnSchemaError(res.error)) {
        // A database without the visibility column predates private
        // projects; fall back to the original select and let the helper
        // treat the missing value as public.
        const legacy = await sb
          .from("projects")
          .select(parentColsLegacy)
          .eq("id", project.forked_from_project_id)
          .maybeSingle();
        parentRow = legacy.data;
      }
    }
    const parent = parentRow as {
      id: string;
      title: string;
      visibility?: string | null;
      profile_id?: string | null;
      profiles: { handle: string | null } | null;
    } | null;
    if (projectVisibleToViewer(viewerId, parent)) {
      forkedFrom = {
        id: parent!.id,
        title: parent!.title,
        handle: parent!.profiles?.handle ?? null,
      };
    }
  }

  // Community AI tags — fetch the count and whether the current user has
  // tagged this project, so the header can show the badge and the tag
  // button can toggle. Best-effort: if the table/ RPC doesn't exist yet
  // (migration hasn't run), defaults are used and the UI degrades silently.
  let aiTagCount = 0;
  let aiUserTagged = false;
  {
    const { data: countRes, error: countErr } = await supabase.rpc("project_ai_tag_count", {
      p_project_id: id,
    });
    if (!countErr) aiTagCount = (countRes as number) ?? 0;
    // `project_ai_user_tagged` is granted to `authenticated` only (anon is
    // explicitly revoked in 20261001130000), so calling it while signed out
    // is a guaranteed 401. Only ask when there is a session.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const { data: taggedRes, error: taggedErr } = await supabase.rpc("project_ai_user_tagged", {
        p_project_id: id,
      });
      if (!taggedErr) aiUserTagged = (taggedRes as boolean) ?? false;
    }
  }

  return {
    project: project as ProjectDetail,
    contributors,
    skills,
    coverSigned,
    avatarSigned,
    contributorsDegraded,
    forkedFrom,
    aiTagCount,
    aiUserTagged,
  };
}

/** The contribution ledger entries for one project, oldest first. */
export async function fetchProjectContributionLog(
  id: string,
): Promise<ProjectContributionLogEntry[]> {
  // The profile embed names contribution authors for the graph — the graph
  // must show people, never raw profile ids. PostgREST resolves the embed
  // through the row's profiles foreign key.
  const { data: rows, error } = await supabase
    .from("contribution_log")
    .select("id, action, profile_id, profile:profiles(display_name, handle), created_at, metadata")
    .filter("metadata->>project_id", "eq", id)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (rows ?? []) as ProjectContributionLogEntry[];
}
