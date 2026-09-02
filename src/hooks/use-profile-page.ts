// ── Profile Page Hook ────────────────────────────────────────────────────────
// Wraps usePage with auto-creation logic: if a profile doesn't have a page yet,
// and the current user is the profile owner, create one with the default profile
// layout. Otherwise just fetch the existing page.

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { usePage, invalidatePage } from "@/hooks/use-page";
import { createDefaultProfileLayout } from "@/lib/default-layouts";
import { DEFAULT_THEME_ID } from "@/lib/constants";

type LayoutsSectionsJson = Database["public"]["Tables"]["layouts"]["Insert"]["sections"];

interface UseProfilePageOptions {
  profileId: string;
  /** Is the current user the profile owner? */
  isOwner: boolean;
  /** Explicit owner-only draft preview. */
  previewDraft?: boolean;
}

/**
 * Fetch (or auto-create) the page for a profile. If no page exists and the
 * user is the owner, creates one with the default profile layout.
 */
export function useProfilePage({
  profileId,
  isOwner,
  previewDraft = false,
}: UseProfilePageOptions) {
  const {
    data: page,
    isLoading,
    isError,
    refetch,
  } = usePage({
    ownerId: profileId,
    ownerType: "profile",
    // Public profile routes remain published-only. Draft access is explicit and
    // is still protected by the route's owner check before it reaches here.
    includeDraft: previewDraft || isOwner,
  });
  const qc = useQueryClient();

  // Guard against double-fire in React strict mode / concurrent features so we
  // never create two pages for the same owner.
  const creatingRef = useRef(false);

  // Auto-create a page for profile owners when none exists.
  useEffect(() => {
    if (!isLoading && !page && isOwner && !creatingRef.current) {
      creatingRef.current = true;
      void autoCreatePage(profileId, qc).finally(() => {
        creatingRef.current = false;
        void refetch();
      });
    }
  }, [isLoading, page, isOwner, profileId, qc, refetch]);

  return { page, isLoading, isError, refetch };
}

async function autoCreatePage(profileId: string, qc: ReturnType<typeof useQueryClient>) {
  try {
    const defaultLayout = createDefaultProfileLayout();
    const me = (await supabase.auth.getUser()).data.user;
    const { data: layoutData, error: layoutError } = await supabase
      .from("layouts")
      .insert({
        name: "Default Profile",
        type: "standard",
        sections: defaultLayout.sections as unknown as LayoutsSectionsJson,
        is_template: false,
        created_by: me?.id ?? profileId,
      })
      .select("id")
      .single();

    if (layoutError || !layoutData) {
      console.warn("Failed to create default profile layout", layoutError);
      return;
    }

    const { error: pageError } = await supabase.from("pages").insert({
      owner_id: profileId,
      owner_type: "profile",
      layout_id: layoutData.id,
      theme_id: DEFAULT_THEME_ID,
      // Auto-provisioned pages start as drafts — only an explicit Publish in
      // the Studio makes them public, matching the Studio's own useCreatePage.
      status: "draft",
    });

    if (pageError) {
      console.warn("Failed to create profile page", pageError);
      return;
    }

    invalidatePage(qc, profileId, "profile");
  } catch (err) {
    console.warn("Auto-create profile page failed", err);
  }
}
