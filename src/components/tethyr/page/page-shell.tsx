// ── Page Shell ────────────────────────────────────────────────────────────────
// The top-level component for any page-backed surface (profile or project).
// Fetches the page data (layout + theme), applies the theme tokens as CSS
// custom properties, and renders the layout with blocks.
//
// When `isOwner` is true, the editor toolbar is shown (customize button or
// full edit controls via EditModeProvider). Layout changes are persisted
// through usePageEditor mutations.
//
// States handled:
//   • Loading — skeleton pulse
//   • No page yet — empty state with "create page" action (owner only)
//   • Error — friendly error with retry
//   • Published/draft — resolved page with layout
//   • Editing — blocks get move/remove/configure controls

import { useMemo, useCallback, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { usePage } from "@/hooks/use-page";
import { useCreatePage, useUpdatePageLayout } from "@/hooks/use-page-editor";
import { useTheme } from "@/hooks/use-theme";
import { themeTokensToStyle, deepMergeTokens } from "@/lib/theme-tokens";
import {
  studioConfigToStyle,
  studioConfigToThemeTokens,
  DEFAULT_STUDIO_CONFIG,
} from "@/lib/studio-config";
import { PageLayoutRenderer } from "@/components/tethyr/page/page-layout";
import { EditorToolbar } from "@/components/tethyr/page/editor-toolbar";
import { useEditMode } from "@/components/tethyr/page/edit-mode-context";
import type { BlockContext, PageOwnerType, PageLayout } from "@/lib/page-blocks";
import { createDefaultProfileLayout, createDefaultProjectLayout } from "@/lib/default-layouts";

interface PageShellProps {
  /** The owner's ID (profile UUID or project UUID). */
  ownerId: string;
  /** "profile" or "project". */
  ownerType: PageOwnerType;
  /** Whether the current user is the page owner (can edit/publish). */
  isOwner: boolean;
}

export function PageShell({ ownerId, ownerType, isOwner }: PageShellProps) {
  // Owners must be able to load their draft pages in the editor; public
  // visitors only ever see published pages.
  const {
    data: page,
    isLoading,
    isError,
    refetch,
  } = usePage({
    ownerId,
    ownerType,
    includeDraft: isOwner,
  });
  const { data: themeVars = {} } = useTheme(page?.themeId);
  const createPage = useCreatePage();
  const updateLayout = useUpdatePageLayout();
  const { isEditing } = useEditMode();

  const blockContext: BlockContext = useMemo(
    () => ({
      ownerId,
      ownerType,
      pageId: page?.id ?? "",
      isEditing: isOwner && isEditing,
    }),
    [ownerId, ownerType, page?.id, isOwner, isEditing],
  );

  // Merge theme CSS vars with the studio-config treatments. Studio config is
  // applied as token overrides (radius/typography/density scale) layered on top
  // of the page theme, then direct CSS vars for accent + density gutters.
  const containerStyle = useMemo(() => {
    const themeTokens = deepMergeTokens(
      page?.theme ?? {},
      studioConfigToThemeTokens(page?.config ?? DEFAULT_STUDIO_CONFIG),
    );
    const base = themeTokensToStyle(themeTokens);
    const configStyle = studioConfigToStyle(
      page?.config ?? DEFAULT_STUDIO_CONFIG,
    ) as unknown as React.CSSProperties;
    return { ...base, ...themeVars, ...configStyle } as React.CSSProperties;
  }, [page?.theme, page?.config, themeVars]);

  // ── Layout change handler (persists to DB) ─────────────────────────────
  const handleLayoutChange = useCallback(
    (newLayout: PageLayout) => {
      if (!page) return;
      updateLayout.mutate({
        pageId: page.id,
        layoutId: page.layoutId,
        layout: newLayout,
      });
    },
    [page, updateLayout],
  );

  // ── Block config change handler ────────────────────────────────────────
  const handleBlockConfigChange = useCallback(
    (blockId: string, config: Record<string, unknown>) => {
      if (!page || !page.layout) return;
      const sections = page.layout.sections.map((s) => ({
        ...s,
        blocks: s.blocks.map((b) =>
          b.id === blockId ? { ...b, config: { ...b.config, ...config } } : b,
        ),
      }));
      handleLayoutChange({ sections });
    },
    [page, handleLayoutChange],
  );

  const createdRef = useRef(false);

  // Auto-create the page on first render when owner and no page exists.
  useEffect(() => {
    if (!page && isOwner && !isLoading && !createPage.isPending && !createdRef.current) {
      createdRef.current = true;
      createPage.mutate({ ownerId, ownerType });
    }
  }, [page, isOwner, isLoading, createPage, ownerId, ownerType]);

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
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {createPage.isPending ? "Preparing your page…" : "Setting up your page layout…"}
          </p>
        </div>
      );
    }
    return null;
  }

  // ── Unpublished (non-owner) ──────────────────────────────────────────
  if (!isOwner && page.status !== "published") {
    return null;
  }

  const layout: PageLayout = page.layout?.sections?.length
    ? page.layout
    : ownerType === "profile"
      ? createDefaultProfileLayout()
      : createDefaultProjectLayout();

  // ── Rendered page ────────────────────────────────────────────────────
  return (
    <div>
      {/* Editor toolbar — only shows editing tools when in edit mode.
          The Customize/Done toggle lives in the page Shell header. */}
      {isOwner && (
        <EditorToolbar
          page={page}
          onRefresh={() => refetch()}
          ownerId={ownerId}
          ownerType={ownerType}
        />
      )}

      <div
        style={containerStyle}
        data-page-id={page.id}
        data-page-status={page.status}
        role="region"
        aria-label={`${ownerType} page`}
      >
        {layout.sections.length === 0 ? (
          <div className="flex min-h-[20vh] items-center justify-center px-4">
            {isOwner && isEditing ? (
              <div className="text-center">
                <p className="text-sm text-muted-foreground" role="status">
                  Your page is empty.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use Add block above to start building.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground" role="status">
                Nothing here yet.
              </p>
            )}
          </div>
        ) : isOwner ? (
          <PageLayoutRenderer
            layout={layout}
            context={blockContext}
            onLayoutChange={handleLayoutChange}
            onBlockConfigChange={handleBlockConfigChange}
          />
        ) : (
          <PageLayoutRenderer layout={layout} context={blockContext} />
        )}
      </div>
    </div>
  );
}
