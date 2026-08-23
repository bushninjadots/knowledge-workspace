// ── Page Shell ────────────────────────────────────────────────────────────────
// The top-level component for any page-backed surface (profile or project).
// Fetches the page data (layout + theme), applies the theme tokens as CSS
// custom properties, and renders the layout with blocks.
//
// States handled:
//   • Loading — skeleton pulse
//   • No page yet — empty state with "create page" action (owner only)
//   • Error — friendly error with retry
//   • Published/draft — resolved page with layout

import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { usePage } from "@/hooks/use-page";
import { useCreatePage } from "@/hooks/use-page-editor";
import { useTheme } from "@/hooks/use-theme";
import { themeTokensToStyle } from "@/lib/theme-tokens";
import { PageLayoutRenderer } from "@/components/tethyr/page/page-layout";
import type { BlockContext, PageOwnerType, PageLayout } from "@/lib/page-blocks";

interface PageShellProps {
  /** The owner's ID (profile UUID or project UUID). */
  ownerId: string;
  /** "profile" or "project". */
  ownerType: PageOwnerType;
  /** Whether the current user is the page owner (can edit/publish). */
  isOwner: boolean;
  /** Whether the page is in edit mode (shows edit controls). */
  isEditing?: boolean;
}

export function PageShell({ ownerId, ownerType, isOwner, isEditing = false }: PageShellProps) {
  const { data: page, isLoading, isError, refetch } = usePage({ ownerId, ownerType });
  const { data: themeVars = {} } = useTheme(page?.themeId);
  const createPage = useCreatePage();

  const blockContext: BlockContext = useMemo(
    () => ({
      ownerId,
      ownerType,
      pageId: page?.id ?? "",
      isEditing: isOwner && isEditing,
    }),
    [ownerId, ownerType, page?.id, isOwner, isEditing],
  );

  // Merge theme CSS vars with any user-provided style.
  const containerStyle = useMemo(() => {
    const base = themeTokensToStyle(page?.theme ?? {});
    return { ...base, ...themeVars } as React.CSSProperties;
  }, [page?.theme, themeVars]);

  // ── Loading ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 px-4 py-8 sm:px-6" data-page-loading>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4" role="alert">
        <div className="max-w-sm text-center">
          <p className="text-sm text-destructive">This page couldn't be loaded.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // ── No page yet ──────────────────────────────────────────────────────
  if (!page) {
    if (isOwner) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center px-4">
          <div className="max-w-sm text-center">
            <p className="text-sm text-muted-foreground">No page set up yet.</p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => createPage.mutate({ ownerId, ownerType })}
            >
              {createPage.isPending ? "Creating..." : "Create page"}
            </Button>
          </div>
        </div>
      );
    }
    return null;
  }

  // ── Unpublished (non-owner) ──────────────────────────────────────────
  if (!isOwner && page.status !== "published") {
    return null;
  }

  const layout: PageLayout = page.layout ?? { sections: [] };

  // ── Rendered page ────────────────────────────────────────────────────
  return (
    <div style={containerStyle} data-page-id={page.id} data-page-status={page.status}>
      {layout.sections.length === 0 ? (
        <div className="flex min-h-[20vh] items-center justify-center px-4">
          {isOwner && isEditing ? (
            <p className="text-sm text-muted-foreground">
              Your page is empty. Add blocks to get started.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          )}
        </div>
      ) : (
        <PageLayoutRenderer layout={layout} context={blockContext} />
      )}
    </div>
  );
}