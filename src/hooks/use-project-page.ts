// ── Project Page Hook ─────────────────────────────────────────────────────────
// Fetches a project's block-based page and provisions it for the owner when it
// does not exist yet. Public visitors only receive published data through usePage.

import { useCallback, useEffect, useRef } from "react";
import { usePage } from "@/hooks/use-page";
import { useCreatePage } from "@/hooks/use-page-editor";

interface UseProjectPageOptions {
  projectId: string;
  /** The project owner is allowed to load drafts and create the page. */
  isOwner: boolean;
}

export function useProjectPage({ projectId, isOwner }: UseProjectPageOptions) {
  const query = usePage({
    ownerId: projectId,
    ownerType: "project",
    includeDraft: isOwner,
  });
  const createPage = useCreatePage();
  const createAttempted = useRef(false);
  const { refetch } = query;

  const createProjectPage = useCallback(() => {
    if (createPage.isPending) return;
    createPage.mutate(
      { ownerId: projectId, ownerType: "project" },
      {
        onSettled: () => {
          createAttempted.current = false;
          void refetch();
        },
      },
    );
  }, [createPage, projectId, refetch]);

  useEffect(() => {
    if (
      !query.isLoading &&
      !query.isError &&
      !query.data &&
      isOwner &&
      !createAttempted.current &&
      !createPage.isError
    ) {
      createAttempted.current = true;
      createProjectPage();
    }
  }, [createPage.isError, createProjectPage, isOwner, query.data, query.isError, query.isLoading]);

  return {
    page: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch,
    pageCreationError: createPage.error,
    pageCreationPending: createPage.isPending,
    createPage: createProjectPage,
  };
}
