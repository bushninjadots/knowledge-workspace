import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectPresentationPreset } from "@/lib/project-presentation";
import type { GithubDisplay } from "@/lib/github";

const sb = supabase;

import {
  PROJECT_KEY,
  MILESTONES_KEY,
  PROJECT_UPDATES_KEY,
  PROJECT_ACTIVITY_KEY,
} from "./project-keys";

export { PROJECT_KEY } from "./project-keys";
export * from "./use-project-discussions";
export * from "./use-project-roles";
export * from "./use-project-content";

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

export type Contributor = {
  profile_id: string;
  role: "creator" | "contributor" | "mentor";
  contribution_score: number;
  skills_used: string[];
  profile: {
    id: string;
    handle: string | null;
    display_name: string | null;
    creator_title: string | null;
    avatar_url: string | null;
  } | null;
};

export type ProjectDetail = {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  goal: string | null;
  vision: string | null;
  status: "planning" | "active" | "paused" | "completed";
  visibility: "public" | "private" | "crew" | "people";
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
  github_display?: GithubDisplay | null;
  /** Owner opt-in: whether others may fork this project. */
  allow_forks?: boolean;
  /** The project this one was forked from, if any. */
  forked_from_project_id?: string | null;
  /** How many times this project has been forked. */
  fork_count?: number;
  /** Owner self-report: whether this project was built with AI assistance. */
  ai_assisted?: boolean;
  /** Release countdown (20261014200000): when, where to get it, and whether
   *  it's listed in Explore. */
  release_at?: string | null;
  release_note?: string | null;
  release_links?: Record<string, string> | null;
  release_public?: boolean;
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
        .order("created_at", { ascending: false })
        .limit(50);

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

      // Auto-publish to community feed as a project_update post — public
      // projects only: private, crew-only and shared projects keep their
      // updates inside the project.
      const { data: projRow } = await sb
        .from("projects")
        .select("visibility")
        .eq("id", input.projectId)
        .maybeSingle();
      if (projRow?.visibility === "public") {
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
// Community AI tagging
// ============================================================

/** Threshold: how many community tags are needed before the "community-flagged"
 * badge surfaces without the owner's self-report. */
export const AI_COMMUNITY_THRESHOLD = 3;

/**
 * Toggle the current user's community AI-assisted tag on a project. Inserting
 * tags the project; deleting removes the tag. The mutation optimistically
 * flips the local state and rolls back on error.
 */
export function useToggleAiTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { projectId: string; tagged: boolean }) => {
      if (input.tagged) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const { error } = await supabase
          .from("project_ai_tags")
          .insert({ project_id: input.projectId, tagger_id: user.id });
        if (error) throw error;
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const { error } = await supabase
          .from("project_ai_tags")
          .delete()
          .eq("project_id", input.projectId)
          .eq("tagger_id", user.id);
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: PROJECT_KEY(variables.projectId) });
    },
  });
}

// ============================================================
// Forking
// ============================================================

/**
 * Fork a project into a private draft owned by the current user. The database
 * copies the project's content and records the lineage; this just returns the
 * new project id so the caller can navigate to it.
 */
export function useForkProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { projectId: string }) => {
      const { data, error } = await supabase.rpc("fork_project", {
        p_project_id: input.projectId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_newId, variables) => {
      qc.invalidateQueries({ queryKey: PROJECT_KEY(variables.projectId) });
      qc.invalidateQueries({ queryKey: ["my-projects"] });
      qc.invalidateQueries({ queryKey: ["current-user"] });
    },
  });
}

/**
 * Fetch the public projects that forked from this one, so the project graph
 * can show derivative lineage (spec §6). Only public projects are returned —
 * private forks must not leak through the graph (spec §29).
 */
export function useProjectForks(projectId: string) {
  return useQuery({
    queryKey: ["project-forks", projectId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("projects")
        .select("id, title, description")
        .eq("forked_from_project_id", projectId)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data ?? []) as { id: string; title: string; description: string | null }[];
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

// ============================================================
// Project Stage
