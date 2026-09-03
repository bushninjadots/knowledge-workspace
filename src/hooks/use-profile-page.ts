// ── Profile Page Hook ────────────────────────────────────────────────────────
// Wraps usePage for profile routes and coordinates owner page creation. PageShell
// renders the creation action alongside the pending/error state.

import { useCallback, useEffect, useRef } from "react";
import { usePage } from "@/hooks/use-page";
import { useCreatePage } from "@/hooks/use-page-editor";

interface UseProfilePageOptions {
  profileId: string;
  /** Is the current user the profile owner? */
  isOwner: boolean;
  /** Explicit owner-only draft preview. */
  previewDraft?: boolean;
}

/**
 * Fetch (or provision) the page for a profile owner. The returned creation
 * state lets PageShell expose pending, retry, and error states to the user.
 */
export function useProfilePage({
  profileId,
  isOwner,
  previewDraft = false,
}: UseProfilePageOptions) {
  const query = usePage({
    ownerId: profileId,
    ownerType: "profile",
    // Public profile routes remain published-only. Draft access is explicit and
    // is still protected by the route's owner check before it reaches here.
    includeDraft: previewDraft || isOwner,
  });
  const createPage = useCreatePage();
  const {
    isPending: createPending,
    isError: createError,
    error: creationError,
    mutate,
  } = createPage;
  const { refetch } = query;
  const creatingRef = useRef(false);
  const createProfilePage = useCallback(() => {
    if (createPending) return;
    mutate(
      { ownerId: profileId, ownerType: "profile" },
      {
        onSettled: () => {
          creatingRef.current = false;
          void refetch();
        },
      },
    );
  }, [createPending, mutate, profileId, refetch]);

  useEffect(() => {
    if (
      !query.isLoading &&
      !query.isError &&
      !query.data &&
      isOwner &&
      !creatingRef.current &&
      !createError
    ) {
      creatingRef.current = true;
      createProfilePage();
    }
  }, [query.isLoading, query.isError, query.data, isOwner, createProfilePage, createError]);

  return {
    page: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch,
    pageCreationError: creationError,
    pageCreationPending: createPending,
    createPage: createProfilePage,
  };
}
