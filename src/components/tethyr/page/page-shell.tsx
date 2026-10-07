// ── Page Shell ────────────────────────────────────────────────────────────────
// Fetches a page, applies its theme, and renders the block layout read-only:
// the public profile page and its draft preview. Editing happens in the
// Studio editor (creation-studio / g-studio-surface).

import { appearanceStyle, type ProfileBackground } from "@/lib/background-themes";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { usePage } from "@/hooks/use-page";
import { useCreatePage } from "@/hooks/use-page-editor";
import { useProfileTheme } from "@/hooks/use-theme";
import { themeTokensToStyle, deepMergeTokens } from "@/lib/theme-tokens";
import { LookFilters, lookCanvasAttributes } from "./look-canvas";
import {
  CARD_SURFACE_STYLE,
  cardFillStyle,
  studioBackgroundVars,
  structureMaxWidth,
  studioConfigToThemeTokens,
  studioSurfaceStyle,
} from "@/lib/studio-config";
import { PageLayoutRenderer } from "@/components/tethyr/page/page-layout";
import { friendlyError } from "@/lib/error-message";
import { useCardInk } from "@/hooks/use-card-ink";
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
  /** The "Public preview · Back to Studio" strip. Off when the page is framed
   *  inside the editor's device preview, which has its own chrome. */
  showPreviewBanner?: boolean;
  onBackToStudio?: () => void;
  /** The banner's colour, sampled by the caller (the public page does, for
   *  its backdrop). Drives "Colour + banner tint" accents. */
  bannerColor?: string | null;
  /** The owner's appearance. Its card-border colour is re-declared on the
   *  canvas so `var(--border)` / the accent resolve against this page's theme
   *  (as in the editor), not the surrounding shell's. */
  appearance?: ProfileBackground | null;
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
  showPreviewBanner = true,
  onBackToStudio,
  bannerColor,
  appearance,
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
  const { vars: themeVars, scheme } = useProfileTheme(
    page?.themeId,
    ownerType === "profile" ? page?.config : null,
  );
  const cardInk = useCardInk(ownerType === "profile" ? (page?.config ?? null) : null);
  const createPage = useCreatePage();
  const isGlassTheme = page?.config?.vibeId === "glass" || page?.config?.personalityId === "glass";
  const bannerAccent = bannerColor ?? null;

  const blockContext: BlockContext = useMemo(
    () => ({
      ownerId,
      ownerType,
      pageId: page?.id ?? "",
      data: previewData,
      isEditing: false,
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
      ...themeTokensToStyle(effectiveTheme, scheme),
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
    if (appearance !== undefined) {
      const owner = appearanceStyle(appearance) as Record<string, string>;
      style["--card-border-color"] = owner["--card-border-color"] ?? "var(--border)";
      style["--card-border-force-color"] = owner["--card-border-force-color"] ?? "var(--border)";
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
    scheme,
    isGlassTheme,
    blockContext.translucent,
    page,
    bannerAccent,
    appearance,
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
  const canvasFrameClass =
    ownerType === "profile" && structureWidth
      ? // A 16px gutter so cards and area labels never touch a phone's edge;
        // the max width grows by the same amount, so desktop is unchanged.
        "mx-auto w-full px-4 pb-16 pt-6 sm:pt-10"
      : "w-full";

  return (
    <div
      ref={cardInk.ref}
      data-page-shell={`${ownerType}:${ownerId}`}
      // A profile renders on Tethyr's own palette under its own theme, never
      // the visitor's Site appearance (applied on <html>).
      data-base-palette={ownerType === "profile" ? "" : undefined}
      data-scheme={ownerType === "profile" ? scheme : undefined}
      data-card-ink={cardInk.active ? "" : undefined}
      style={
        page && ownerType === "profile"
          ? {
              ...cardFillStyle(page.config),
              ...studioBackgroundVars(page.config, "public"),
              ...cardInk.style,
              // Native controls and scrollbars match the profile's mode.
              colorScheme: scheme,
            }
          : undefined
      }
    >
      <div data-studio-workspace="view">
        <div
          className={`${canvasFrameClass} studio-canvas relative isolate bg-[var(--studio-bg,var(--background))] bg-noise font-sans text-foreground`}
          {...(page && ownerType === "profile" ? lookCanvasAttributes(page.config) : {})}
          style={
            ownerType === "profile" && structureWidth
              ? {
                  ...containerStyle,
                  maxWidth: structureWidth + 32,
                  marginInline: "auto",
                }
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
          {ownerType === "profile" && <LookFilters />}
          {previewMode && showPreviewBanner && (
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
              <p className="text-sm text-muted-foreground" role="status">
                Nothing here yet.
              </p>
            </div>
          ) : (
            <PageLayoutRenderer
              layout={layout}
              context={blockContext}
              profileCompleteness={profileCompleteness}
              onCompleteProfile={onCompleteProfile}
            />
          )}
        </div>
      </div>
    </div>
  );
}
