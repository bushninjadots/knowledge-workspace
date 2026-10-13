// Explore data: the paged project, opportunity and people feeds plus the
// batched lookups their cards show (my applications, open-role counts,
// session hosts, open needs). Used by ExplorePage (-explore-page.tsx).
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isColumnSchemaError } from "@/lib/supabase-errors";
import type { ProjectRow } from "./explore";
import type { Tab } from "./-explore-sidebar";

export type Creator = {
  id: string;
  handle: string | null;
  display_name: string | null;
  creator_title: string | null;
  category: string | null;
  country: string | null;
  availability: string | null;
  updated_at: string;
};

export type OpportunityQueryRow = {
  id: string;
  title: string;
  description: string | null;
  skills: string[] | null;
  created_at: string;
  projects: {
    id: string;
    title: string;
    description: string | null;
    stage: string | null;
    status: string;
    profile_id: string;
    profiles: {
      handle: string | null;
      display_name: string | null;
      creator_title: string | null;
    } | null;
  } | null;
};

export type Opportunity = {
  id: string;
  title: string;
  description: string | null;
  skills: string[];
  created_at: string;
  project: {
    id: string;
    title: string;
    description: string | null;
    stage: string | null;
    status: string;
    profile_id: string;
    profile: {
      handle: string | null;
      display_name: string | null;
      creator_title: string | null;
    } | null;
  };
};

export type NeedRow = {
  id: string;
  title: string;
  note: string | null;
  urgency: "low" | "normal" | "high";
  created_at: string;
  skills: { name: string } | null;
  projects: {
    id: string;
    title: string;
    status: string;
    profile_id: string;
    profiles: {
      handle: string | null;
      display_name: string | null;
    } | null;
  } | null;
};

export function useExploreData({ tab, meId }: { tab: Tab; meId: string | null }) {
  type ExploreCursor = { created_at: string; id: string };
  type CreatorCursor = { updated_at: string; id: string };
  const PROJECTS_PAGE_SIZE = 40;
  const {
    data: projectsPages,
    isPending: projectsLoading,
    hasNextPage: projectsHasNextPage,
    isFetchingNextPage: projectsFetchingMore,
    fetchNextPage: fetchNextProjects,
  } = useInfiniteQuery({
    queryKey: ["explore-projects"],
    queryFn: async ({ pageParam }): Promise<ProjectRow[]> => {
      const PROJECTS_SELECT =
        "id, profile_id, title, description, status, stage, tags, progress_percent, cover_url, is_featured, looking_for_collaborators, looking_for_feedback, created_at, updated_at, profiles!projects_profile_id_fkey(id, handle, display_name, creator_title, avatar_url, availability, background)" as const;
      let query = supabase
        .from("projects")
        .select<typeof PROJECTS_SELECT, ProjectRow>(PROJECTS_SELECT)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PROJECTS_PAGE_SIZE);
      if (pageParam) {
        query = query.or(
          `created_at.lt.${pageParam.created_at},and(created_at.eq.${pageParam.created_at},id.lt.${pageParam.id})`,
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];
      const coverPaths = rows.filter((p) => p.cover_url).map((p) => p.cover_url as string);
      if (coverPaths.length > 0) {
        const { data: signed } = await supabase.storage
          .from("project-media")
          .createSignedUrls(coverPaths, 60 * 60);
        const signedByPath = new Map(
          (signed ?? []).filter((i) => !i.error && i.signedUrl).map((i) => [i.path, i.signedUrl]),
        );
        for (const p of rows) {
          if (p.cover_url && signedByPath.has(p.cover_url))
            p.cover_url = signedByPath.get(p.cover_url)!;
        }
      }
      return rows;
    },
    initialPageParam: null as ExploreCursor | null,
    getNextPageParam: (lastPage) =>
      lastPage.length < PROJECTS_PAGE_SIZE
        ? undefined
        : {
            created_at: lastPage[lastPage.length - 1].created_at,
            id: lastPage[lastPage.length - 1].id,
          },
    staleTime: 60_000,
  });
  const projects = projectsPages?.pages.flat() ?? undefined;

  const { data: contributors } = useQuery({
    queryKey: ["explore-contributors", meId ?? "anon", (projects ?? []).length],
    queryFn: async (): Promise<{ project_id: string }[]> => {
      if (!meId) return [];
      const ids = (projects ?? []).map((p) => p.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("project_contributors")
        .select("project_id")
        .in("project_id", ids)
        .eq("profile_id", meId);
      if (error) throw error;
      return (data ?? []) as { project_id: string }[];
    },
    enabled: !!meId && (projects ?? []).length > 0,
    staleTime: 60_000,
  });

  const OPPORTUNITIES_PAGE_SIZE = 80;
  const {
    data: opportunitiesPages,
    isPending: opportunitiesLoading,
    hasNextPage: opportunitiesHasNextPage,
    isFetchingNextPage: opportunitiesFetchingMore,
    fetchNextPage: fetchNextOpportunities,
  } = useInfiniteQuery({
    queryKey: ["explore-opportunities"],
    queryFn: async ({ pageParam }): Promise<Opportunity[]> => {
      const OPPORTUNITIES_SELECT =
        // profiles is disambiguated via the direct FK — without it, PostgREST
        // 300s (PGRST201) because projects↔profiles also has a many-to-many
        // path through project_contributors.
        "id, title, description, skills, created_at, projects(id, title, description, stage, status, profile_id, profiles!projects_profile_id_fkey(handle, display_name, creator_title))" as const;
      let query = supabase
        .from("project_open_roles")
        .select<typeof OPPORTUNITIES_SELECT, OpportunityQueryRow>(OPPORTUNITIES_SELECT)
        .eq("is_filled", false)
        // Filter the embedded project before pagination so a page cannot be
        // shortened by closed/paused projects and produce a bad cursor.
        .in("projects.status", ["planning", "active"])
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(OPPORTUNITIES_PAGE_SIZE);
      if (pageParam) {
        query = query.or(
          `created_at.lt.${pageParam.created_at},and(created_at.eq.${pageParam.created_at},id.lt.${pageParam.id})`,
        );
      }
      const { data, error } = await query;
      if (error) {
        // A published schema that doesn't have the newest columns yet is
        // expected while migrations roll out — degrade to an empty list
        // instead of crashing the Opportunities tab. Everything else is a
        // genuine failure and should surface (React Query retry + error UI).
        if (isColumnSchemaError(error)) {
          console.warn(
            "[tethyr] explore opportunities: schema not published yet — degraded.",
            error,
          );
          return [];
        }
        throw error;
      }

      return (data ?? []).flatMap((row) => {
        const project = row.projects;
        if (!project || !["planning", "active"].includes(project.status)) return [];
        return [
          {
            id: row.id,
            title: row.title,
            description: row.description ?? null,
            skills: Array.isArray(row.skills) ? row.skills : [],
            created_at: row.created_at,
            project: {
              id: project.id,
              title: project.title,
              description: project.description ?? null,
              stage: project.stage ?? null,
              status: project.status,
              profile_id: project.profile_id,
              profile: project.profiles ?? null,
            },
          },
        ];
      });
    },
    initialPageParam: null as ExploreCursor | null,
    getNextPageParam: (lastPage) =>
      lastPage.length < OPPORTUNITIES_PAGE_SIZE
        ? undefined
        : {
            created_at: lastPage[lastPage.length - 1].created_at,
            id: lastPage[lastPage.length - 1].id,
          },
    enabled: tab === "opportunities",
    staleTime: 60_000,
  });
  const opportunities = (opportunitiesPages?.pages ?? []).flat();

  // One batched query for my application status across all visible roles —
  // avoids each Apply button firing its own query on the Opportunities tab.
  const { data: myRoleStatus = {} } = useQuery({
    queryKey: [
      "my-role-applications",
      "batch",
      meId ?? "anon",
      opportunities.map((opportunity) => opportunity.id).join(","),
    ],
    queryFn: async (): Promise<Record<string, string>> => {
      if (!meId || opportunities.length === 0) return {};
      const visibleRoleIds = opportunities.map((opportunity) => opportunity.id);
      const { data, error } = await supabase
        .from("project_role_applications")
        .select("role_id, status")
        .eq("profile_id", meId)
        .in("role_id", visibleRoleIds)
        .limit(500);
      if (error) return {};
      const map: Record<string, string> = {};
      for (const row of (data ?? []) as { role_id: string; status: string }[]) {
        map[row.role_id] = row.status;
      }
      return map;
    },
    enabled: !!meId && tab === "opportunities" && opportunities.length > 0,
    staleTime: 30_000,
  });

  // Open "need help now" asks, surfaced at the top of the Opportunities tab.
  const { data: needs = [] } = useQuery({
    queryKey: ["explore-needs"],
    queryFn: async (): Promise<NeedRow[]> => {
      const { data, error } = await supabase
        .from("project_needs")
        .select(
          // profiles!projects_profile_id_fkey: disambiguate from the
          // project_contributors m2m path (PGRST201 otherwise).
          "id, title, note, urgency, created_at, skills(name), projects(id, title, status, profile_id, profiles!projects_profile_id_fkey(handle, display_name))",
        )
        .eq("is_filled", false)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      const rank = { high: 0, normal: 1, low: 2 } as const;
      return ((data ?? []) as NeedRow[])
        .filter((n) => n.projects && ["planning", "active"].includes(n.projects.status))
        .sort((a, b) => {
          const diff = rank[a.urgency] - rank[b.urgency];
          if (diff !== 0) return diff;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    },
    enabled: tab === "opportunities",
    staleTime: 60_000,
  });

  const CREATORS_PAGE_SIZE = 60;
  const {
    data: creatorsPages,
    isPending: creatorsLoading,
    hasNextPage: creatorsHasNextPage,
    isFetchingNextPage: creatorsFetchingMore,
    fetchNextPage: fetchNextCreators,
  } = useInfiniteQuery({
    queryKey: ["explore-creators", meId ?? "anon"],
    queryFn: async ({ pageParam }): Promise<Creator[]> => {
      let query = supabase
        .from("profiles")
        .select(
          "id, handle, display_name, creator_title, category, country, availability, updated_at",
        )
        .not("display_name", "is", null)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(CREATORS_PAGE_SIZE);
      if (pageParam) {
        query = query.or(
          `updated_at.lt.${pageParam.updated_at},and(updated_at.eq.${pageParam.updated_at},id.lt.${pageParam.id})`,
        );
      }
      if (meId) query = query.neq("id", meId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Creator[];
    },
    initialPageParam: null as CreatorCursor | null,
    getNextPageParam: (lastPage) =>
      lastPage.length < CREATORS_PAGE_SIZE
        ? undefined
        : {
            updated_at: lastPage[lastPage.length - 1].updated_at,
            id: lastPage[lastPage.length - 1].id,
          },
    staleTime: 60_000,
  });
  const creators = (creatorsPages?.pages ?? []).flat();

  // Open-role counts for the visible project cards — one batched query so the
  // shelf, list, and overlay can each show "N open roles" without firing per
  // card.
  const { data: openRoleCounts = new Map<string, number>() } = useQuery({
    queryKey: ["explore-open-roles", (projects ?? []).map((p) => p.id).join(",")],
    queryFn: async (): Promise<Map<string, number>> => {
      const ids = (projects ?? []).map((p) => p.id);
      if (ids.length === 0) return new Map();
      // Server-side grouped count via RPC instead of pulling every role row:
      // the earlier .in(...).limit(2000) fetch shipped up to 2000 rows to the
      // client just to count them, and a PostgREST count() select is rejected
      // by stacks with aggregates disabled (PGRST123).
      const { data, error } = await supabase.rpc("explore_open_role_counts", {
        p_project_ids: ids,
      });
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of (data ?? []) as { project_id: string; open_roles: number }[]) {
        counts.set(row.project_id, Number(row.open_roles));
      }
      return counts;
    },
    enabled: (projects ?? []).length > 0,
    staleTime: 60_000,
  });

  // Creators hosting upcoming sessions — a subtle "hosting live sessions"
  // signal on the People grid.
  const { data: sessionHostIds = new Set<string>() } = useQuery({
    queryKey: ["explore-session-hosts", (creators ?? []).map((c) => c.id).join(",")],
    queryFn: async (): Promise<Set<string>> => {
      const ids = (creators ?? []).map((c) => c.id);
      if (ids.length === 0) return new Set();
      // Distinct organizers server-side — the old .limit(2000) row pull only
      // ever needed the organizer_id set, and a count() select breaks on
      // stacks with PostgREST aggregates disabled.
      const { data, error } = await supabase.rpc("explore_session_host_ids", {
        p_profile_ids: ids,
        p_now: new Date().toISOString(),
      });
      if (error) throw error;
      return new Set(((data ?? []) as { organizer_id: string }[]).map((row) => row.organizer_id));
    },
    enabled: (creators ?? []).length > 0,
    staleTime: 120_000,
  });

  return {
    projects,
    projectsLoading,
    projectsHasNextPage,
    projectsFetchingMore,
    fetchNextProjects,
    contributors,
    opportunities,
    opportunitiesLoading,
    opportunitiesHasNextPage,
    opportunitiesFetchingMore,
    fetchNextOpportunities,
    myRoleStatus,
    needs,
    creators,
    creatorsLoading,
    creatorsHasNextPage,
    creatorsFetchingMore,
    fetchNextCreators,
    openRoleCounts,
    sessionHostIds,
  };
}
