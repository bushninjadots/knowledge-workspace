// ── Templates Hook ────────────────────────────────────────────────────────────
// Templates are layouts with `is_template = true`. This module provides:
//   • useMyTemplates — templates the current user has published.
//   • usePublicTemplates — browse all published templates (with search/filter).
//   • useTemplate — fetch a single template by ID.
//   • useSaveAsTemplate — mark an existing layout as a template.
//   • useApplyTemplate — copy a template's sections to a page's layout + bump usage.
//   • useUnpublishTemplate — unmark a template (sets is_template = false).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import type { Database } from "@/integrations/supabase/types";
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

/** Fetch the current user's own templates. */
export function useMyTemplates() {
  return useQuery({
    queryKey: ["templates", "mine"],
    queryFn: async (): Promise<TemplateData[]> => {
      const { data, error } = await supabase
        .from("layouts")
        .select(TEMPLATE_SELECT)
        .eq("is_template", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(mapLayoutRow);
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

interface SaveAsTemplateParams {
  layoutId: string;
  name: string;
  description?: string;
  category?: string;
}

/** Create a duplicate layout and mark it as a public template. The original
 * page layout stays private — only the copy becomes a template. */
export function useSaveAsTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ layoutId, name, description, category }: SaveAsTemplateParams) => {
      // 1. Fetch the current layout's sections.
      const { data: source, error: fetchErr } = await supabase
        .from("layouts")
        .select("sections, created_by")
        .eq("id", layoutId)
        .single();
      if (fetchErr) throw fetchErr;

      // 2. Create a NEW layout row (a copy) marked as a template,
      //    carrying the page's current theme ID.
      const { data: pageForTheme } = await supabase
        .from("pages")
        .select("theme_id")
        .eq("layout_id", layoutId)
        .maybeSingle();

      // created_by MUST be auth.uid() — RLS requires auth.uid() = created_by
      // for INSERT. Copying source.created_by fails when source has null.
      const me = (await supabase.auth.getUser()).data.user;
      const { error: insertErr } = await supabase.from("layouts").insert({
        name,
        description: description ?? null,
        type: "standard",
        category: category ?? null,
        sections:
          source.sections as unknown as Database["public"]["Tables"]["layouts"]["Insert"]["sections"],
        theme_id: pageForTheme?.theme_id ?? null,
        is_template: true,
        created_by: me?.id ?? null,
      });
      if (insertErr) throw insertErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template published");
    },
    onError: (err) => {
      toast.error(friendlyError(err, "Failed to publish template"));
    },
  });
}

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
  pageId: string;
  layoutId: string;
  ownerId: string;
  ownerType: "profile" | "project";
}

/** Copy a template's sections into a page's layout and bump usage count. */
export function useApplyTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, pageId, layoutId }: ApplyTemplateParams) => {
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
        .eq("id", layoutId);

      if (updateErr) throw updateErr;

      // 3. Apply the template's theme to the page if it has one.
      if (template?.theme_id) {
        await supabase.from("pages").update({ theme_id: template.theme_id }).eq("id", pageId);
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
      invalidatePage(qc, vars.ownerId, vars.ownerType);
      toast.success("Template applied");
    },
    onError: (err) => {
      toast.error(friendlyError(err, "Failed to apply template"));
    },
  });
}
