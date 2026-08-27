import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  CollaborationBrief,
  ProjectLineage,
  ProjectRecognition,
  ProjectSeason,
} from "@/hooks/use-projects";

const PROJECT_LOOP_KEY = (projectId: string) => ["project-loop", projectId] as const;
export const PROJECT_RETURN_KEY = ["project-return-changes"] as const;

export type EvidenceShelfItem = {
  project_id: string;
  title: string;
  note?: string | null;
  url?: string | null;
  kind?: "project" | "image" | "video" | "link";
};

export type ProjectContributionInput = {
  projectId: string;
  title: string;
  body: string;
  evidenceUrl?: string | null;
  evidenceKind?: "image" | "video" | "link" | "file" | null;
  entryKind?: "contribution" | "weekly_prompt";
  promptId?: string | null;
};

export function useUpdateEvidenceShelf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { profileId: string; items: EvidenceShelfItem[] }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ evidence_shelf: input.items.slice(0, 6) })
        .eq("id", input.profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-profile"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
    },
  });
}

export function useUpdateProjectDirection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      season: ProjectSeason;
      brief: CollaborationBrief;
      lineage: ProjectLineage;
    }) => {
      const { error } = await supabase
        .from("projects")
        .update({
          season: input.season,
          collaboration_brief: input.brief,
          lineage: input.lineage,
        })
        .eq("id", input.projectId);
      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ["project-detail", input.projectId] });
      queryClient.invalidateQueries({ queryKey: PROJECT_RETURN_KEY });
    },
  });
}

export function useCreateProjectContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProjectContributionInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const metadata = {
        evidence_url: input.evidenceUrl ?? null,
        evidence_kind: input.evidenceKind ?? null,
        entry_kind: input.entryKind ?? "contribution",
        prompt_id: input.promptId ?? null,
      };
      const { data, error } = await supabase
        .from("project_activity")
        .insert({
          project_id: input.projectId,
          actor_id: user.id,
          kind: input.entryKind ?? "contribution",
          title: input.title.trim(),
          body: input.body.trim(),
          metadata,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ["project-activity", input.projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-detail", input.projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-credits", input.projectId] });
      queryClient.invalidateQueries({ queryKey: ["studio-credits"] });
      queryClient.invalidateQueries({ queryKey: ["reputation-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["contribution-log"] });
      queryClient.invalidateQueries({ queryKey: ["public-profile"] });
      queryClient.invalidateQueries({ queryKey: PROJECT_RETURN_KEY });
    },
  });
}

export function useProjectWatchStatus(projectId: string) {
  return useQuery({
    queryKey: [...PROJECT_LOOP_KEY(projectId), "watch"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;
      const { data, error } = await supabase
        .from("project_watchers")
        .select("project_id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error?.code === "42P01") return false;
      if (error) throw error;
      return !!data;
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useToggleProjectWatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { projectId: string; watching: boolean }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (input.watching) {
        const { error } = await supabase
          .from("project_watchers")
          .upsert({ project_id: input.projectId, user_id: user.id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_watchers")
          .delete()
          .eq("project_id", input.projectId)
          .eq("user_id", user.id);
        if (error) throw error;
      }
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: [...PROJECT_LOOP_KEY(input.projectId), "watch"] });
      queryClient.invalidateQueries({ queryKey: PROJECT_RETURN_KEY });
    },
  });
}

export function useMarkProjectVisited() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      // Visiting and watching are separate choices. A visit only updates the
      // private last-seen cursor; the explicit Watch action controls the
      // member's return shelf.
      const { error } = await supabase.from("project_visits").upsert({
        project_id: projectId,
        user_id: user.id,
        last_seen_at: new Date().toISOString(),
      });
      if (error && error.code !== "42P01") throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_RETURN_KEY });
    },
  });
}

export type ReturnChange = {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  kind: string;
  createdAt: string;
  body: string | null;
};

export function useProjectReturnChanges(limit = 8) {
  return useQuery({
    queryKey: [...PROJECT_RETURN_KEY, limit],
    queryFn: async (): Promise<ReturnChange[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: watched, error: watcherError } = await supabase
        .from("project_watchers")
        .select("project_id")
        .eq("user_id", user.id)
        .limit(20);
      if (watcherError || !watched?.length) return [];
      const projectIds = watched.map((row) => row.project_id);
      const { data: visits } = await supabase
        .from("project_visits")
        .select("project_id, last_seen_at")
        .eq("user_id", user.id)
        .in("project_id", projectIds);
      const seenAt = new Map((visits ?? []).map((row) => [row.project_id, row.last_seen_at]));
      const { data: projects } = await supabase
        .from("projects")
        .select("id, title")
        .in("id", projectIds);
      const titles = new Map((projects ?? []).map((row) => [row.id, row.title]));

      const results = await Promise.all(
        projectIds.map(async (projectId) => {
          let query = supabase
            .from("project_activity")
            .select("id, project_id, title, kind, body, created_at")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .limit(6);
          const lastSeen = seenAt.get(projectId);
          if (lastSeen) query = query.gt("created_at", lastSeen);
          const { data } = await query;
          return (data ?? []).map((row) => ({
            id: row.id,
            projectId: row.project_id,
            projectTitle: titles.get(row.project_id) ?? "Project",
            title: row.title,
            kind: row.kind,
            createdAt: row.created_at,
            body: row.body,
          }));
        }),
      );
      return results
        .flat()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);
    },
    staleTime: 30_000,
  });
}

export function useRecognizeProjectActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectActivityId: string;
      projectId: string;
      recipientId: string;
      kind:
        | "helpful_feedback"
        | "strong_iteration"
        | "great_collaborator"
        | "shipped_real"
        | "made_clearer";
    }): Promise<ProjectRecognition> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("project_recognitions")
        .insert({
          project_activity_id: input.projectActivityId,
          project_id: input.projectId,
          giver_id: user.id,
          recipient_id: input.recipientId,
          kind: input.kind,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ProjectRecognition;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["project-recognitions", input.projectActivityId],
      });
      queryClient.invalidateQueries({ queryKey: ["public-profile"] });
    },
  });
}

export const RECOGNITION_LABELS = {
  helpful_feedback: "Helpful feedback",
  strong_iteration: "Strong iteration",
  great_collaborator: "Great collaborator",
  shipped_real: "Shipped something real",
  made_clearer: "Made the project clearer",
} as const;
