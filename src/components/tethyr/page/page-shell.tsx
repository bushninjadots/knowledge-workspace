// ── Page Shell ────────────────────────────────────────────────────────────────
// The top-level component for any page-backed surface (profile or project).
// Fetches the page data (layout + theme), applies the theme tokens as CSS
// custom properties, and renders the layout with blocks.
//
// Purely presentational: all editing lives in the Creativity Studio (/studio),
// so this shell never renders edit controls of its own.
//
// States handled:
//   • Loading — skeleton pulse
//   • No page yet — owner-only "setting up" message
//   • Error — friendly error with retry
//   • Published/draft — resolved page with layout

import { useMemo, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { usePage } from "@/hooks/use-page";
import { useTheme } from "@/hooks/use-theme";
import { themeTokensToStyle, deepMergeTokens } from "@/lib/theme-tokens";
import { PageLayoutRenderer } from "@/components/tethyr/page/page-layout";
import { useEditMode } from "@/components/tethyr/page/edit-mode-context";
import type { BlockContext, PageOwnerType, PageLayout } from "@/lib/page-blocks";

interface PageShellProps {
  /** The owner's ID (profile UUID or project UUID). */
  ownerId: string;
  /** "profile" or "project". */
  ownerType: PageOwnerType;
  /** Whether the current user is the page owner (can edit/publish). */
  isOwner: boolean;
  /** Render the owner's draft instead of requiring a published page. */
  previewDraft?: boolean;
  /** Optional layout supplied by Studio for an exact local preview. */
  previewLayout?: PageLayout;
  /** Optional theme supplied by Studio for an exact local preview. */
  previewTheme?: import("@/lib/page-blocks").ThemeTokens;
  /** Already-loaded owner data, shared by every block during previews. */
  previewData?: Record<string, unknown>;
  /** Rendered-page framing for owner-only draft previews. */
  previewMode?: "private" | "public";
  /** Callback used by preview chrome to return to the builder. */
  onBackToStudio?: () => void;
}

export function PageShell({
  ownerId,
  ownerType,
  isOwner,
  previewDraft,
  previewLayout,
  previewTheme,
  previewData,
  previewMode,
  onBackToStudio,
}: PageShellProps) {
  const {
    data: page,
    isLoading,
    isError,
    refetch,
  } = usePage({
    ownerId,
    ownerType,
    // Owners always see their draft (even unpublished) on their own surfaces;
    // non-owners may only request a published page (or an explicit preview).
    includeDraft: isOwner || previewDraft,
  });
  const { data: themeVars = {} } = useTheme(page?.themeId);
  const { isEditing } = useEditMode();

  // Diagnostic: log whether blocks are registered (once per mount).
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Dynamic import to avoid circular deps at module level.
      import("@/lib/block-registry").then(({ getAllBlocks }) => {
        const all = getAllBlocks();
        console.log(
          `[PageShell] ${ownerType}/${ownerId} | isOwner=${isOwner} | page=${page?.id ?? "null"} | sections=${page?.layout?.sections?.length ?? 0} | blocks_registered=${all.length}`,
        );
        if (all.length === 0) {
          console.warn(
            "[PageShell] ⚠ No blocks registered — block picker and renderer will be empty. Did you import 'register-all'?",
          );
        }
      });
    }
    // Only run on mount or when page/owner type changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!page, ownerType]);

  const blockContext: BlockContext = useMemo(
    () => ({
      ownerId,
      ownerType,
      pageId: page?.id ?? "",
      data: previewData,
      isEditing: isOwner && isEditing && !previewMode,
    }),
    [ownerId, ownerType, page?.id, previewData, isOwner, isEditing, previewMode],
  );

  // The effective theme is the persisted page theme layered with any preview
  // draft theme from Studio (the preview sheet already carries the full theme).
  const effectiveTheme = useMemo(
    () => deepMergeTokens(page?.theme ?? {}, previewTheme ?? {}),
    [page?.theme, previewTheme],
  );

  // Merge theme CSS vars with any user-provided style. Base theme vars are
  // applied FIRST so customizations (radius, colors, draft previews) always
  // win — previously the base tokens were spread last and clobbered the page.
  const containerStyle = useMemo(() => {
    const merged = themeTokensToStyle(effectiveTheme);
    return { ...themeVars, ...merged } as React.CSSProperties;
  }, [themeVars, effectiveTheme]);

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
            You don't have a page yet — build it in the Creativity Studio.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to="/studio">Open in Creativity Studio</Link>
          </Button>
        </div>
      );
    }
    return null;
  }

  // ── Unpublished (non-owner only) ─────────────────────────────────────
  // Owners always see their own page (published or draft) at its public URL.
  if (!isOwner && !previewDraft && page.status !== "published") {
    return null;
  }

  if (previewDraft && !isOwner) {
    return null;
  }

  const layout: PageLayout = previewLayout ?? page.layout ?? { sections: [] };

  // ── Rendered page ────────────────────────────────────────────────────
  return (
    <div data-page-shell={`${ownerType}:${ownerId}`}>
      <div
        className="bg-background font-sans text-foreground"
        style={containerStyle}
        data-page-id={page.id}
        data-page-status={page.status}
        data-page-preview={
          previewMode
            ? `${previewMode}-preview`
            : previewDraft || (isOwner && page.status !== "published")
              ? "private-draft"
              : "published"
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
          <PageLayoutRenderer layout={layout} context={blockContext} />
        )}
      </div>
    </div>
  );
}
