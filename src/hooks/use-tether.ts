// Data for the Tether: a member's story (everything they're connected to) and
// a project's graph. Both refresh on their own every few minutes; the full
// page also has a Sync button that pulls new GitHub / journal activity first.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildProjectGraph } from "@/lib/project-graph";
import { memberTetherNodes, projectTetherNodes, type MemberStory } from "@/lib/tether-data";
import { fetchProjectPage } from "@/routes/-projects-page-data";
import { useMilestones } from "@/hooks/use-projects";
import { useProjectRepos } from "@/hooks/use-project-repos";
import { useOpenRoles } from "@/hooks/use-project-roles";
import { getRepoFullName } from "@/lib/github";

const REFRESH = 5 * 60_000;
export const TETHER_KEY = ["tether"] as const;

type Embedded<T> = T | T[] | null;
const one = <T>(v: Embedded<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

async function loadMemberStory(profileId: string): Promise<MemberStory> {
  const [own, joined, teach, learn, crews, spaces, github, ships, journal] = await Promise.all([
    supabase.from("projects").select("id, title, created_at").eq("profile_id", profileId).limit(60),
    supabase
      .from("project_contributors")
      .select("joined_at, contribution_score, project:projects(id, title, created_at)")
      .eq("profile_id", profileId)
      .limit(60),
    supabase
      .from("profile_skills_teach")
      .select("created_at, skill:skills(id, name, slug)")
      .eq("profile_id", profileId),
    supabase
      .from("profile_skills_learn")
      .select("created_at, skill:skills(id, name, slug)")
      .eq("profile_id", profileId),
    supabase
      .from("team_members")
      .select("joined_at, team:teams(id, name, slug)")
      .eq("profile_id", profileId),
    supabase
      .from("community_space_members")
      .select("joined_at, space:community_spaces(id, name, slug)")
      .eq("user_id", profileId),
    supabase.from("profile_github").select("snapshot").eq("profile_id", profileId).maybeSingle(),
    supabase
      .from("ships")
      .select("id, body, week_start, created_at")
      .eq("author_id", profileId)
      .order("week_start", { ascending: false })
      .limit(12),
    supabase
      .from("journal_entries")
      .select("id, kind, body, occurred_at")
      .eq("author_id", profileId)
      .eq("is_public", true)
      .in("kind", ["did", "learned", "decided"])
      .order("occurred_at", { ascending: false })
      .limit(16),
  ]);

  const projects = new Map<string, MemberStory["projects"][number]>();
  for (const p of own.data ?? [])
    projects.set(p.id, { id: p.id, title: p.title, created_at: p.created_at });
  for (const row of joined.data ?? []) {
    const p = one(row.project as Embedded<{ id: string; title: string; created_at: string }>);
    if (!p) continue;
    const prev = projects.get(p.id);
    projects.set(p.id, {
      id: p.id,
      title: p.title,
      created_at: prev?.created_at ?? row.joined_at ?? p.created_at,
      contributions: Math.min(6, Math.round((row.contribution_score ?? 0) / 10)),
    });
  }

  // The people they build with: everyone else on those projects.
  const ids = [...projects.keys()];
  const people = new Map<string, MemberStory["collaborators"][number]>();
  if (ids.length) {
    const { data: crew } = await supabase
      .from("project_contributors")
      .select("profile_id, joined_at, profile:profiles!profile_id(display_name, handle)")
      .in("project_id", ids)
      .neq("profile_id", profileId)
      .limit(200);
    for (const c of crew ?? []) {
      const prof = one(
        c.profile as Embedded<{ display_name: string | null; handle: string | null }>,
      );
      const prev = people.get(c.profile_id);
      people.set(c.profile_id, {
        id: c.profile_id,
        name: prof?.display_name || prof?.handle || "Member",
        handle: prof?.handle ?? null,
        projects: (prev?.projects ?? 0) + 1,
        since: prev?.since && prev.since < c.joined_at ? prev.since : c.joined_at,
      });
    }
  }

  const skillRows = (rows: { created_at: string; skill: unknown }[] | null, teach: boolean) =>
    (rows ?? []).flatMap((r) => {
      const s = one(r.skill as Embedded<{ id: string; name: string; slug: string }>);
      return s ? [{ id: s.id, name: s.name, slug: s.slug, teach, at: r.created_at }] : [];
    });
  const skills = new Map<string, MemberStory["skills"][number]>();
  for (const s of [...skillRows(learn.data, false), ...skillRows(teach.data, true)])
    skills.set(s.id, s);

  const snapshot = (github.data?.snapshot ?? null) as {
    repos?: { full_name: string; stars: number; pushed_at: string | null }[];
  } | null;

  return {
    projects: [...projects.values()],
    collaborators: [...people.values()],
    skills: [...skills.values()],
    crews: (crews.data ?? []).flatMap((r) => {
      const t = one(r.team as Embedded<{ id: string; name: string; slug: string }>);
      return t ? [{ ...t, at: r.joined_at }] : [];
    }),
    spaces: (spaces.data ?? []).flatMap((r) => {
      const s = one(r.space as Embedded<{ id: string; name: string; slug: string }>);
      return s ? [{ ...s, at: r.joined_at }] : [];
    }),
    repos: (snapshot?.repos ?? []).slice(0, 12).map((r) => ({
      name: r.full_name,
      url: `https://github.com/${r.full_name}`,
      stars: r.stars ?? 0,
      at: r.pushed_at,
    })),
    milestones: [
      ...(ships.data ?? []).map((s) => ({
        id: `ship-${s.id}`,
        label:
          s.body
            .split("\n")
            .find((l) => l.trim() && !/^this week i:?$/i.test(l.trim()))
            ?.replace(/^[-*]\s*/, "")
            .slice(0, 60) ?? "Weekly ship",
        at: s.created_at,
        kind: "ship" as const,
      })),
      ...(journal.data ?? []).map((j) => ({
        id: `j-${j.id}`,
        label: j.body.slice(0, 60),
        at: j.occurred_at,
        kind: j.kind === "learned" ? ("learned" as const) : ("built" as const),
      })),
    ],
  };
}

export function useMemberTether(profileId: string | null | undefined) {
  return useQuery({
    queryKey: [...TETHER_KEY, "member", profileId ?? ""],
    queryFn: async () => memberTetherNodes(await loadMemberStory(profileId!)),
    enabled: !!profileId,
    staleTime: 60_000,
    refetchInterval: REFRESH,
  });
}

/** A project's tether, for the full page (the project page builds its own). */
export function useProjectTether(projectId: string | null | undefined) {
  const id = projectId ?? "";
  const { data: page, isLoading } = useQuery({
    queryKey: [...TETHER_KEY, "project", id],
    queryFn: () => fetchProjectPage(id, null),
    enabled: !!projectId,
    staleTime: 60_000,
    refetchInterval: REFRESH,
  });
  const { data: milestones = [] } = useMilestones(id);
  const { data: repos = [] } = useProjectRepos(id);
  const { data: roles = [] } = useOpenRoles(id);
  if (!page?.project) return { nodes: null, title: null, isLoading };
  const p = page.project;
  const graph = buildProjectGraph({
    project: {
      id: p.id,
      title: p.title,
      description: p.description,
      visibility: p.visibility,
      profile_id: p.profile_id,
      status: p.status,
      stage: p.stage,
    },
    contributors: page.contributors.map((c) => ({
      profile_id: c.profile_id,
      role: c.role,
      profile: c.profile,
      skills_used: c.skills_used,
    })),
    skills: page.skills.map((s) => ({ id: s.id, name: s.name })),
    milestones: milestones.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      status: m.status,
    })),
    roles: roles.map((r) => ({
      id: r.id,
      title: r.title,
      is_filled: r.is_filled,
      filled_by: r.filled_by,
    })),
    repositories: repos.map((r) => ({
      id: r.id,
      name: r.metadata.full_name ?? r.url,
      url: r.url,
      provider: r.provider,
      importedAt: r.created_at,
      fullName: getRepoFullName(r),
      language: r.metadata.language ?? null,
      topics: r.metadata.topics ?? null,
    })),
    forkedFrom: page.forkedFrom ? { id: page.forkedFrom.id, title: page.forkedFrom.title } : null,
  });
  return {
    nodes: projectTetherNodes(graph, p.id),
    title: p.title,
    isLoading,
    ownerId: p.profile_id,
  };
}
