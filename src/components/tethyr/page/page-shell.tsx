// ── Page Shell ────────────────────────────────────────────────────────────────
// Fetches a page, applies its theme, and renders the block layout. Owner views
// also receive the Studio toolbar and persistence callbacks; public views remain
// read-only.

import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { usePage } from "@/hooks/use-page";
import { useUpdatePageLayout } from "@/hooks/use-page-editor";
import { EditorToolbar } from "@/components/tethyr/page/editor-toolbar";
import { useTheme } from "@/hooks/use-theme";
import { themeTokensToStyle, deepMergeTokens } from "@/lib/theme-tokens";
import { PageLayoutRenderer } from "@/components/tethyr/page/page-layout";
import { useEditMode } from "@/components/tethyr/page/edit-mode-context";
import type { BlockContext, PageOwnerType, PageLayout } from "@/lib/page-blocks";

interface PageShellProps {
  ownerId: string;
  ownerType: PageOwnerType;
  isOwner: boolean;
  renderState?: "draft" | "published";
  previewDraft?: boolean;
  previewLayout?: PageLayout;
  previewTheme?: import("@/lib/page-blocks").ThemeTokens;
  previewData?: Record<string, unknown>;
  previewMode?: "private" | "public";
  onBackToStudio?: () => void;
  profileMedia?: { avatarUrl: string | null; bannerUrl: string | null };
  onProfileMediaSaved?: () => void;
  profileCompleteness?: number;
  onCompleteProfile?: () => void;
}

export function PageShell({
  ownerId,
  ownerType,
  isOwner,
  renderState,
  previewDraft,
  previewLayout,
  previewTheme,
  previewData,
  previewMode,
  onBackToStudio,
  profileMedia,
  onProfileMediaSaved,
  profileCompleteness,
  onCompleteProfile,
}: PageShellProps) {
  const {
    data: page,
    isLoading,
    isError,
    refetch,
  } = usePage({
    ownerId,
    ownerType,
    includeDraft: renderState === "draft" || previewDraft === true || isOwner,
  });
  const { data: themeVars = {} } = useTheme(page?.themeId);
  const { isEditing } = useEditMode();
  const updateLayout = useUpdatePageLayout();

  const saveLayout = (nextLayout: PageLayout) => {
    if (!page || updateLayout.isPending || !isOwner || previewMode) return;
    updateLayout.mutate(
      {
        layoutId: page.layoutId,
        layout: nextLayout,
        ownerId,
        ownerType,
      },
      { onSuccess: () => void refetch() },
    );
  };

  const saveBlockConfig = (blockId: string, config: Record<string, unknown>) => {
    if (!page || updateLayout.isPending || !isOwner || previewMode) return;
    saveLayout({
      sections: page.layout.sections.map((section) => ({
        ...section,
        blocks: section.blocks.map((block) =>
          block.id === blockId ? { ...block, config } : block,
        ),
      })),
    });
  };

  const blockContext: BlockContext = useMemo(
    () => ({
      ownerId,
      ownerType,
      pageId: page?.id ?? "",
      data: previewData,
      isEditing: isOwner && isEditing && !previewMode,
      isOwner: isOwner && !previewMode,
      profileCompleteness,
      onCompleteProfile,
    }),
    [
      ownerId,
      ownerType,
      page?.id,
      previewData,
      isOwner,
      isEditing,
      previewMode,
      profileCompleteness,
      onCompleteProfile,
    ],
  );

  const effectiveTheme = useMemo(
    () => deepMergeTokens(page?.theme ?? {}, previewTheme ?? {}),
    [page?.theme, previewTheme],
  );
  const containerStyle = useMemo(
    () => {
      const style = { ...themeVars, ...themeTokensToStyle(effectiveTheme) } as React.CSSProperties &
        Record<string, string>;
      if (blockContext.translucent) {
        style["--surface"] = "color-mix(in oklab, var(--background) 72%, transparent)";
        style["--surface-elevated"] = "color-mix(in oklab, var(--background) 84%, transparent)";
        style["--card"] = "color-mix(in oklab, var(--background) 78%, transparent)";
        style["--card-border"] = "color-mix(in oklab, var(--foreground) 24%, transparent)";
        style["--border"] = "color-mix(in oklab, var(--foreground) 22%, transparent)";
        style["--border-strong"] = "color-mix(in oklab, var(--foreground) 36%, transparent)";
      }
      return style;
    },
    [themeVars, effectiveTheme, blockContext.translucent],
  );

  if (isLoading) {
    return (
      <div className="space-y-6 px-4 py-8 sm:px-6" data-page-loading>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4" role="alert">
        <div className="max-w-sm text-center">
          <p className="text-sm text-destructive">This page couldn&apos;t be loaded.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!page) {
    if (!isOwner) return null;
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">
          You don&apos;t have a page yet — build it in the Creativity Studio.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/profile">Open in Creativity Studio</Link>
        </Button>
      </div>
    );
  }

  const wantsDraft = renderState === "draft" || previewDraft === true;
  if (!wantsDraft && !isOwner && page.status !== "published") return null;
  if (wantsDraft && !isOwner) return null;

  const layout = previewLayout ?? page.layout ?? { sections: [] };

  return (
    <div data-page-shell={`${ownerType}:${ownerId}`}>
      {isOwner && !previewMode && (
        <EditorToolbar
          page={page}
          onRefresh={() => void refetch()}
          ownerId={ownerId}
          ownerType={ownerType}
        />
      )}
      <div
        className="bg-background font-sans text-foreground"
        style={containerStyle}
        data-page-id={page.id}
        data-page-status={page.status}
        data-page-preview={
          previewMode ? `${previewMode}-preview` : wantsDraft ? "private-draft" : "published"
        }
        role="region"
        aria-label={`${ownerType} page`}
      >
        {previewMode && (
          <div className="mx-auto flex max-w-7xl items-center justify-between border-b border-border/60 px-4 py-3 sm:px-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                {previewMode === "private" ? "Private preview" : "Public preview"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {previewMode === "private"
                  ? "Only you can see this saved draft."
                  : "This is how the saved draft will appear to visitors."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToStudio ?? (() => window.history.back())}
            >
              ← Back to Studio
            </Button>
          </div>
        )}
        {layout.sections.length === 0 ? (
          <div className="flex min-h-[20vh] items-center justify-center px-4">
            {isOwner && isEditing ? (
              <div className="text-center">
                <p className="text-sm text-muted-foreground" role="status">
                  Your page is empty.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add a block to start building your page.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground" role="status">
                Nothing here yet.
              </p>
            )}
          </div>
        ) : (
          <PageLayoutRenderer
            layout={layout}
            context={blockContext}
            onLayoutChange={isOwner && isEditing && !previewMode ? saveLayout : undefined}
            onBlockConfigChange={isOwner && isEditing && !previewMode ? saveBlockConfig : undefined}
            profileMedia={profileMedia}
            onProfileMediaSaved={onProfileMediaSaved}
            profileCompleteness={profileCompleteness}
            onCompleteProfile={onCompleteProfile}
          />
        )}
      </div>
    </div>
  );
}
