// Project roles and needs: open roles, "need help now" asks, and accepting or
// declining applications.
// Re-exported from use-projects.ts, so callers keep importing from there.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PROJECT_KEY, OPEN_ROLES_KEY, PROJECT_ACTIVITY_KEY } from "./project-keys";
import type { OpenRoleRow } from "./use-projects";

const sb = supabase;

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

const NEEDS_KEY = (projectId: string) => ["project-needs", projectId] as const;

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
    /** `filled: false` reopens a need (the undo for an accidental fill). */
    mutationFn: async (input: { id: string; projectId: string; filled?: boolean }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const filled = input.filled ?? true;
      const { error } = await sb
        .from("project_needs")
        .update({ is_filled: filled, filled_by: filled ? user.id : null })
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
