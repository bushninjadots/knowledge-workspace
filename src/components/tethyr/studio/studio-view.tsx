// ── Studio View ───────────────────────────────────────────────────────────────
// The data-first Studio surface: renders the saved layout as a visitor would
// see it, but — because the owner is signed in — keeps the header's quick-edit
// controls (banner, profile photo, caption, identity, appearance) available
// without opening the full block editor. "Open editor" launches the builder.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  ExternalLink,
  Monitor,
  Pencil,
  Smartphone,
  Sparkles,
  Tablet,
  X,
} from "lucide-react";
import { usePage } from "@/hooks/use-page";
import { getBlock } from "@/lib/block-registry";
import { useTheme } from "@/hooks/use-theme";
import { CURRENT_USER_KEY, useCurrentUser, useSkillsCatalog } from "@/hooks/use-current-user";
import { ProjectDialog } from "@/components/tethyr/profile";
import { BackgroundLayer } from "@/components/tethyr/background-layer";
import { appearanceStyle, avatarShapeStyle } from "@/lib/background-themes";
import { useUserPalette } from "@/lib/dominant-color";
import { themeTokensToStyle } from "@/lib/theme-tokens";
import { useTheme as useAppTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { normalizeStudioConfig } from "@/lib/studio-config";
import { useCreatePage, usePublishPage } from "@/hooks/use-page-editor";
import {
  nextSteps,
  setupCompletenessPercent,
  showcaseCompletenessPercent,
  type Section,
} from "@/lib/profile-completeness";
import { shouldRenderSectionInView } from "@/lib/studio-visibility";
import { BlockRenderer } from "@/components/tethyr/page/block-renderer";
import { SECTION_GRID, colStartClass, spanClass } from "@/components/tethyr/page/page-layout";
import { Button } from "@/components/ui/button";
import {
  CARD_SURFACE_STYLE,
  cardFillStyle,
  studioConfigToThemeTokens,
  structureMaxWidth,
  studioSurfaceStyle,
  DEFAULT_STUDIO_CONFIG,
  type StudioConfig,
} from "@/lib/studio-config";
import type {
  BlockContext,
  LayoutBlockInstance,
  LayoutGridItem,
  LayoutSection,
  PageLayout,
} from "@/lib/page-blocks";

import "@/components/tethyr/blocks/register-all";

interface StudioViewProps {
  userId: string;
  profile: { id: string; handle: string | null; display_name: string | null } | null;
  onBack?: () => void;
  /** Open the full identity-completion form (skills, links, tools, etc.). */
  onCompleteProfile?: () => void;
}

type PreviewDevice = "desktop" | "tablet" | "mobile";

/** iframe widths mirroring the editor's device frames (md grid = 996px). */
const PREVIEW_DEVICE_WIDTHS: Record<PreviewDevice, number | undefined> = {
  desktop: undefined,
  tablet: 996,
  mobile: 390,
};

export function StudioView({ userId, profile, onBack, onCompleteProfile }: StudioViewProps) {
  const { resolvedTheme } = useAppTheme();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"view" | "preview">("view");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  // Edit affordances stay visible until the owner's first edit so new builders
  // discover their Studio is editable; afterwards they fade to hover-only.
  const [revealEdits, setRevealEdits] = useState(() => {
    try {
      return localStorage.getItem("tethyr:studio-edited") !== "1";
    } catch {
      return true;
    }
  });
  const markEdited = useCallback(() => {
    setRevealEdits(false);
    try {
      localStorage.setItem("tethyr:studio-edited", "1");
    } catch {
      // Private browsing — reveal-on-first-visit just won't persist.
    }
  }, []);
  const pageQuery = usePage({ ownerId: userId, ownerType: "profile", includeDraft: true });
  const { data: me } = useCurrentUser();
  const palette = useUserPalette(me?.bannerSigned ?? null);
  const { data: allSkills = [] } = useSkillsCatalog();
  const queryClient = useQueryClient();
  const createPage = useCreatePage();
  const publishPage = usePublishPage();
  const createAttempted = useRef(false);
  const page = pageQuery.data;

  const handlePublish = useCallback(() => {
    if (!page?.id) return;
    publishPage.mutate(
      { pageId: page.id, ownerId: userId, ownerType: "profile" },
      {
        onSuccess: () => toast.success("Your Studio is now live"),
        onError: () => toast.error("Could not publish your Studio"),
      },
    );
  }, [page?.id, publishPage, userId]);

  // The creator's own Studio answers "what should I work on next?" — compute the
  // incomplete profile steps from data that's already loaded (no extra queries).
  const completenessInput = useMemo(
    () => ({
      profile: me?.profile ?? null,
      teachCount: (me?.teachIds ?? []).length,
      learnCount: (me?.learnIds ?? []).length,
      projectsCount: (me?.projects ?? []).length,
    }),
    [me?.profile, me?.teachIds, me?.learnIds, me?.projects],
  );
  const setupPercent = useMemo(
    () => (me ? setupCompletenessPercent(completenessInput) : 0),
    [me, completenessInput],
  );
  const showcasePercent = useMemo(
    () => (me ? showcaseCompletenessPercent(completenessInput) : 0),
    [me, completenessInput],
  );
  const studioSteps = useMemo(
    () => (me ? nextSteps(completenessInput, 4) : []),
    [me, completenessInput],
  );

  // Auto-provision a Studio draft the first time the owner lands here, so the
  // view is never stuck on an empty state. Mirrors the editor's behaviour.
  useEffect(() => {
    if (
      pageQuery.isLoading ||
      pageQuery.isError ||
      page ||
      createAttempted.current ||
      createPage.isPending
    ) {
      return;
    }
    createAttempted.current = true;
    createPage.mutate(
      { ownerId: userId, ownerType: "profile" },
      {
        onSuccess: () => toast.success("Your Studio draft is ready"),
        onError: () => {
          createAttempted.current = false;
          toast.error("Could not create your Studio draft");
        },
      },
    );
  }, [createPage, page, pageQuery.isError, pageQuery.isLoading, userId]);

  const config: StudioConfig = page?.config ?? DEFAULT_STUDIO_CONFIG;
  const layout: PageLayout | null = page?.layout ?? null;
  const maxWidth = structureMaxWidth(config);
  // Keep the Studio view in step with the editor: apply the page theme so a
  // chosen preset is visible here exactly as it renders publicly.
  const { data: themeVars = {} } = useTheme(page?.themeId);
  const surfaceStyle = {
    ...themeVars,
    ...themeTokensToStyle(studioConfigToThemeTokens(config), resolvedTheme),
    ...studioSurfaceStyle(config, palette?.dominant ?? null),
    ...appearanceStyle(me?.background),
    ...avatarShapeStyle(me?.background),
    ...cardFillStyle(config),
  };
  const [emptyBlocks, setEmptyBlocks] = useState<Set<string>>(() => new Set());
  const handleBlockEmpty = useCallback((blockId: string, isEmpty: boolean) => {
    setEmptyBlocks((previous) => {
      // Every block reports its emptiness from a mount effect, so this runs a
      // lot. Returning `previous` when nothing changed lets React bail out of
      // the re-render; allocating a fresh Set unconditionally would make each
      // report a guaranteed render of the whole canvas.
      if (previous.has(blockId) === isEmpty) return previous;
      const next = new Set(previous);
      if (isEmpty) next.add(blockId);
      else next.delete(blockId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (mode !== "preview") setPreviewLoaded(false);
  }, [mode]);

  const blockContext: BlockContext = {
    ownerId: userId,
    ownerType: "profile",
    pageId: page?.id ?? `profile:${userId}`,
    isEditing: false,
    isOwner: true,
    quickEdit: mode === "view",
    data: profile ? { profile } : undefined,
    onBlockEmptyChange: handleBlockEmpty,
    onCompleteProfile,
    onAddProject: () => setProjectDialogOpen(true),
  };

  if (pageQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Loading your Studio…</p>
        </div>
      </div>
    );
  }

  if (pageQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <p className="text-sm text-muted-foreground">Your studio could not load.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => pageQuery.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background" data-studio-view style={surfaceStyle}>
      <StudioViewTopBar
        profile={profile}
        published={page?.status === "published"}
        mode={mode}
        device={previewDevice}
        onBack={onBack}
        onOpenEditor={() => navigate({ to: "/studio" })}
        onToggleMode={() => setMode((m) => (m === "view" ? "preview" : "view"))}
        onDeviceChange={setPreviewDevice}
      />
      {mode === "view" && (
        <>
          <StudioPublishStrip
            published={page?.status === "published"}
            hasContent={(layout?.sections.length ?? 0) > 0}
            publishing={publishPage.isPending}
            onPublish={handlePublish}
          />
          <StudioHiddenSectionsStrip
            count={layout?.sections.filter((section) => section.visible === false).length ?? 0}
            onEdit={() => navigate({ to: "/studio" })}
          />
        </>
      )}
      <main
        className={cn(
          "relative min-w-0 flex-1 overflow-y-auto bg-noise",
          mode === "preview" && "bg-[var(--surface-sunken)] p-2 sm:p-4",
        )}
        aria-label={mode === "preview" ? "Public Studio preview" : "Studio"}
        style={CARD_SURFACE_STYLE}
      >
        <BackgroundLayer
          background={me?.background}
          imageUrl={me?.backgroundImageUrl}
          bannerColor={palette?.dominant ?? null}
        />
        {mode === "preview" && profile?.handle ? (
          <div className="relative flex min-h-full w-full justify-center overflow-y-auto bg-noise py-2 sm:py-4">
            {!previewLoaded && (
              <div className="absolute inset-x-0 top-6 z-10 flex justify-center" aria-live="polite">
                <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
                  Loading visitor view…
                </div>
              </div>
            )}
            <iframe
              title="Public Studio preview — exactly as visitors see it"
              src={`/u/${profile.handle}?embed=true`}
              onLoad={() => setPreviewLoaded(true)}
              className={cn(
                "min-h-[calc(100vh-7rem)] w-full border-0 bg-background transition-opacity duration-200",
                !previewLoaded && "opacity-0",
                previewDevice !== "desktop" &&
                  "rounded-lg shadow-[0_12px_40px_-24px_hsl(var(--foreground)/0.5)]",
              )}
              style={{
                maxWidth: PREVIEW_DEVICE_WIDTHS[previewDevice],
                borderLeft: previewDevice !== "desktop" ? "1px solid var(--border)" : undefined,
                borderRight: previewDevice !== "desktop" ? "1px solid var(--border)" : undefined,
              }}
              data-studio-preview-frame
              data-preview-device={previewDevice}
            />
          </div>
        ) : (
          <div className="mx-auto flex w-full items-start justify-center gap-6 px-4 pb-24 pt-6 sm:px-6">
            <div className="w-full min-w-0" style={{ maxWidth }}>
              <StudioOnboardingChecklist
                ready={!!me}
                starterChosen={
                  page?.config ? normalizeStudioConfig(page.config).starterId !== null : false
                }
                hasProjects={(me?.projects?.length ?? 0) > 0}
                hasBio={!!me?.profile?.bio?.trim()}
                hasBanner={!!me?.profile?.banner_url}
                published={page?.status === "published"}
                isPublishing={publishPage.isPending}
                onChooseFeel={() => navigate({ to: "/studio" })}
                onAddProject={() => setProjectDialogOpen(true)}
                onCompleteProfile={onCompleteProfile}
                onPublish={handlePublish}
              />
              {!layout || layout.sections.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-xs text-muted-foreground">
                    No blocks yet — add them in Customize to build your Studio.
                  </p>
                </div>
              ) : (
                <div
                  className="flex flex-col"
                  style={{ gap: "calc(var(--studio-gap, 14px) * 1.6)" }}
                >
                  {layout.sections
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .filter((section) => shouldRenderSectionInView(section, emptyBlocks))
                    .map((section) => (
                      <StudioViewSection
                        key={section.id}
                        section={section}
                        context={blockContext}
                        revealEdits={revealEdits}
                        onEdit={() =>
                          navigate({
                            to: "/studio",
                            search: {
                              section: section.id,
                              block: section.blocks[0]?.id ?? undefined,
                            },
                          })
                        }
                      />
                    ))}
                </div>
              )}
            </div>
            <StudioNextStepsRail
              setup={setupPercent}
              showcase={showcasePercent}
              items={studioSteps}
              onCompleteProfile={onCompleteProfile}
              onOpenEditor={() => navigate({ to: "/studio" })}
            />
          </div>
        )}
      </main>
      <ProjectDialog
        project={null}
        userId={userId}
        allSkills={allSkills}
        initialSkillIds={[]}
        open={projectDialogOpen}
        onOpenChange={(open) => {
          setProjectDialogOpen(open);
          if (!open) markEdited();
        }}
        onSaved={() => {
          setProjectDialogOpen(false);
          markEdited();
          queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
        }}
      />
    </div>
  );
}

/** Quiet line when some areas are hidden: the creator's view shows sections the
 *  public can't see yet, so hiding one shouldn't look like a deletion. */
function StudioHiddenSectionsStrip({ count, onEdit }: { count: number; onEdit: () => void }) {
  if (count === 0) return null;
  return (
    <div className="border-b border-border/40 bg-[var(--surface-sunken)]/60 px-4 py-1.5">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2">
        <p className="text-xs text-muted-foreground">
          {count} hidden {count === 1 ? "area" : "areas"} — not visible to visitors.
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium text-foreground transition-lift hover:bg-[var(--surface-elevated)]"
        >
          <Pencil className="h-3 w-3" />
          Edit in Customize
        </button>
      </div>
    </div>
  );
}

/** Slim draft notice with a one-click Publish action. This is the creator's
 *  home surface — the single most important action here is making the Studio
 *  live, and it shouldn't require opening the full editor. */
function StudioPublishStrip({
  published,
  hasContent,
  publishing,
  onPublish,
}: {
  published: boolean;
  hasContent: boolean;
  publishing: boolean;
  onPublish: () => void;
}) {
  if (published || !hasContent) return null;
  return (
    <div className="border-b border-caution/25 bg-caution/5 px-4 py-2">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2">
        <p className="text-xs text-caution">Draft — visitors can&apos;t see your Studio yet.</p>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-7 shrink-0 border-caution/40 text-caution hover:bg-caution/10 hover:text-caution"
          onClick={onPublish}
          disabled={publishing}
        >
          {publishing ? "Publishing…" : "Publish now"}
        </Button>
      </div>
    </div>
  );
}

/** Compact "what's next" rail for the creator's own Studio. Reuses the profile
 *  completeness model; every row routes into the setup form, which is the same
 *  surface the top bar already opens. Hidden below 2xl so the canvas keeps its
 *  configured width on smaller screens. */
function StudioNextStepsRail({
  setup,
  showcase,
  items,
  onCompleteProfile,
  onOpenEditor,
}: {
  setup: number;
  showcase: number;
  items: Section[];
  onCompleteProfile?: () => void;
  onOpenEditor: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <aside className="sticky top-6 hidden w-72 shrink-0 2xl:block">
      <div className="rounded-xl border border-border/60 bg-surface/60 p-4">
        <header className="flex items-center justify-between">
          <span className="t-label">Studio steps</span>
          <span className="text-xs text-muted-foreground">
            {items.length}
            {items.length === 1 ? " step" : " steps"} left
          </span>
        </header>
        <div className="mt-3 space-y-2">
          <CompletenessBar label="Setup" value={setup} />
          <CompletenessBar label="Showcase" value={showcase} />
        </div>
        <ul className="mt-3 space-y-1 border-t border-border/40 pt-3">
          {items.map((step) => (
            <li key={step.key}>
              <button
                type="button"
                onClick={onCompleteProfile}
                className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-lift hover:bg-[var(--user-accent-subtle,var(--surface-elevated))]"
              >
                <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs leading-snug text-foreground/90">{step.label}</span>
                <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-fade group-hover:opacity-60" />
              </button>
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={onOpenEditor}>
          <Pencil className="h-3 w-3" />
          Open Customize
        </Button>
      </div>
    </aside>
  );
}

function CompletenessBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-2xs text-muted-foreground">{label}</span>
      <div
        className="h-1 flex-1 overflow-hidden rounded-full bg-border/60"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} completeness ${value}%`}
      >
        <div
          className="h-full rounded-full bg-[var(--user-accent,var(--primary))]"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right font-mono text-3xs text-muted-foreground">
        {value}%
      </span>
    </div>
  );
}

function StudioViewTopBar({
  profile,
  published,
  mode,
  device,
  onBack,
  onOpenEditor,
  onToggleMode,
  onDeviceChange,
}: {
  profile: { display_name: string | null; handle: string | null } | null;
  published: boolean;
  mode: "view" | "preview";
  device: PreviewDevice;
  onBack?: () => void;
  onOpenEditor: () => void;
  onToggleMode: () => void;
  onDeviceChange: (device: PreviewDevice) => void;
}) {
  return (
    // The authenticated shell already provides the sticky app navbar; this
    // owner chrome intentionally doesn't draw its own sticky bar (no border,
    // transparent background) so the Studio doesn't stack two headers.
    <header className="z-40 bg-transparent">
      <div className="flex min-h-10 items-center gap-2 px-3 py-1.5">
        {onBack && (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-foreground">Studio</span>
          <span
            className={`hidden border px-1.5 py-0.5 font-mono text-3xs sm:inline ${
              published ? "border-trust text-trust" : "border-caution text-caution"
            }`}
          >
            {published ? "Live" : "Draft"}
          </span>
        </div>
        <div className="mx-auto hidden sm:block">
          <span className="truncate text-xs text-muted-foreground">
            {profile?.display_name || `@${profile?.handle ?? ""}`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant={mode === "preview" ? "default" : "ghost"}
            size="sm"
            onClick={onToggleMode}
            title={mode === "view" ? "Open visitor view" : "Return to quick edit"}
            aria-pressed={mode === "preview"}
          >
            <Sparkles className="h-3 w-3" />
            <span className="hidden sm:inline">
              {mode === "view" ? "Public view" : "Quick edit"}
            </span>
          </Button>
          {mode === "preview" && (
            <div
              className="flex border border-border p-0.5"
              role="radiogroup"
              aria-label="Preview device"
            >
              {(
                [
                  ["desktop", Monitor, "Desktop preview"],
                  ["tablet", Tablet, "Tablet preview"],
                  ["mobile", Smartphone, "Mobile preview"],
                ] as Array<[PreviewDevice, typeof Monitor, string]>
              ).map(([item, Icon, label]) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={device === item}
                  aria-label={label}
                  title={label}
                  onClick={() => onDeviceChange(item)}
                  className={cn(
                    "flex h-6 w-7 items-center justify-center rounded-sm text-muted-foreground transition-lift",
                    device === item
                      ? "border border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)] text-[var(--user-accent)]"
                      : "border border-transparent hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          )}
          {profile?.handle && (
            <a
              href={`/u/${profile.handle}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-[var(--surface-sunken)] hover:text-foreground"
              title="Open your public page"
              aria-label="Open your public page"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <Button variant="default" size="sm" onClick={onOpenEditor}>
            <Pencil className="h-3 w-3" />
            Customize
          </Button>
        </div>
      </div>
    </header>
  );
}

function StudioViewSection({
  section,
  context,
  onEdit,
  revealEdits,
}: {
  section: LayoutSection;
  context: BlockContext;
  onEdit: () => void;
  /** Until first edit, section edit buttons are always visible (discoverability). */
  revealEdits: boolean;
}) {
  const blocks = section.blocks
    .slice()
    .sort((a, b) => a.position - b.position)
    .filter((block) => block.visible !== false);

  if (blocks.length === 0) return null;

  const gridClass = SECTION_GRID[section.layout] ?? "";
  const hasGrid = (section.grid?.length ?? 0) > 0;
  const gridMap = new Map((section.grid ?? []).map((item) => [item.i, item]));

  return (
    <section aria-label={section.title ?? section.layout} className="group/section relative">
      {section.title && !/^area\s+\d+$/i.test(section.title) && (
        <header className="mb-2 flex items-center gap-2">
          <span className="h-3 w-0.5" style={{ backgroundColor: "var(--user-accent)" }} />
          <span className="t-label">{section.title}</span>
          <span className="t-rule flex-1" />
          <button
            type="button"
            onClick={onEdit}
            title="Edit this area in Customize"
            aria-label="Edit this area in Customize"
            className={cn(
              "flex h-6 items-center gap-1 rounded-sm px-1.5 text-muted-foreground transition-lift hover:bg-[var(--surface-elevated)] hover:text-foreground focus-visible:opacity-100",
              revealEdits ? "opacity-100" : "opacity-0 group-hover/section:opacity-100",
            )}
          >
            <Pencil className="h-3 w-3" />
          </button>
        </header>
      )}
      <div
        className={
          hasGrid
            ? "grid grid-cols-1 gap-8 content-safe md:grid-cols-12"
            : `${gridClass} content-safe`
        }
        style={
          hasGrid
            ? { gridAutoFlow: "row dense", alignItems: "start" }
            : gridClass
              ? { gridAutoFlow: "row", alignItems: "start" }
              : undefined
        }
      >
        {blocks.map((block) => (
          <StudioViewBlock
            key={block.id}
            block={block}
            gridItem={gridMap.get(block.id)}
            gridClass={gridClass}
            hasGrid={hasGrid}
            context={context}
          />
        ))}
      </div>
    </section>
  );
}

function StudioViewBlock({
  block,
  gridItem,
  gridClass,
  hasGrid,
  context,
}: {
  block: LayoutBlockInstance;
  gridItem?: LayoutGridItem;
  gridClass: string;
  hasGrid: boolean;
  context: BlockContext;
}) {
  const span = Math.max(1, Math.min(12, gridItem?.w ?? block.span ?? 12));
  const def = getBlock(block.type);
  return (
    <div
      className={
        hasGrid
          ? gridItem
            ? `relative min-w-0 ${colStartClass(gridItem.x + 1)} ${spanClass(span)}`
            : "relative min-w-0"
          : gridClass
            ? `min-w-0 ${spanClass(span)}`
            : "min-w-0"
      }
      style={{ borderRadius: "var(--studio-radius)" }}
    >
      <div
        className={cn(
          "relative h-full min-h-0 overflow-hidden studio-block",
          (def?.containerless || block.type === "profile-header") && "studio-block-flush",
        )}
      >
        <BlockRenderer
          type={block.type}
          config={block.config}
          context={{ ...context, blockId: block.id }}
          onChange={() => undefined}
        />
      </div>
    </div>
  );
}

/** First-session onboarding checklist. Derived entirely from data already loaded
 *  by the parent (no new queries). Shows a dismissable list of content wins;
 *  disappears once 3/5 are done — at that point the publish strip and next-steps
 *  rail carry the remaining journey. Dismissal persisted in localStorage. */
function StudioOnboardingChecklist({
  ready,
  starterChosen,
  hasProjects,
  hasBio,
  hasBanner,
  published,
  isPublishing,
  onChooseFeel,
  onAddProject,
  onCompleteProfile,
  onPublish,
}: {
  ready: boolean;
  starterChosen: boolean;
  hasProjects: boolean;
  hasBio: boolean;
  hasBanner: boolean;
  published: boolean;
  isPublishing: boolean;
  onChooseFeel: () => void;
  onAddProject: () => void;
  onCompleteProfile?: () => void;
  onPublish: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem("studio-onboarding-dismissed") === "1");
  }, []);
  const dismiss = useCallback(() => {
    setDismissed(true);
    if (typeof window !== "undefined")
      window.localStorage.setItem("studio-onboarding-dismissed", "1");
  }, []);

  if (!ready || dismissed) return null;

  const steps = [
    {
      key: "feel",
      label: "Choose a starting feel",
      done: starterChosen,
      action: onChooseFeel,
    },
    {
      key: "project",
      label: "Add your first project",
      done: hasProjects,
      action: onAddProject,
    },
    {
      key: "bio",
      label: "Write a short bio",
      done: hasBio,
      action: onCompleteProfile,
    },
    {
      key: "banner",
      label: "Upload a banner",
      done: hasBanner,
      action: onCompleteProfile,
    },
    {
      key: "publish",
      label: "Publish your Studio",
      done: published,
      action: isPublishing ? undefined : onPublish,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount >= 3) return null;

  return (
    <div className="mb-4 rounded-xl border border-border/60 bg-surface/60 p-4">
      <header className="flex items-center justify-between gap-2">
        <span className="t-label">Make it yours</span>
        <div className="flex items-center gap-2">
          <span className="text-2xs text-muted-foreground">
            {doneCount}/{steps.length}
          </span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="rounded p-0.5 text-muted-foreground transition-lift hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>
      <p className="mt-1 text-2xs text-muted-foreground-subtle">
        A few quick wins to make your Studio a place you'd be happy to share.
      </p>
      <ul className="mt-3 space-y-1">
        {steps.map((step) => (
          <li key={step.key}>
            <button
              type="button"
              disabled={step.done || !step.action}
              onClick={step.action}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-lift",
                step.done
                  ? "cursor-default text-foreground/70"
                  : "hover:bg-[var(--user-accent-subtle,var(--surface-elevated))]",
              )}
            >
              {step.done ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-trust" />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span
                className={cn(
                  "text-xs leading-snug",
                  step.done && "line-through decoration-foreground/30",
                )}
              >
                {step.label}
              </span>
              {!step.done && <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
