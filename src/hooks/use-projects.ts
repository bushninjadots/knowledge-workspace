import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Until Supabase types are regenerated after migration, cast new tables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ============================================================
// Types
// ============================================================

export type ProjectStage = "planning" | "building" | "testing" | "launch" | "growing";

export type ProjectDetail = {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  goal: string | null;
  vision: string | null;
  status: "planning" | "active" | "paused" | "completed";
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
  created_at: string;
  updated_at: string;
};

export type GalleryItem = { url: string; caption?: string; type: "image" | "video" };
export type ResourceItem = { title: string; url: string; type: "article" | "tool" | "video" | "doc" | "other" };

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
export const DISCUSSION_REPLIES_KEY = (discussionId: string) => ["discussion-replies", discussionId] as const;
export const OPEN_ROLES_KEY = (projectId: string) => ["open-roles", projectId] as const;

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
        .order("position", { ascending: true });

      if (error) throw error;
      return (data ?? []) as MilestoneRow[];
    },
    enabled: !!projectId,
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { projectId: string; title: string; description?: string; due_date?: string }) => {
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
    mutationFn: async (input: { id: string; projectId: string; title?: string; description?: string; status?: MilestoneRow["status"]; due_date?: string; position?: number }) => {
      const { id, projectId, ...updates } = input;
      const { error } = await sb
        .from("project_milestones")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: MILESTONES_KEY(variables.projectId) });
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
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const updates = (raw ?? []) as Omit<ProjectUpdateRow, "author">[];

      const authorIds = [...new Set(updates.map((u) => u.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_url")
        .in("id", authorIds);

      const profileMap = new Map<string, Record<string, unknown>>(
        (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return updates.map((u): ProjectUpdateRow => ({
        ...u,
        author: (profileMap.get(u.author_id) as unknown as ProjectUpdateRow["author"]) ?? {
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
    mutationFn: async (input: { projectId: string; title: string; body: string; week_number?: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
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

      // Auto-publish to community feed as a project_update post
      await sb
        .from("posts")
        .insert({
          author_id: user.id,
          type: "project_update",
          title: input.title,
          body: input.body,
          community: "Projects",
          project_data: {
            project_id: input.projectId,
            week_number: input.week_number ?? null,
          },
        })
        .then(() => {})
        .catch(() => {
          // Non-fatal — community post is a bonus, not a requirement
        });

      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: PROJECT_UPDATES_KEY(variables.projectId) });
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
        .select("*")
        .eq("project_id", projectId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      const discussions = (raw ?? []) as Omit<DiscussionRow, "author" | "reply_count">[];

      const authorIds = [...new Set(discussions.map((d) => d.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_url")
        .in("id", authorIds);

      const profileMap = new Map<string, Record<string, unknown>>(
        (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      // Fetch reply counts
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
        ...d,
        author: (profileMap.get(d.author_id) as unknown as DiscussionRow["author"]) ?? {
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
    mutationFn: async (input: { projectId: string; title: string; body: string; category?: DiscussionRow["category"] }) => {
      const { data: { user } } = await supabase.auth.getUser();
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
        .select("*")
        .eq("discussion_id", discussionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const replies = (raw ?? []) as Omit<DiscussionReplyRow, "author">[];

      const authorIds = [...new Set(replies.map((r) => r.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_url")
        .in("id", authorIds);

      const profileMap = new Map<string, Record<string, unknown>>(
        (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return replies.map((r): DiscussionReplyRow => ({
        ...r,
        author: (profileMap.get(r.author_id) as unknown as DiscussionReplyRow["author"]) ?? {
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
      const { data: { user } } = await supabase.auth.getUser();
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
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as OpenRoleRow[];
    },
    enabled: !!projectId,
  });
}

export function useCreateOpenRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { projectId: string; title: string; description?: string; skills?: string[] }) => {
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
    },
  });
}
