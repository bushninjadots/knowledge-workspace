import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ROLE_PRECEDENCE,
  compileProjectCredits,
  creditTextFor,
  normalizeRole,
  type CreditRole,
  type ProjectCredit,
} from "@/lib/credits";

const sb = supabase;

export type { CreditRole, ProjectCredit };
export { CREDIT_ROLE_ORDER } from "@/lib/credits";

const CREDITS_KEY = (projectId: string) => ["project-credits", projectId] as const;
const STUDIO_CREDITS_KEY = (profileId: string) => ["studio-credits", profileId] as const;
const TEAM_CREDITS_KEY = (teamId: string) => ["team-credits", teamId] as const;

/**
 * A project's Credits roll — compiled from project_contributors (roles) and
 * project_activity (evidence), with profiles resolved for names/handles.
 */
export function useProjectCredits(projectId: string) {
  return useQuery({
    queryKey: CREDITS_KEY(projectId),
    queryFn: async (): Promise<ProjectCredit[]> => {
      const [contribRes, activityRes, projectRes] = await Promise.all([
        sb.from("project_contributors").select("profile_id, role").eq("project_id", projectId),
        sb
          .from("project_activity")
          .select("id, actor_id, kind, title, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
        sb.from("projects").select("profile_id, created_at").eq("id", projectId).maybeSingle(),
      ]);

      if (contribRes.error) throw contribRes.error;
      if (activityRes.error) throw activityRes.error;
      if (projectRes.error) throw projectRes.error;

      const contributors = (contribRes.data ?? []) as { profile_id: string; role: string }[];
      const activity = (activityRes.data ?? []) as {
        id: string;
        actor_id: string | null;
        kind: string;
        title: string;
        created_at: string;
      }[];
      const project = (projectRes.data ?? null) as {
        profile_id: string;
        created_at: string;
      } | null;

      const actorIds = [
        ...new Set(activity.map((r) => r.actor_id).filter((a): a is string => !!a)),
      ];
      if (project) actorIds.push(project.profile_id);

      const { data: profiles } =
        actorIds.length > 0
          ? await sb.from("profiles").select("id, display_name, handle").in("id", actorIds)
          : { data: [] };

      return compileProjectCredits({
        contributors,
        activity,
        project,
        profiles: (profiles ?? []) as {
          id: string;
          display_name: string | null;
          handle: string | null;
        }[],
      });
    },
    enabled: !!projectId,
  });
}

export type StudioCredit = {
  project_id: string;
  project_title: string;
  role: CreditRole;
  credit_text: string;
  at: string | null;
};

/**
 * A person's "Credited on" rollup — the projects they're credited on, each
 * with their role and most recent credit text. Sorted by most recent activity.
 */
export function useStudioCredits(profileId: string) {
  return useQuery({
    queryKey: STUDIO_CREDITS_KEY(profileId),
    queryFn: async (): Promise<StudioCredit[]> => {
      const { data: contribs, error: cErr } = await sb
        .from("project_contributors")
        .select("project_id, role")
        .eq("profile_id", profileId);
      if (cErr) throw cErr;
      const rows = (contribs ?? []) as { project_id: string; role: string }[];
      if (rows.length === 0) return [];

      const projectIds = rows.map((r) => r.project_id);

      const { data: projects, error: pErr } = await sb
        .from("projects")
        .select("id, title, created_at")
        .in("id", projectIds);
      if (pErr) throw pErr;
      const projectMap = new Map<string, { title: string | null; created_at: string }>(
        ((projects ?? []) as { id: string; title: string | null; created_at: string }[]).map(
          (p) => [p.id, p],
        ),
      );

      const { data: activity, error: aErr } = await sb
        .from("project_activity")
        .select("project_id, kind, title, created_at")
        .eq("actor_id", profileId)
        .in("project_id", projectIds)
        .order("created_at", { ascending: false });
      if (aErr) throw aErr;

      // Most recent credit text per project (rows arrive newest-first).
      const latest = new Map<string, { text: string; at: string }>();
      for (const a of (activity ?? []) as {
        project_id: string;
        kind: string;
        title: string;
        created_at: string;
      }[]) {
        if (!latest.has(a.project_id)) {
          latest.set(a.project_id, { text: creditTextFor(a), at: a.created_at });
        }
      }

      return rows
        .map((r): StudioCredit => {
          const p = projectMap.get(r.project_id);
          const role = normalizeRole(r.role);
          const last = latest.get(r.project_id);
          return {
            project_id: r.project_id,
            project_title: p?.title ?? "Untitled project",
            role,
            credit_text:
              role === "creator" && !last ? "Created the project" : (last?.text ?? "Contributed"),
            at: role === "creator" && !last ? (p?.created_at ?? null) : (last?.at ?? null),
          };
        })
        .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
    },
    enabled: !!profileId,
  });
}

/**
 * A crew's Credits roll — everyone credited across all of the team's projects,
 * merged per person (strongest role, most recent credit, project named in the
 * credit text). The team roll is a rendering layer over the same evidence the
 * project rolls already use.
 */
export function useTeamCredits(teamId: string) {
  return useQuery({
    queryKey: TEAM_CREDITS_KEY(teamId),
    queryFn: async (): Promise<ProjectCredit[]> => {
      const { data: links, error: lErr } = await sb
        .from("team_projects")
        .select("project_id")
        .eq("team_id", teamId);
      if (lErr) throw lErr;
      const projectIds = ((links ?? []) as { project_id: string }[]).map((l) => l.project_id);
      if (projectIds.length === 0) return [];

      const [projectsRes, contribsRes, activityRes] = await Promise.all([
        sb.from("projects").select("id, title, profile_id, created_at").in("id", projectIds),
        sb
          .from("project_contributors")
          .select("project_id, profile_id, role")
          .in("project_id", projectIds),
        sb
          .from("project_activity")
          .select("project_id, actor_id, kind, title, created_at")
          .in("project_id", projectIds),
      ]);
      if (projectsRes.error) throw projectsRes.error;
      if (contribsRes.error) throw contribsRes.error;
      if (activityRes.error) throw activityRes.error;

      const projects = (projectsRes.data ?? []) as {
        id: string;
        title: string;
        profile_id: string;
        created_at: string;
      }[];
      const contribs = (contribsRes.data ?? []) as {
        project_id: string;
        profile_id: string;
        role: string;
      }[];
      const activity = (activityRes.data ?? []) as {
        project_id: string;
        actor_id: string | null;
        kind: string;
        title: string;
        created_at: string;
      }[];

      const actorIds = [
        ...new Set([
          ...contribs.map((c) => c.profile_id),
          ...activity.map((a) => a.actor_id).filter((a): a is string => !!a),
          ...projects.map((p) => p.profile_id),
        ]),
      ];
      const { data: profiles } =
        actorIds.length > 0
          ? await sb.from("profiles").select("id, display_name, handle").in("id", actorIds)
          : { data: [] };
      const profileList = (profiles ?? []) as {
        id: string;
        display_name: string | null;
        handle: string | null;
      }[];

      type Acc = { role: CreditRole; text: string; at: string; count: number };
      const merged = new Map<string, Acc>();

      for (const project of projects) {
        const credits = compileProjectCredits({
          contributors: contribs.filter((c) => c.project_id === project.id),
          activity: activity.filter((a) => a.project_id === project.id),
          project: { profile_id: project.profile_id, created_at: project.created_at },
          profiles: profileList,
        });
        for (const credit of credits) {
          const text = `${credit.credit_text} — ${project.title}`;
          const existing = merged.get(credit.profile_id);
          if (!existing) {
            merged.set(credit.profile_id, {
              role: credit.role,
              text,
              at: credit.at,
              count: credit.credit_count,
            });
            continue;
          }
          const strongest =
            ROLE_PRECEDENCE[credit.role] < ROLE_PRECEDENCE[existing.role]
              ? credit.role
              : existing.role;
          const isNewer = new Date(credit.at).getTime() > new Date(existing.at).getTime();
          merged.set(credit.profile_id, {
            role: strongest,
            text: isNewer ? text : existing.text,
            at: isNewer ? credit.at : existing.at,
            count: existing.count + credit.credit_count,
          });
        }
      }

      const profileMap = new Map(profileList.map((p) => [p.id, p]));
      return [...merged.entries()]
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
    },
    enabled: !!teamId,
  });
}
