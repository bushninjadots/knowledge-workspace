// ── Templates Hook ────────────────────────────────────────────────────────────
// Templates are layouts with `is_template = true`. This module provides:
//   • useProjectReturnChanges — flag the "your changes" prompts for a returned project.
//   • useUpdateProjectDirection — set a project's collaboration direction.
//   • usePublicTemplates — browse all published templates (with search/filter).
//   • useTemplate — fetch a single template by ID.
//   • useApplyTemplate — copy a template's sections to a page's layout + bump usage.
//   • useUnpublishTemplate — unmark a template (sets is_template = false).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import type { Database, Json } from "@/integrations/supabase/types";
import type { TemplateData, LayoutSection } from "@/lib/page-blocks";
import { invalidatePage } from "@/hooks/use-page";

// ── Row mappers ──────────────────────────────────────────────────────────────

type LayoutRow = Database["public"]["Tables"]["layouts"]["Row"];

type LayoutRowSubset = Omit<LayoutRow, "is_template">;

function mapLayoutRow(row: LayoutRowSubset): TemplateData {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    type: row.type as TemplateData["type"],
    category: row.category ?? null,
    sections: (row.sections ?? []) as unknown as LayoutSection[],
    themeTokens: null,
    themeId: row.theme_id ?? null,
    createdBy: row.created_by ?? null,
    creatorHandle: null,
    creatorDisplayName: null,
    usageCount: row.usage_count ?? 0,
    forkCount: row.fork_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────

const TEMPLATE_SELECT =
  "id, name, description, type, category, sections, theme_id, created_by, usage_count, fork_count, created_at, updated_at";

interface UsePublicTemplatesParams {
  /** Filter by category. */
  category?: string;
  /** Search by name. */
  search?: string;
  /** Sort mode. */
  sort?: "popular" | "newest";
}

/** Fetch all public templates, optionally filtered. */
export function usePublicTemplates(params: UsePublicTemplatesParams = {}) {
  const { category, search, sort = "newest" } = params;

  return useQuery({
    queryKey: ["templates", "public", params],
    queryFn: async (): Promise<TemplateData[]> => {
      let query = supabase.from("layouts").select(TEMPLATE_SELECT).eq("is_template", true);

      if (category) query = query.eq("category", category);
      if (search) query = query.ilike("name", `%${search}%`);

      query = query.order(sort === "popular" ? "usage_count" : "created_at", {
        ascending: false,
      });
      query = query.limit(50);

      const { data, error } = await query;
      if (error) throw error;

      // Fetch creator profiles separately.
      const rows: TemplateData[] = (data ?? []).map(mapLayoutRow);

      // Batch-fetch creator profiles for display names.
      const creatorIds = [
        ...new Set(rows.map((r) => r.createdBy).filter((id): id is string => !!id)),
      ];
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, handle, display_name")
          .in("id", creatorIds);
        if (profiles) {
          const profileMap = new Map(profiles.map((p) => [p.id, p]));
          for (const row of rows) {
            const profile = row.createdBy ? profileMap.get(row.createdBy) : undefined;
            if (profile) {
              row.creatorHandle = profile.handle ?? null;
              row.creatorDisplayName = profile.display_name ?? null;
            }
          }
        }
      }

      return rows;
    },
    staleTime: 2 * 60 * 1000,
  });
}

/** Fetch a single template by ID, with creator profile joined. */
export function useTemplate(templateId: string) {
  return useQuery({
    queryKey: ["templates", templateId],
    queryFn: async (): Promise<TemplateData | null> => {
      // Fetch layout.
      const { data, error } = await supabase
        .from("layouts")
        .select(TEMPLATE_SELECT)
        .eq("id", templateId)
        .eq("is_template", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const row = mapLayoutRow(data);

      // Fetch creator profile if available.
      if (data.created_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("handle, display_name")
          .eq("id", data.created_by)
          .maybeSingle();
        if (profile) {
          row.creatorHandle = profile.handle ?? null;
          row.creatorDisplayName = profile.display_name ?? null;
        }
      }

      return row;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!templateId,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Unmark a template (revert to private layout). */
export function useUnpublishTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ layoutId }: { layoutId: string }) => {
      const { error } = await supabase
        .from("layouts")
        .update({ is_template: false })
        .eq("id", layoutId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template unpublished");
    },
    onError: (err) => {
      toast.error(friendlyError(err, "Failed to unpublish"));
    },
  });
}

interface ApplyTemplateParams {
  templateId: string;
  /** Destination page and layout are optional so callers can apply to a fresh profile Studio. */
  pageId?: string;
  layoutId?: string;
  ownerId?: string;
  ownerType?: "profile" | "project";
}

/** Copy a template's sections into a page's layout and bump usage count. */
export function useApplyTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, pageId, layoutId }: ApplyTemplateParams) => {
      let destinationPageId = pageId;
      let destinationLayoutId = layoutId;

      if (!destinationPageId || !destinationLayoutId) {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) throw new Error("You must be signed in to apply a template.");
        const { data: destination, error: destinationError } = await supabase
          .from("pages")
          .select("id, layout_id")
          .eq("owner_id", user.id)
          .eq("owner_type", "profile")
          .maybeSingle();
        if (destinationError) throw destinationError;
        if (!destination?.id || !destination.layout_id) {
          throw new Error("Open your Studio once before applying a template.");
        }
        destinationPageId = destination.id;
        destinationLayoutId = destination.layout_id;
      }

      // 1. Fetch the template's sections and theme.
      const { data: template, error: fetchErr } = await supabase
        .from("layouts")
        .select("sections, theme_id")
        .eq("id", templateId)
        .single();

      if (fetchErr) throw fetchErr;

      const sections: LayoutSection[] = (
        (template?.sections ?? []) as unknown as LayoutSection[]
      ).map((s: LayoutSection) => ({
        ...s,
        blocks: s.blocks.map((b) => ({ ...b, config: { ...b.config } })),
      }));

      // 2. Write sections into the destination layout.
      const { error: updateErr } = await supabase
        .from("layouts")
        .update({
          sections:
            sections as unknown as Database["public"]["Tables"]["layouts"]["Update"]["sections"],
        })
        .eq("id", destinationLayoutId);

      if (updateErr) throw updateErr;

      // 3. Apply the template's theme to the page if it has one. Clear stale
      // per-page overrides so the template's theme renders itself, not leftover
      // customizations from whatever theme was active before.
      if (template?.theme_id) {
        await supabase
          .from("pages")
          .update({ theme_id: template.theme_id, theme_overrides: null as unknown as Json })
          .eq("id", destinationPageId);
      }

      // 4. Bump template usage count.
      try {
        await supabase.rpc("increment_usage_count", { template_id: templateId });
      } catch {
        // Non-critical — don't fail the whole operation.
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      if (vars.ownerId && vars.ownerType) {
        invalidatePage(qc, vars.ownerId, vars.ownerType);
      } else {
        qc.invalidateQueries({ queryKey: ["page"] });
      }
      toast.success("Template applied");
    },
    onError: (err) => {
      toast.error(friendlyError(err, "Failed to apply template"));
    },
  });
}
