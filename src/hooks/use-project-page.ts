// ── Project Page Hook ────────────────────────────────────────────────────────
// Wraps usePage with auto-creation logic: if a project doesn't have a page yet,
// and the current user is the owner, create one with the default project layout.
// Otherwise just fetch the existing page.

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { usePage, invalidatePage } from "@/hooks/use-page";
import { createDefaultProjectLayout } from "@/lib/default-layouts";
import { DEFAULT_THEME_ID } from "@/lib/constants";

type LayoutsSectionsJson = Database["public"]["Tables"]["layouts"]["Insert"]["sections"];

interface UseProjectPageOptions {
  projectId: string;
  /** Is the current user the project owner? */
  isOwner: boolean;
  /** Explicit owner-only draft preview. */
  previewDraft?: boolean;
}

/**
 * Fetch (or auto-create) the page for a project. If no page exists and the
 * user is the owner, creates one with the default project layout.
 */
export function useProjectPage({
  projectId,
  isOwner,
  previewDraft = false,
}: UseProjectPageOptions) {
  const {
    data: page,
    isLoading,
    isError,
    refetch,
  } = usePage({
    ownerId: projectId,
    ownerType: "project",
    // Owners need their existing draft so the auto-create path does not try
    // to insert a duplicate page. RLS still limits draft visibility.
    includeDraft: isOwner || previewDraft,
  });
  const qc = useQueryClient();

  // Auto-create a page for project owners when none exists.
  useEffect(() => {
    if (!isLoading && !page && isOwner) {
      autoCreatePage(projectId, qc);
    }
  }, [isLoading, page, isOwner, projectId, qc]);

  return { page, isLoading, isError, refetch };
}

async function autoCreatePage(projectId: string, qc: ReturnType<typeof useQueryClient>) {
  try {
    // 1. Create a layout with the default project sections.
    const defaultLayout = createDefaultProjectLayout();
    const { data: layoutData, error: layoutError } = await supabase
      .from("layouts")
      .insert({
        name: "Default Project",
        type: "standard",
        sections: defaultLayout.sections as unknown as LayoutsSectionsJson,
        is_template: false,
        created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      })
      .select("id")
      .single();

    if (layoutError || !layoutData) {
      console.warn("Failed to create default project layout", layoutError);
      return;
    }

    // 2. Create the page referencing that layout.
    const { error: pageError } = await supabase.from("pages").insert({
      owner_id: projectId,
      owner_type: "project",
      layout_id: layoutData.id,
      theme_id: DEFAULT_THEME_ID,
      status: "draft",
    });

    if (pageError) {
      console.warn("Failed to create project page", pageError);
      return;
    }

    // 3. Invalidate so the page query picks up the new page.
    invalidatePage(qc, projectId, "project");
  } catch (err) {
    console.warn("Auto-create project page failed", err);
  }
}
