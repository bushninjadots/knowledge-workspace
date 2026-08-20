import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectPresentationPreset } from "@/lib/project-presentation";

const sb = supabase;

// ============================================================
// Types
// ============================================================

export type ProjectStage = "planning" | "building" | "testing" | "launch" | "growing";
export type ProjectSeason = "research" | "prototype" | "feedback" | "launch" | "building";
export type CollaborationBrief = {
  need?: string | null;
  why_now?: string | null;
  contribution_shape?: string | null;
  time_shape?: string | null;
};
export type ProjectLineage = {
  previous_project_id?: string | null;
  next_project_id?: string | null;
  label?: string | null;
};

export type ProjectDetail = {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  goal: string | null;
  vision: string | null;
  status: "planning" | "active" | "paused" | "completed";
  visibility: "public" | "private";
  stage: ProjectStage;
  started_at: string;
  progress_percent: number;
  cover_url: string | null;
  gallery: GalleryItem[];
  resources: ResourceItem[];
  links: Record<string, string>;
  tags: string[];
  looking_for_feedback: boolean;
  looking_for_collaborators: boolean;
  is_featured: boolean;
  presentation_preset?: ProjectPresentationPreset | null;
  season?: ProjectSeason | null;
  collaboration_brief?: CollaborationBrief | null;
  lineage?: ProjectLineage | null;
  uploaded_files?: Record<string, unknown>[];
  readme?: string | null;
  tools?: string[];
  created_at: string;
  updated_at: string;
};

export type GalleryItem = { url: string; caption?: string; type: "image" | "video" };
export type ProjectRecognition = {
  id: string;
  project_activity_id: string;
  project_id: string;
  giver_id: string;
  recipient_id: string;
  kind: string;
  created_at: string;
};
export type ResourceItem = {
  title: string;
  url: string;
  type: "article" | "tool" | "video" | "doc" | "other";
};

export type MilestoneRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "done";
  position: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectUpdateRow = {
  id: string;
  project_id: string;
  author_id: string;
  title: string;
  body: string;
  week_number: number | null;
  created_at: string;
  author?: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  };
};

export type DiscussionRow = {
  id: string;
  project_id: string;
  author_id: string;
  title: string;
  body: string;
  category: "general" | "question" | "idea" | "feedback" | "announcement";
  is_pinned: boolean;
  community_post_id: string | null;
  created_at: string;
  updated_at: string;
  author?: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  };
  reply_count?: number;
};

export type DiscussionReplyRow = {
  id: string;
  discussion_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  };
};

export type OpenRoleRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  skills: string[];
  is_filled: boolean;
  filled_by: string | null;
  created_at: string;
};

// ============================================================
// Query keys
// ============================================================

export const PROJECT_KEY = (id: string) => ["project-detail", id] as const;
export const MILESTONES_KEY = (projectId: string) => ["milestones", projectId] as const;
export const PROJECT_UPDATES_KEY = (projectId: string) => ["project-updates", projectId] as const;
export const DISCUSSIONS_KEY = (projectId: string) => ["discussions", projectId] as const;
export const DISCUSSION_REPLIES_KEY = (discussionId: string) =>
  ["discussion-replies", discussionId] as const;
export const OPEN_ROLES_KEY = (projectId: string) => ["open-roles", projectId] as const;
export const PROJECT_ACTIVITY_KEY = (projectId: string) => ["project-activity", projectId] as const;

// ============================================================
// Milestones
// ============================================================

export function useMilestones(projectId: string) {
  return useQuery({
    queryKey: MILESTONES_KEY(projectId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("project_milestones")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as MilestoneRow[];
    },
    enabled: !!projectId,
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      title: string;
      description?: string;
      due_date?: string;
    }) => {
      // Get max position
      const { data: existing } = await sb
        .from("project_milestones")
        .select("position")
        .eq("project_id", input.projectId)
        .order("position", { ascending: false })
        .limit(1);
      const maxPos = (existing as { position: number }[] | null)?.[0]?.position ?? -1;

      const { data, error } = await sb
        .from("project_milestones")
        .insert({
          project_id: input.projectId,
          title: input.title,
          description: input.description ?? null,
          due_date: input.due_date ?? null,
          position: maxPos + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data as MilestoneRow;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: MILESTONES_KEY(variables.projectId) });
    },
  });
}

export function useUpdateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      projectId: string;
      title?: string;
      description?: string;
      status?: MilestoneRow["status"];
      due_date?: string;
      position?: number;
    }) => {
      const updates: {
        title?: string;
        description?: string;
        status?: MilestoneRow["status"];
        due_date?: string;
        position?: number;
        completed_by?: string | null;
      } = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.status !== undefined) updates.status = input.status;
      if (input.due_date !== undefined) updates.due_date = input.due_date;
      if (input.position !== undefined) updates.position = input.position;
      // Attribute the completion so the Credits roll can credit the actor.
      if (input.status === "done") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) updates.completed_by = user.id;
      }
      const { error } = await sb.from("project_milestones").update(updates).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: MILESTONES_KEY(variables.projectId) });
      qc.invalidateQueries({ queryKey: PROJECT_ACTIVITY_KEY(variables.projectId) });
    },
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; projectId: string }) => {
      const { error } = await sb.from("project_milestones").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: MILESTONES_KEY(variables.projectId) });
    },
  });
}

// ============================================================
// Project Updates
// ============================================================

export function useProjectUpdates(projectId: string) {
  return useQuery({
    queryKey: PROJECT_UPDATES_KEY(projectId),
    queryFn: async () => {
      const { data: raw, error } = await sb
        .from("project_updates")
        .select("*, author:profiles!author_id(display_name, handle, avatar_url)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const updates = (raw ?? []) as (Omit<ProjectUpdateRow, "author"> & {
        author: {
          display_name: string | null;
          handle: string | null;
          avatar_url: string | null;
        } | null;
      })[];

      return updates.map((u): ProjectUpdateRow => ({
        id: u.id,
        project_id: u.project_id,
        author_id: u.author_id,
        title: u.title,
        body: u.body,
        week_number: u.week_number,
        created_at: u.created_at,
        author: u.author ?? {
          display_name: "Unknown",
          handle: "unknown",
          avatar_url: null,
        },
      }));
    },
    enabled: !!projectId,
  });
}

export function useCreateProjectUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      title: string;
      body: string;
      week_number?: number;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await sb
        .from("project_updates")
        .insert({
          project_id: input.projectId,
          author_id: user.id,
          title: input.title,
          body: input.body,
          week_number: input.week_number ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-publish to community feed as a project_update post — but never
      // for private projects: their updates stay inside the project.
      const { data: projRow } = await sb
        .from("projects")
        .select("visibility")
        .eq("id", input.projectId)
        .maybeSingle();
      if (projRow?.visibility !== "private") {
        try {
          await sb.from("posts").insert({
            author_id: user.id,
            type: "project_update",
            title: input.title,
            body: input.body,
            community: "Projects",
            project_data: {
              project_id: input.projectId,
              week_number: input.week_number ?? null,
            },
          });
        } catch {
          // Non-fatal — community post is a bonus, not a requirement
        }
      }

      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: PROJECT_UPDATES_KEY(variables.projectId) });
      qc.invalidateQueries({ queryKey: PROJECT_ACTIVITY_KEY(variables.projectId) });
    },
  });
}

export function useDeleteProjectUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; projectId: string }) => {
      const { error } = await sb.from("project_updates").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: PROJECT_UPDATES_KEY(variables.projectId) });
    },
  });
}

// ============================================================
// Discussions
// ============================================================

export function useDiscussions(projectId: string) {
  return useQuery({
    queryKey: DISCUSSIONS_KEY(projectId),
    queryFn: async () => {
      const { data: raw, error } = await sb
        .from("project_discussions")
        .select("*, author:profiles!author_id(display_name, handle, avatar_url)")
        .eq("project_id", projectId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      const discussions = (raw ?? []) as (Omit<DiscussionRow, "author" | "reply_count"> & {
        author: {
          display_name: string | null;
          handle: string | null;
          avatar_url: string | null;
        } | null;
      })[];

      // Fetch reply counts (can't be joined via PostgREST — requires aggregation)
      const discussionIds = discussions.map((d) => d.id);
      const { data: replyCounts } = await sb
        .from("discussion_replies")
        .select("discussion_id")
        .in("discussion_id", discussionIds);

      const countMap = new Map<string, number>();
      for (const r of (replyCounts ?? []) as { discussion_id: string }[]) {
        countMap.set(r.discussion_id, (countMap.get(r.discussion_id) ?? 0) + 1);
      }

      return discussions.map((d): DiscussionRow => ({
        id: d.id,
        project_id: d.project_id,
        author_id: d.author_id,
        title: d.title,
        body: d.body,
        category: d.category,
        is_pinned: d.is_pinned,
        community_post_id: d.community_post_id,
        created_at: d.created_at,
        updated_at: d.updated_at,
        author: d.author ?? {
          display_name: "Unknown",
          handle: "unknown",
          avatar_url: null,
        },
        reply_count: countMap.get(d.id) ?? 0,
      }));
    },
    enabled: !!projectId,
  });
}

export function useCreateDiscussion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      title: string;
      body: string;
      category?: DiscussionRow["category"];
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await sb
        .from("project_discussions")
        .insert({
          project_id: input.projectId,
          author_id: user.id,
          title: input.title,
          body: input.body,
          category: input.category ?? "general",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: DISCUSSIONS_KEY(variables.projectId) });
      qc.invalidateQueries({ queryKey: PROJECT_ACTIVITY_KEY(variables.projectId) });
    },
  });
}

export function useDeleteDiscussion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; projectId: string }) => {
      const { error } = await sb.from("project_discussions").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: DISCUSSIONS_KEY(variables.projectId) });
    },
  });
}

// ============================================================
// Discussion Replies
// ============================================================

export function useDiscussionReplies(discussionId: string) {
  return useQuery({
    queryKey: DISCUSSION_REPLIES_KEY(discussionId),
    queryFn: async () => {
      const { data: raw, error } = await sb
        .from("discussion_replies")
        .select("*, author:profiles!author_id(display_name, handle, avatar_url)")
        .eq("discussion_id", discussionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const replies = (raw ?? []) as (Omit<DiscussionReplyRow, "author"> & {
        author: {
          display_name: string | null;
          handle: string | null;
          avatar_url: string | null;
        } | null;
      })[];

      return replies.map((r): DiscussionReplyRow => ({
        id: r.id,
        discussion_id: r.discussion_id,
        author_id: r.author_id,
        body: r.body,
        created_at: r.created_at,
        author: r.author ?? {
          display_name: "Unknown",
          handle: "unknown",
          avatar_url: null,
        },
      }));
    },
    enabled: !!discussionId,
  });
}

export function useCreateDiscussionReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { discussionId: string; body: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await sb
        .from("discussion_replies")
        .insert({
          discussion_id: input.discussionId,
          author_id: user.id,
          body: input.body,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussion-replies"] });
    },
  });
}

// ============================================================
// Open Roles
// ============================================================

export function useOpenRoles(projectId: string) {
  return useQuery({
    queryKey: OPEN_ROLES_KEY(projectId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("project_open_roles")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
        .limit(20);

      if (error) throw error;
      return (data ?? []) as OpenRoleRow[];
    },
    enabled: !!projectId,
  });
}

export function useCreateOpenRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      title: string;
      description?: string;
      skills?: string[];
    }) => {
      const { data, error } = await sb
        .from("project_open_roles")
        .insert({
          project_id: input.projectId,
          title: input.title,
          description: input.description ?? null,
          skills: input.skills ?? [],
        })
        .select()
        .single();

      if (error) throw error;
      return data as OpenRoleRow;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: OPEN_ROLES_KEY(variables.projectId) });
    },
  });
}

export function useDeleteOpenRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; projectId: string }) => {
      const { error } = await sb.from("project_open_roles").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: OPEN_ROLES_KEY(variables.projectId) });
    },
  });
}

// ============================================================
// Project Needs ("need help now")
// ============================================================

export type ProjectNeedRow = {
  id: string;
  project_id: string;
  title: string;
  note: string | null;
  skill_id: string | null;
  urgency: "low" | "normal" | "high";
  is_filled: boolean;
  filled_by: string | null;
  created_at: string;
};

export const NEEDS_KEY = (projectId: string) => ["project-needs", projectId] as const;

const NEED_URGENCY_RANK: Record<ProjectNeedRow["urgency"], number> = {
  high: 0,
  normal: 1,
  low: 2,
};

export function useProjectNeeds(projectId: string) {
  return useQuery({
    queryKey: NEEDS_KEY(projectId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("project_needs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        // Table may not exist yet before the migration lands — return empty.
        if (error.code === "42P01") return [];
        throw error;
      }
      const rows = (data ?? []) as ProjectNeedRow[];
      return [...rows].sort((a, b) => {
        const rank = NEED_URGENCY_RANK[a.urgency] - NEED_URGENCY_RANK[b.urgency];
        if (rank !== 0) return rank;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    },
    enabled: !!projectId,
  });
}

export function useCreateProjectNeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      title: string;
      note?: string;
      skillId?: string | null;
      urgency?: ProjectNeedRow["urgency"];
    }) => {
      const { data, error } = await sb
        .from("project_needs")
        .insert({
          project_id: input.projectId,
          title: input.title,
          note: input.note ?? null,
          skill_id: input.skillId ?? null,
          urgency: input.urgency ?? "normal",
        })
        .select()
        .single();

      if (error) throw error;
      return data as ProjectNeedRow;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: NEEDS_KEY(variables.projectId) });
    },
  });
}

export function useFillProjectNeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; projectId: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await sb
        .from("project_needs")
        .update({ is_filled: true, filled_by: user.id })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: NEEDS_KEY(variables.projectId) });
      qc.invalidateQueries({ queryKey: PROJECT_ACTIVITY_KEY(variables.projectId) });
    },
  });
}

export function useDeleteProjectNeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; projectId: string }) => {
      const { error } = await sb.from("project_needs").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: NEEDS_KEY(variables.projectId) });
    },
  });
}

// ============================================================
// Project Activity (trigger-recorded events)
// ============================================================

export type ProjectActivityRow = {
  id: string;
  project_id: string;
  actor_id: string | null;
  kind: "update" | "milestone_done" | "discussion" | "repo_linked" | "file_added" | string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor?: { display_name: string | null; handle: string | null; avatar_url: string | null } | null;
};

export function useProjectActivity(projectId: string) {
  return useQuery({
    queryKey: PROJECT_ACTIVITY_KEY(projectId),
    queryFn: async () => {
      const { data: raw, error } = await sb
        .from("project_activity")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      const rows = (raw ?? []) as Omit<ProjectActivityRow, "actor">[];

      const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((a): a is string => !!a))];
      const { data: profiles } =
        actorIds.length > 0
          ? await supabase
              .from("profiles")
              .select("id, display_name, handle, avatar_url")
              .in("id", actorIds)
          : { data: [] };

      const profileMap = new Map<string, NonNullable<ProjectActivityRow["actor"]>>(
        (profiles ?? []).map((p) => [p.id, p]),
      );

      return rows.map((r): ProjectActivityRow => ({
        ...r,
        actor: r.actor_id ? (profileMap.get(r.actor_id) ?? null) : null,
      }));
    },
    enabled: !!projectId,
  });
}

// ============================================================
// Role Applications — Accept / Decline
// ============================================================

export function useAcceptRoleApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      applicationId: string;
      profileId: string;
      roleId: string;
      projectId: string;
    }) => {
      const { error } = await sb.rpc("accept_project_role_application", {
        p_application_id: input.applicationId,
        p_profile_id: input.profileId,
        p_role_id: input.roleId,
        p_project_id: input.projectId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["role-applications", variables.roleId] });
      qc.invalidateQueries({ queryKey: OPEN_ROLES_KEY(variables.projectId) });
      qc.invalidateQueries({ queryKey: PROJECT_KEY(variables.projectId) });
      // Accepting fires both the contributor-joined and role-filled triggers,
      // so the Activity timeline must re-sync.
      qc.invalidateQueries({ queryKey: PROJECT_ACTIVITY_KEY(variables.projectId) });
      // Applicant's dashboard, the explore opportunities feed, and the
      // accepted user's shelf "Contributing" badge re-sync.
      qc.invalidateQueries({ queryKey: ["my-applications"] });
      qc.invalidateQueries({ queryKey: ["my-role-applications"] });
      qc.invalidateQueries({ queryKey: ["explore-opportunities"] });
      qc.invalidateQueries({ queryKey: ["explore-contributors"] });
      toast.success("Application accepted");
    },
  });
}

export function useDeclineRoleApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { applicationId: string; roleId: string; projectId: string }) => {
      const { error } = await sb.rpc("decline_project_role_application", {
        p_application_id: input.applicationId,
        p_role_id: input.roleId,
        p_project_id: input.projectId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["role-applications", variables.roleId] });
      qc.invalidateQueries({ queryKey: OPEN_ROLES_KEY(variables.projectId) });
      // Applicant's dashboard + explore opportunities feed re-sync.
      qc.invalidateQueries({ queryKey: ["my-applications"] });
      qc.invalidateQueries({ queryKey: ["my-role-applications"] });
      toast.success("Application declined");
    },
  });
}

// ============================================================
// My Projects (for project picker)
// ============================================================

export function useMyProjects() {
  return useQuery({
    queryKey: ["my-projects"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await sb
        .from("projects")
        .select("id, title, description, status, stage, cover_url")
        .eq("profile_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data ?? []) as {
        id: string;
        title: string;
        description: string | null;
        status: string;
        stage: string;
        cover_url: string | null;
      }[];
    },
    staleTime: 30_000,
  });
}

// ============================================================
// Project Content (gallery + resources)
// ============================================================

// The project-detail query cache shape (matches the route's queryFn return).
type ProjectDetailCache = {
  project: ProjectDetail;
  contributors: unknown[];
  skills: unknown[];
  coverSigned: string | null;
  avatarSigned: Record<string, string>;
};

export function useUpdateProjectPresentation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      presentationPreset: ProjectPresentationPreset;
    }) => {
      const { error } = await sb
        .from("projects")
        .update({ presentation_preset: input.presentationPreset })
        .eq("id", input.projectId);
      if (error) throw error;
    },
    onMutate: async (input) => {
      const key = PROJECT_KEY(input.projectId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ProjectDetailCache>(key);
      qc.setQueryData<ProjectDetailCache>(key, (old) =>
        old
          ? {
              ...old,
              project: { ...old.project, presentation_preset: input.presentationPreset },
            }
          : old,
      );
      return { previous };
    },
    onError: (_error, input, context) => {
      if (context?.previous) qc.setQueryData(PROJECT_KEY(input.projectId), context.previous);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: PROJECT_KEY(input.projectId) });
    },
  });
}

export function useUpdateProjectContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      gallery?: GalleryItem[];
      resources?: ResourceItem[];
    }) => {
      const updates: { gallery?: GalleryItem[]; resources?: ResourceItem[] } = {};
      if (input.gallery !== undefined) updates.gallery = input.gallery;
      if (input.resources !== undefined) updates.resources = input.resources;
      if (Object.keys(updates).length === 0) return;

      const { error } = await sb.from("projects").update(updates).eq("id", input.projectId);
      if (error) throw error;
    },
    // Optimistic write so the UI updates instantly and the heavy project-detail
    // refetch (signed URLs, skills, contributors) isn't needed just for this.
    onMutate: async (input) => {
      const key = PROJECT_KEY(input.projectId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ProjectDetailCache>(key);
      if (!previous) return { previous: undefined };
      qc.setQueryData<ProjectDetailCache>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          project: {
            ...old.project,
            ...(input.gallery !== undefined ? { gallery: input.gallery } : {}),
            ...(input.resources !== undefined ? { resources: input.resources } : {}),
          },
        };
      });
      return { previous };
    },
    // Roll back only the field this write touched so a concurrent edit on the
    // other field isn't clobbered by a stale full snapshot.
    onError: (_err, input, context) => {
      if (!context?.previous) return;
      qc.setQueryData<ProjectDetailCache>(PROJECT_KEY(input.projectId), (old) => {
        if (!old) return old;
        return {
          ...old,
          project: {
            ...old.project,
            ...(input.gallery !== undefined ? { gallery: context.previous!.project.gallery } : {}),
            ...(input.resources !== undefined
              ? { resources: context.previous!.project.resources }
              : {}),
          },
        };
      });
    },
    // Background refetch keeps the server as source of truth once the write lands.
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: PROJECT_KEY(variables.projectId) });
    },
  });
}

// ============================================================
// Project README + tools
// ============================================================

export function useUpdateProjectReadme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { projectId: string; readme?: string | null; tools?: string[] }) => {
      const updates: { readme?: string | null; tools?: string[] } = {};
      if (input.readme !== undefined) updates.readme = input.readme;
      if (input.tools !== undefined) updates.tools = input.tools;
      if (Object.keys(updates).length === 0) return;

      const { error } = await sb.from("projects").update(updates).eq("id", input.projectId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: PROJECT_KEY(variables.projectId) });
    },
  });
}

// ============================================================
// Project Stage
// ============================================================

export function useUpdateProjectStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { projectId: string; stage: ProjectStage }) => {
      const { error } = await sb
        .from("projects")
        .update({ stage: input.stage })
        .eq("id", input.projectId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: PROJECT_KEY(variables.projectId) });
      toast.success(`Stage updated to ${variables.stage}`);
    },
  });
}
