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
import { CURRENT_USER_KEY, useCurrentUser, useSkillsCatalog } from "@/hooks/use-current-user";
import { ProjectDialog } from "@/components/tethyr/profile";
import { BackgroundLayer } from "@/components/tethyr/background-layer";
import { appearanceStyle } from "@/lib/background-themes";
import { useUserPalette } from "@/lib/dominant-color";
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
import { Button } from "@/components/ui/button";
import {
  CARD_SURFACE_STYLE,
  cardFillStyle,
  studioConfigToStyle,
  EDITORIAL_HEADING_FONT,
  TECHNICAL_HEADING_FONT,
  structureMaxWidth,
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

/** Tailwind span classes for each grid width (1–12). Declared as literals so
 *  Tailwind's scanner generates every variant. */
const SPAN_CLASS: Record<number, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
  7: "md:col-span-7",
  8: "md:col-span-8",
  9: "md:col-span-9",
  10: "md:col-span-10",
  11: "md:col-span-11",
  12: "md:col-span-12",
};

export function StudioView({ userId, profile, onBack, onCompleteProfile }: StudioViewProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"view" | "preview">("view");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
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
  const surfaceStyle = {
    ...studioSurfaceStyle(config),
    ...appearanceStyle(me?.background),
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
        onCompleteProfile={onCompleteProfile}
        onOpenEditor={() => navigate({ to: "/studio" })}
        onToggleMode={() => setMode((m) => (m === "view" ? "preview" : "view"))}
        onDeviceChange={setPreviewDevice}
      />
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
      <main
        className="relative min-w-0 flex-1 overflow-y-auto bg-noise"
        aria-label="Studio"
        style={CARD_SURFACE_STYLE}
      >
        <BackgroundLayer
          background={me?.background}
          imageUrl={me?.backgroundImageUrl}
          bannerColor={palette?.dominant ?? null}
        />
        {mode === "preview" && profile?.handle ? (
          <div className="flex h-full w-full justify-center overflow-y-auto bg-noise">
            <iframe
              title="Public Studio preview"
              src={`/u/${profile.handle}?embed=true`}
              className="h-full w-full border-0 bg-background"
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
        onOpenChange={setProjectDialogOpen}
        onSaved={() => {
          setProjectDialogOpen(false);
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
          className="ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium text-foreground transition hover:bg-[var(--surface-elevated)]"
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
                className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-[var(--user-accent-subtle,var(--surface-elevated))]"
              >
                <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs leading-snug text-foreground/90">{step.label}</span>
                <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-60" />
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
  onCompleteProfile,
  onOpenEditor,
  onToggleMode,
  onDeviceChange,
}: {
  profile: { display_name: string | null; handle: string | null } | null;
  published: boolean;
  mode: "view" | "preview";
  device: PreviewDevice;
  onBack?: () => void;
  onCompleteProfile?: () => void;
  onOpenEditor: () => void;
  onToggleMode: () => void;
  onDeviceChange: (device: PreviewDevice) => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[var(--surface-elevated)]">
      <div className="flex min-h-10 items-center gap-2 px-3 py-1.5">
        {onBack && (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-2xs font-semibold uppercase tracking-[0.18em] text-foreground">
            Tethyr
          </span>
          <span className="text-muted-foreground-subtle" aria-hidden>
            /
          </span>
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
          {onCompleteProfile && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={onCompleteProfile}
            >
              Complete profile
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onToggleMode} title="Toggle preview">
            <Sparkles className="h-3 w-3" />
            <span className="hidden sm:inline">
              {mode === "view" ? "View as visitor" : "Back to quick edit"}
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
                    "flex h-6 w-7 items-center justify-center rounded-sm text-muted-foreground transition",
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
}: {
  section: LayoutSection;
  context: BlockContext;
  onEdit: () => void;
}) {
  const blocks = section.blocks
    .slice()
    .sort((a, b) => a.position - b.position)
    .filter((block) => block.visible !== false);

  if (blocks.length === 0) return null;

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
            className="flex h-6 items-center gap-1 rounded-sm px-1.5 text-muted-foreground opacity-0 transition hover:bg-[var(--surface-elevated)] hover:text-foreground focus-visible:opacity-100 group-hover/section:opacity-100"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </header>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {blocks.map((block) => (
          <StudioViewBlock
            key={block.id}
            block={block}
            gridItem={gridMap.get(block.id)}
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
  context,
}: {
  block: LayoutBlockInstance;
  gridItem?: LayoutGridItem;
  context: BlockContext;
}) {
  const span = Math.max(1, Math.min(12, gridItem?.w ?? 12));
  return (
    <div
      className={SPAN_CLASS[span] ?? "md:col-span-12"}
      style={{ borderRadius: "var(--studio-radius)" }}
    >
      <div className="relative h-full min-h-0 overflow-hidden studio-block">
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
            className="rounded p-0.5 text-muted-foreground transition hover:text-foreground"
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
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition",
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

/** Page-local style: studio accent variables + personality font hints. Mirrors
 *  g-studio-surface's studioSurfaceStyle so the view and editor match. */
function studioSurfaceStyle(config: StudioConfig): React.CSSProperties {
  const style = studioConfigToStyle(config) as React.CSSProperties & Record<string, string>;
  style["--studio-display-font"] = config.personality === "editorial" ? "Space Grotesk" : "Inter";
  style["--studio-label-font"] = config.personality === "technical" ? "JetBrains Mono" : "Inter";
  if (config.personality === "editorial") {
    style["--font-display"] = EDITORIAL_HEADING_FONT;
    style["--font-title"] = EDITORIAL_HEADING_FONT;
  } else if (config.personality === "technical") {
    style["--font-display"] = TECHNICAL_HEADING_FONT;
    style["--font-title"] = TECHNICAL_HEADING_FONT;
  }
  return style;
}
