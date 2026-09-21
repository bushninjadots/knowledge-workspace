// ── Page Shell ────────────────────────────────────────────────────────────────
// Fetches a page, applies its theme, and renders the block layout. Owner views
// also receive the Studio toolbar and persistence callbacks; public views remain
// read-only.

import { useCallback, useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { usePage } from "@/hooks/use-page";
import {
  useCreatePage,
  useUpdatePageConfig,
  useUpdatePageLayout,
  useUpdatePageTheme,
} from "@/hooks/use-page-editor";
import { useTheme } from "@/hooks/use-theme";
import { useTheme as useAppTheme } from "@/lib/theme";
import { themeTokensToStyle, deepMergeTokens } from "@/lib/theme-tokens";
import {
  CARD_SURFACE_STYLE,
  cardFillStyle,
  structureMaxWidth,
  studioConfigToThemeTokens,
  studioSurfaceStyle,
} from "@/lib/studio-config";
import { PageLayoutRenderer } from "@/components/tethyr/page/page-layout";
import { useEditMode, type PreviewDevice } from "@/components/tethyr/page/edit-mode-context";
import { friendlyError } from "@/lib/error-message";
import { useDominantColor } from "@/lib/dominant-color";
import type { BlockContext, PageOwnerType, PageLayout } from "@/lib/page-blocks";
import type { StudioSnapshot } from "@/lib/studio-history";

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
  pageCreationAction?: () => void;
  pageCreationError?: unknown;
  pageCreationPending?: boolean;
  /**
   * Optional backdrop (BackgroundLayer) rendered as the canvas's first child so
   * the member's background paints inside the page's theme-variable scope —
   * the same composition the owner Studio view uses. Omitted by callers whose
   * shell already paints a backdrop (editor, project pages).
   */
  backgroundSlot?: React.ReactNode;
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
  pageCreationAction,
  pageCreationError,
  pageCreationPending,
  backgroundSlot,
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
  const { resolvedTheme } = useAppTheme();
  const { isEditing, isPreviewing, previewDevice, recordSnapshot, registerRestoreHandler } =
    useEditMode();
  const createPage = useCreatePage();
  const updateLayout = useUpdatePageLayout();
  const updateConfig = useUpdatePageConfig();
  const updateTheme = useUpdatePageTheme();
  const isGlassTheme = page?.config?.vibeId === "glass" || page?.config?.personalityId === "glass";
  const bannerAccent = useDominantColor(profileMedia?.bannerUrl ?? null);
  const saveLayout = (nextLayout: PageLayout) => {
    if (!page || updateLayout.isPending || !isOwner || previewMode) return;
    recordSnapshot({
      layout: page.layout,
      config: page.config,
      themeId: page.themeId,
      theme: page.theme,
    });
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

  const restoreSnapshot = useCallback(
    async (snapshot: StudioSnapshot) => {
      if (!page || !isOwner || previewMode) return;
      await Promise.all([
        updateLayout.mutateAsync({
          layoutId: page.layoutId,
          layout: snapshot.layout,
          ownerId,
          ownerType,
        }),
        updateConfig.mutateAsync({
          pageId: page.id,
          config: snapshot.config,
          ownerId,
          ownerType,
        }),
        snapshot.themeId !== page.themeId
          ? updateTheme.mutateAsync({
              pageId: page.id,
              themeId: snapshot.themeId || null,
              ownerId,
              ownerType,
            })
          : Promise.resolve(),
      ]);
      await refetch();
    },
    [
      page,
      isOwner,
      previewMode,
      updateLayout,
      updateConfig,
      updateTheme,
      ownerId,
      ownerType,
      refetch,
    ],
  );

  useEffect(
    () => registerRestoreHandler(restoreSnapshot),
    [registerRestoreHandler, restoreSnapshot],
  );

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
    () =>
      deepMergeTokens(
        deepMergeTokens(page?.theme ?? {}, page ? studioConfigToThemeTokens(page.config) : {}),
        previewTheme ?? {},
      ),
    [page, previewTheme],
  );
  const containerStyle = useMemo(() => {
    const style = {
      ...themeVars,
      ...themeTokensToStyle(effectiveTheme, resolvedTheme),
    } as React.CSSProperties & Record<string, string>;
    if (page) {
      // Full Studio surface style (accent family, density, radius/gap/pad,
      // border weight, personality font hints) — the same computation the owner
      // Studio view applies, so the public canvas carries the identical stack.
      const configStyle = studioSurfaceStyle(page.config, bannerAccent) as React.CSSProperties &
        Record<string, string>;
      style["--content-density-gap"] = configStyle["--content-density-gap"];
      style["--content-density-padding"] = configStyle["--content-density-padding"];
      // Card border weight is Studio-owned; apply it whatever the accent mode.
      style["--card-border-width"] =
        (configStyle["--card-border-width"] as string | undefined) ??
        "var(--card-border-width, 1px)";
      // Studio accent modes are page-local and override the inherited palette
      // accent; "none" neutralizes the accent family toward the theme primary.
      Object.assign(style, configStyle);
    }
    if (isGlassTheme || blockContext.translucent) {
      style["--surface"] = "color-mix(in oklab, var(--background) 72%, transparent)";
      style["--surface-elevated"] = "color-mix(in oklab, var(--background) 84%, transparent)";
      style["--card"] = "color-mix(in oklab, var(--background) 78%, transparent)";
      style["--card-border"] = "color-mix(in oklab, var(--foreground) 24%, transparent)";
      style["--border"] = "color-mix(in oklab, var(--foreground) 22%, transparent)";
      style["--border-strong"] = "color-mix(in oklab, var(--foreground) 36%, transparent)";
    }
    // Profile Studios own their card fill — point the surface family at the
    // configured fill (default: 30% translucent elevated) so blocks read like
    // Dashboard panels on the published page too. `--studio-card-fill` is
    // declared on the shell wrapper above this canvas to avoid a CSS cycle.
    if (page && ownerType === "profile") {
      Object.assign(style, CARD_SURFACE_STYLE);
    }
    return style;
  }, [
    themeVars,
    effectiveTheme,
    resolvedTheme,
    isGlassTheme,
    blockContext.translucent,
    page,
    bannerAccent,
    ownerType,
  ]);

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
    const creationPending = pageCreationPending ?? createPage.isPending;
    const creationError = pageCreationError ?? createPage.error;
    const creationMessage = creationError
      ? friendlyError(creationError, "We couldn't create your Studio. Please try again.")
      : null;
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-medium text-foreground">Your Studio isn&apos;t set up yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your Studio to start sharing what you build.
        </p>
        {creationMessage && (
          <p className="mx-auto mt-3 max-w-md text-sm text-destructive" role="alert">
            {creationMessage}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          busy={creationPending}
          onClick={() => {
            if (pageCreationAction) {
              pageCreationAction();
              return;
            }
            createPage.mutate({ ownerId, ownerType }, { onSuccess: () => void refetch() });
          }}
        >
          {creationPending ? "Creating…" : "Create my Studio"}
        </Button>
      </div>
    );
  }

  const wantsDraft = renderState === "draft" || previewDraft === true;
  if (!wantsDraft && !isOwner && page.status !== "published") return null;
  if (wantsDraft && !isOwner) return null;

  const layout = previewLayout ?? page.layout ?? { sections: [] };
  // Public parity: profile Studios honour the creator's Structure choice (the
  // same `structureMaxWidth` the private Studio view uses), so the published
  // page reads at the width the creator designed it at.
  const structureWidth = page ? structureMaxWidth(page.config) : null;
  const canvasFrameClass = isPreviewing
    ? previewFrameClasses(previewDevice)
    : isEditing
      ? "mx-auto w-full max-w-5xl overflow-hidden border-y border-border/50"
      : ownerType === "profile" && structureWidth
        ? "mx-auto w-full"
        : "w-full";
  const workspaceClass =
    isPreviewing || isEditing ? "bg-surface-sunken px-3 py-5 sm:px-8 sm:py-10" : "";

  return (
    <div
      data-page-shell={`${ownerType}:${ownerId}`}
      style={page && ownerType === "profile" ? cardFillStyle(page.config) : undefined}
    >
      <div
        className={`${workspaceClass} ${isPreviewing || isEditing ? "studio-editor-workspace" : ""}`}
        data-studio-workspace={isPreviewing ? "preview" : isEditing ? "editor" : "view"}
      >
        <div
          className={`${canvasFrameClass} relative isolate bg-background bg-noise font-sans text-foreground`}
          style={
            ownerType === "profile" && structureWidth && !isPreviewing && !isEditing
              ? { ...containerStyle, maxWidth: structureWidth, marginInline: "auto" }
              : containerStyle
          }
          data-page-id={page.id}
          data-page-status={page.status}
          data-page-preview={
            previewMode ? `${previewMode}-preview` : wantsDraft ? "private-draft" : "published"
          }
          role="region"
          aria-label={`${ownerType} page`}
        >
          {backgroundSlot}
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
              onBlockConfigChange={
                isOwner && isEditing && !previewMode ? saveBlockConfig : undefined
              }
              profileMedia={profileMedia}
              onProfileMediaSaved={onProfileMediaSaved}
              profileCompleteness={profileCompleteness}
              onCompleteProfile={onCompleteProfile}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function previewFrameClasses(device: PreviewDevice): string {
  switch (device) {
    case "mobile":
      return "mx-auto w-full max-w-[390px] overflow-hidden rounded-lg border border-border/60";
    case "tablet":
      return "mx-auto w-full max-w-[768px] overflow-hidden rounded-lg border border-border/60";
    default:
      return "mx-auto w-full max-w-7xl overflow-hidden rounded-lg border border-border/60";
  }
}
