// ── Profile Page Hook ────────────────────────────────────────────────────────
// Wraps usePage with auto-creation logic: if a profile doesn't have a page yet,
// and the current user is the profile owner, create one with the default profile
// layout. Otherwise just fetch the existing page.

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePage, invalidatePage } from "@/hooks/use-page";
import { createDefaultProfileLayout } from "@/lib/default-layouts";

const DEFAULT_THEME_ID = "00000000-0000-0000-0000-000000000001";

interface UseProfilePageOptions {
  profileId: string;
  /** Is the current user the profile owner? */
  isOwner: boolean;
}

/**
 * Fetch (or auto-create) the page for a profile. If no page exists and the
 * user is the owner, creates one with the default profile layout.
 */
export function useProfilePage({ profileId, isOwner }: UseProfilePageOptions) {
  const { data: page, isLoading, isError, refetch } = usePage({
    ownerId: profileId,
    ownerType: "profile",
  });
  const qc = useQueryClient();

  // Auto-create a page for profile owners when none exists.
  useEffect(() => {
    if (!isLoading && !page && isOwner) {
      autoCreatePage(profileId, qc);
    }
  }, [isLoading, page, isOwner, profileId, qc]);

  return { page, isLoading, isError, refetch };
}

async function autoCreatePage(profileId: string, qc: ReturnType<typeof useQueryClient>) {
  try {
    const defaultLayout = createDefaultProfileLayout();
    const { data: layoutData, error: layoutError } = await (supabase as any)
      .from("layouts")
      .insert({
        name: "Default Profile",
        type: "standard",
        sections: defaultLayout.sections as unknown as Record<string, unknown>[],
        is_template: false,
        created_by: profileId,
      })
      .select("id")
      .single();

    if (layoutError || !layoutData) {
      console.warn("Failed to create default profile layout", layoutError);
      return;
    }

    const { error: pageError } = await (supabase as any)
      .from("pages")
      .insert({
        owner_id: profileId,
        owner_type: "profile",
        layout_id: layoutData.id,
        theme_id: DEFAULT_THEME_ID,
        status: "published",
        published_at: new Date().toISOString(),
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