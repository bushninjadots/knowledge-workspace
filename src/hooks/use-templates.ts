// ── Community Template Hooks ──────────────────────────────────────────────────
// Templates are layouts with `is_template = true` — structure (sections +
// optional theme), never private content. Rebuilt (2026-09) inside the Studio:
// browse happens in the Templates dialog, application flows through the
// Studio's own commit/undo path (see lib/template-apply.ts), and the fork is
// what persists a copy to the member's account.
//
//   • usePublicTemplates — browse published templates (search + sort).
//   • useMyTemplates     — the member's own templates and stashable forks.
//   • useForkTemplate    — copy a template into a new owned layout + record
//                          the fork + bump the parent's fork_count.
//   • usePublishTemplate — publish a member's own layout as a public template.
//   • useDeleteTemplate  — unpublish (is_template = false; the layout stays).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { sanitizeTemplateSections } from "@/lib/template-apply";
import { friendlyError } from "@/lib/error-message";

// ── Types ────────────────────────────────────────────────────────────────────

/** A community template as shown in the picker: structure + provenance. */
export interface CommunityTemplate {
  id: string;
  name: string;
  description: string | null;
  /** Browsing category ("minimal", "developer", "portfolio", …). */
  category: string | null;
  /** Raw sections JSON from the layout row — sanitize before rendering. */
  rawSections: unknown;
  themeId: string | null;
  createdBy: string | null;
  creatorHandle: string | null;
  creatorDisplayName: string | null;
  /** Whether this layout is one of the member's own (creator or fork owner). */
  isMine: boolean;
  /** When this layout is a fork: the id of the template it was forked from. */
  forkedFromId: string | null;
  usageCount: number;
  forkCount: number;
  updatedAt: string;
}

type LayoutRow = Database["public"]["Tables"]["layouts"]["Row"];

interface CreatorJoin {
  handle: string | null;
  display_name: string | null;
}

const TEMPLATE_SELECT =
  "id, name, description, category, sections, theme_id, created_by, usage_count, fork_count, updated_at";

function mapLayoutRow(
  row: Pick<
    LayoutRow,
    | "id"
    | "name"
    | "description"
    | "category"
    | "sections"
    | "theme_id"
    | "created_by"
    | "usage_count"
    | "fork_count"
    | "updated_at"
  >,
  creator: CreatorJoin | null,
  currentUserId: string | null,
): CommunityTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    category: row.category ?? null,
    rawSections: row.sections,
    themeId: row.theme_id ?? null,
    createdBy: row.created_by ?? null,
    creatorHandle: creator?.handle ?? null,
    creatorDisplayName: creator?.display_name ?? null,
    isMine: currentUserId != null && row.created_by === currentUserId,
    forkedFromId: null,
    usageCount: row.usage_count ?? 0,
    forkCount: row.fork_count ?? 0,
    updatedAt: row.updated_at,
  };
}

/** Batch-join creator profiles onto layout rows (one query, not N). */
async function joinCreators(
  rows: Array<Parameters<typeof mapLayoutRow>[0]>,
  currentUserId: string | null,
): Promise<CommunityTemplate[]> {
  const templates = rows.map((row) => mapLayoutRow(row, null, currentUserId));
  const creatorIds = [
    ...new Set(templates.map((t) => t.createdBy).filter((id): id is string => !!id)),
  ];
  if (creatorIds.length > 0) {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, handle, display_name")
      .in("id", creatorIds);
    if (error) throw error;
    const byId = new Map((profiles ?? []).map((p) => [p.id, p as CreatorJoin]));
    for (const template of templates) {
      const creator = template.createdBy ? byId.get(template.createdBy) : undefined;
      if (creator) {
        template.creatorHandle = creator.handle ?? null;
        template.creatorDisplayName = creator.display_name ?? null;
      }
    }
  }
  return templates;
}

// ── Queries ──────────────────────────────────────────────────────────────────

type TemplateSort = "newest" | "popular";

interface BrowseParams {
  search?: string;
  sort?: TemplateSort;
}

/**
 * Browse every published community template. Public read (layouts SELECT is
 * open to anon), so this works signed-out too — the picker renders previews
 * and provenance; mutations require auth.
 */
export function usePublicTemplates({ search, sort = "newest" }: BrowseParams = {}) {
  return useQuery({
    queryKey: ["templates", "public", { search, sort }],
    queryFn: async (): Promise<CommunityTemplate[]> => {
      const { data: auth } = await supabase.auth.getUser();
      const currentUserId = auth.user?.id ?? null;

      let query = supabase.from("layouts").select(TEMPLATE_SELECT).eq("is_template", true);
      if (search && search.trim().length > 0) {
        query = query.ilike("name", `%${search.trim()}%`);
      }
      query = query
        .order(sort === "popular" ? "usage_count" : "updated_at", { ascending: false })
        .limit(60);

      const { data, error } = await query;
      if (error) throw error;
      return joinCreators((data ?? []) as Array<Parameters<typeof mapLayoutRow>[0]>, currentUserId);
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * The member's own template-side layouts: templates they published plus forks
 * they saved. Forks are stored with `is_template = false` (a private stash),
 * so this query deliberately does NOT filter on the flag — and it joins the
 * forks table so the picker can mark the parent templates as already saved.
 */
export function useMyTemplates(enabled: boolean) {
  return useQuery({
    queryKey: ["templates", "mine"],
    enabled,
    queryFn: async (): Promise<CommunityTemplate[]> => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const currentUserId = auth.user?.id;
      if (!currentUserId) return [];

      const { data, error } = await supabase
        .from("layouts")
        .select(TEMPLATE_SELECT)
        .eq("created_by", currentUserId)
        .order("updated_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const rows = (data ?? []) as Array<Parameters<typeof mapLayoutRow>[0]>;
      const templates = await joinCreators(rows, currentUserId);
      if (templates.length === 0) return templates;

      // Join fork parents for the rows that are forks.
      const childIds = templates.map((t) => t.id);
      const { data: forkRows, error: forkError } = await supabase
        .from("forks")
        .select("parent_layout_id, child_layout_id")
        .in("child_layout_id", childIds);
      if (forkError) throw forkError;
      const parentByChild = new Map(
        (forkRows ?? []).map((f) => [f.child_layout_id as string, f.parent_layout_id as string]),
      );
      for (const template of templates) {
        template.forkedFromId = parentByChild.get(template.id) ?? null;
      }
      return templates;
    },
    staleTime: 60 * 1000,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

interface ForkTemplateParams {
  templateId: string;
  templateName: string;
}

/**
 * Fork a template: copy its structure into a NEW layout owned by the member
 * (unpublished — a private stash), record the fork, and bump the parent's
 * fork_count. The current Studio is NOT touched — the picker applies sections
 * client-side through commit() so the whole thing is one undo away.
 */
export function useForkTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, templateName }: ForkTemplateParams) => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = auth.user;
      if (!user) throw new Error("Sign in to save a template.");

      // 1. Copy the template's structure into a new owned layout.
      const { data: source, error: sourceError } = await supabase
        .from("layouts")
        .select("name, description, category, sections, theme_id")
        .eq("id", templateId)
        .eq("is_template", true)
        .maybeSingle();
      if (sourceError) throw sourceError;
      if (!source) throw new Error("That template no longer exists.");

      const { data: fork, error: insertError } = await supabase
        .from("layouts")
        .insert({
          name: `${source.name === templateName ? source.name : templateName} (fork)`.slice(0, 80),
          description: source.description,
          category: source.category,
          sections: source.sections as unknown as Json,
          is_template: false,
          theme_id: source.theme_id,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      // 2. Record the fork relationship.
      const { error: forkError } = await supabase.from("forks").insert({
        parent_layout_id: templateId,
        child_layout_id: fork.id,
        creator_id: user.id,
      });
      if (forkError) throw forkError;

      // 3. Bump the parent's fork count. Non-critical — a missed count never
      // fails an otherwise-successful fork.
      try {
        await supabase.rpc("increment_fork_count", { layout_id: templateId });
      } catch {
        /* counter is advisory */
      }

      return { forkedLayoutId: fork.id as string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      qc.invalidateQueries({ queryKey: ["page"] });
    },
    onError: (err) => {
      console.error("[useForkTemplate]", err);
    },
  });
}

interface PublishTemplateParams {
  /** The member's forked (or current) layout id to publish. */
  layoutId: string;
  name: string;
  description?: string;
  category?: string;
}

/**
 * Publish one of the member's layouts as a public community template. The
 * layout keeps its owner; only the is_template flag and catalog metadata
 * change. Structure only — the layout's sections never contain member content.
 */
export function usePublishTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ layoutId, name, description, category }: PublishTemplateParams) => {
      const { error } = await supabase
        .from("layouts")
        .update({
          is_template: true,
          name: name.trim() || "Untitled template",
          ...(description !== undefined ? { description } : {}),
          ...(category !== undefined ? { category } : {}),
        })
        .eq("id", layoutId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (err) => {
      console.error("[usePublishTemplate]", err);
    },
  });
}

/** Unpublish one of the member's templates (keeps the layout itself). */
export function useDeleteTemplate() {
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
    },
    onError: (err) => {
      console.error("[useDeleteTemplate]", err);
    },
  });
}

// ── Single template fetch (fork-then-apply path) ─────────────────────────────

/**
 * Fetch one layout's sections by id, sanitized and ready to apply. Works for
 * community templates AND the member's own forks (forks are stored with
 * `is_template = false`, so no flag filter here). Kept as a plain function
 * (not a hook) because the picker applies on click — there is no long-lived
 * subscription to subscribe to.
 */
export async function fetchTemplateSections(templateId: string) {
  const { data, error } = await supabase
    .from("layouts")
    .select("sections, theme_id, name")
    .eq("id", templateId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That template no longer exists.");
  return {
    name: data.name as string,
    themeId: (data.theme_id as string | null) ?? null,
    sections: sanitizeTemplateSections(data.sections),
  };
}

/** Re-export so UI code can format errors from one place. */
export { friendlyError };
