import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutTemplate, Plus, X } from "lucide-react";
import type { AreaAppearance } from "@/lib/page-blocks";
import { BackgroundLayer } from "@/components/tethyr/background-layer";
import {
  appearanceStyle,
  withCardBorderPreference,
  type CardBorderPreference,
} from "@/lib/background-themes";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUserPalette } from "@/lib/dominant-color";
import { useProfileTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import type {
  BlockConfig,
  LayoutBlockInstance,
  LayoutGridItem,
  LayoutSection,
  PageLayout,
  PageVersion,
} from "@/lib/page-blocks";
import { themeTokensToStyle } from "@/lib/theme-tokens";
import { cn } from "@/lib/utils";
import {
  structureMaxWidthCss,
  studioConfigToThemeTokens,
  type StudioConfig,
} from "@/lib/studio-config";
import {
  CARD_SURFACE_STYLE,
  cardFillStyle,
  studioBackgroundVars,
  studioSurfaceStyle,
} from "@/lib/studio-config-style";
import { type GridArrangement } from "@/lib/studio-grid";
import { useCardInk } from "@/hooks/use-card-ink";
import { useMediaQuery } from "@/hooks/use-mobile";
import { IconButton } from "./studio-controls";
import { LookFilters, lookCanvasAttributes } from "@/components/tethyr/page/look-canvas";
import { GStudioPreviewFrame } from "./studio-preview-frame";
import { GStudioTopBar } from "./studio-top-bar";
import { GStudioRail, type RailTab } from "./studio-rail";
import { GMobileEditSheet } from "./studio-mobile-sheet";
import { GSectionBand } from "./g-section-band";

/** GStudioConfig keeps the legacy component-local name so callers don't churn. */
export type GStudioConfig = StudioConfig;

export type GStudioMode = "view" | "edit" | "preview";
export type GStudioDevice = "desktop" | "tablet" | "mobile";

export interface GStudioSurfaceProps {
  layout: PageLayout;
  config: GStudioConfig;
  mode: GStudioMode;
  device: GStudioDevice;
  selectedBlockId: string | null;
  /** Every selected block, in the order picked (the last is the primary). */
  selectedBlockIds: string[];
  dragType: string | null;
  paletteTarget: string | null;
  dirty: boolean;
  saving: boolean;
  published: boolean;
  /** Working layout differs from the latest published snapshot. */
  hasUnpublishedChanges: boolean;
  /** What will change for visitors on publish (shown on the status). */
  unpublishedSummary?: string[];
  /** Published version snapshots, newest first. */
  versions: PageVersion[];
  /** Latest published version number, or null when never published. */
  publishedVersion: number | null;
  canUndo: boolean;
  canRedo: boolean;
  profile: { id: string; handle: string | null; display_name: string | null } | null;
  userId: string;
  onModeChange: (mode: GStudioMode) => void;
  onDeviceChange: (device: GStudioDevice) => void;
  /** Select a block; `toggle` adds it to (or drops it from) the selection. */
  onSelect: (id: string | null, options?: { toggle?: boolean }) => void;
  /** Live grid updates (drag/resize frames, auto-fit) — not undo steps. */
  onGridChange: (sectionId: string, grid: LayoutGridItem[]) => void;
  /** Content auto-fit of row heights — never an edit, never saved alone. */
  onGridFit: (sectionId: string, grid: LayoutGridItem[]) => void;
  /** A discrete grid edit (the width stepper), recorded as one undo step. */
  onResizeBlock: (sectionId: string, grid: LayoutGridItem[]) => void;
  onGridInteractionStart: () => void;
  onGridInteractionEnd: () => void;
  onUpdateBlockConfig: (id: string, config: BlockConfig) => void;
  onBlockAction: (id: string, patch: Partial<LayoutBlockInstance>) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onMoveSection: (id: string, direction: -1 | 1) => void;
  onToggleSection: (id: string) => void;
  /** Remove an area that has no blocks left. */
  onRemoveSection: (id: string) => void;
  /** Open the command palette (Ctrl/⌘+J). */
  onOpenCommands?: () => void;
  onRenameSection: (id: string, title: string) => void;
  onSectionLayoutChange: (sectionId: string, layout: LayoutSection["layout"]) => void;
  /** Apply one style patch to several blocks as a single undo step. */
  onApplyBlockStyle: (
    blockIds: string[],
    patch: Partial<LayoutBlockInstance>,
    message?: string,
  ) => void;
  /** Remove several blocks as one undo step (locked ones are kept). */
  onRemoveBlocks: (blockIds: string[]) => void;
  /** Lay several blocks out relative to the first one picked. */
  onArrangeBlocks: (blockIds: string[], how: GridArrangement) => void;
  /** Move several blocks into a new area. */
  onGroupIntoArea: (blockIds: string[]) => void;
  /** Open an area's settings in the rail (set by the surface itself). */
  onEditArea?: (sectionId: string) => void;
  /** The area whose settings the rail shows. */
  editingAreaId?: string | null;
  /** Change how an area presents itself (title, background, spacing). */
  onSectionAppearanceChange: (sectionId: string, patch: AreaAppearance) => void;
  onAddSection: () => void;
  onMoveToSection: (
    id: string,
    sectionId: string,
    placement?: { col: number; row: number },
  ) => void;
  onAdd: (type: string, sectionId?: string, placement?: LayoutGridItem) => void;
  /** Open the shared background/appearance dialog (banner → Appearance). */
  onOpenAppearance?: () => void;
  /** Open the Templates picker (starter directions). Multiple entry points:
   *  top bar, Customize panel, and the mobile Style tab. */
  onOpenTemplates?: () => void;
  /** First-run invitation to pick a starting direction, shown as a strip
   *  under the top bar instead of a modal over the editor. */
  starterPrompt?: { onBrowse: () => void; onDismiss: () => void };
  /** Publish the current Studio layout as a community template. */
  onSaveAsTemplate?: () => void;
  onDragTypeChange: (type: string | null) => void;
  onPaletteTargetChange: (id: string) => void;
  onCustomizeChange: (patch: Partial<GStudioConfig>) => void;
  /** The page's current theme id ("" when unset) — drives the Theme picker
   *  and the live token preview on the canvas. */
  themeId: string | null;
  /** Change the page's theme (null clears back to the default). */
  onThemeChange: (themeId: string | null) => void;
  /** Live card-border preference: the member's appearance, editable in
   *  Customize and persisted to `profiles.background` by the creator. */
  cardBorders: CardBorderPreference;
  cardBorderColor: string;
  onCardBordersChange: (cardBorders: CardBorderPreference) => void;
  onCardBorderColorChange: (color: string) => void;
  onSave: () => void;
  onPublish: () => void;
  onRollback: (version: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onCompleteProfile?: () => void;
  onReset: () => void;
  /** Leave customization and return to the Studio view. */
  onExit?: () => void;
  /** Open the first-project creation dialog (used by empty block guidance). */
  onAddProject?: () => void;
  /** Timestamp (ms) of the last successful draft save/publish — shown as a
   *  quiet "Saved just now" stamp in the top bar once the draft is clean. */
  lastSavedAt?: number | null;
  /** Tracks blocks whose content is empty (preview only) so empty sections
   *  collapse like they do on the published page. */
  onBlockEmptyChange?: (blockId: string, isEmpty: boolean) => void;
  emptyBlockIds?: Set<string>;
  /** The id of a freshly added section whose rename input should auto-focus. */
  autoRenameId?: string | null;
  /** Callback fired once the auto-focus rename has been triggered. */
  onRenameFocusHandled?: () => void;
}

/** Preview frame widths. The preview is the real public page in an iframe,
 *  so these are true viewport widths and every breakpoint applies. */
const DEVICE_WIDTHS: Record<GStudioDevice, number | undefined> = {
  desktop: undefined,
  tablet: 834,
  mobile: 390,
};

export function GStudioSurface(props: GStudioSurfaceProps) {
  const { data: me } = useCurrentUser();
  const palette = useUserPalette(me?.bannerSigned ?? null);
  // Live theme preview: derive the page theme's CSS vars for the active
  // light/dark scheme so picking a preset repaints the canvas immediately.
  const { vars: themeVars, scheme } = useProfileTheme(props.themeId, props.config);
  // One side rail with three tabs (Style, Add, Block) instead of a panel on
  // each side: selecting a block switches tabs rather than squeezing the
  // canvas. Style starts open on desktop so customizing is discoverable.
  const [railTab, setRailTab] = useState<RailTab | null>(() =>
    typeof window !== "undefined" && window.innerWidth >= 1024 ? "style" : null,
  );
  // The tab to return to when the selection clears while Block is showing.
  const lastPanelTabRef = useRef<Exclude<RailTab, "block">>("style");
  if (railTab && railTab !== "block") lastPanelTabRef.current = railTab;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const editArea = (sectionId: string) => {
    setEditingAreaId(sectionId);
    setRailTab("area");
  };
  const [emptyBlocks, setEmptyBlocks] = useState<Set<string>>(() => new Set());
  const [snapToBlocks, setSnapToBlocks] = useState(true);
  // "Show layout grid": the 12 columns stay visible while editing (they
  // always appear during a drag or resize). Remembered per browser.
  const [showGrid, setShowGrid] = useState(false);
  useEffect(() => {
    try {
      setShowGrid(window.localStorage.getItem("studio-show-grid") === "1");
    } catch {
      // Storage unavailable: off.
    }
  }, []);
  const toggleShowGrid = (next: boolean) => {
    setShowGrid(next);
    try {
      window.localStorage.setItem("studio-show-grid", next ? "1" : "0");
    } catch {
      // Storage unavailable: lasts this visit.
    }
  };
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
  const compact = useMediaQuery("(max-width: 1023px)");
  const touch = useMediaQuery("(pointer: coarse)");
  // Drag and resize wherever the grid is shown (phones get one stacked
  // column instead), touch included: on touch screens a drag starts from the
  // grip so the canvas still scrolls.
  const directManipulation = !useMediaQuery("(max-width: 767px)");
  const editing = props.mode === "edit";
  const deviceWidth = props.mode === "preview" ? DEVICE_WIDTHS[props.device] : undefined;
  const maxWidth = structureMaxWidthCss(props.config);
  const sections = props.layout.sections;
  // Card borders live on the member's appearance. For live canvas preview the
  // builder composes the current draft preference over the saved background.
  const borderPreview = useMemo(
    () =>
      me?.background
        ? withCardBorderPreference(me.background, props.cardBorders, props.cardBorderColor)
        : undefined,
    [me?.background, props.cardBorders, props.cardBorderColor],
  );
  const cardInk = useCardInk(props.config);
  const surfaceStyle = {
    ...themeVars,
    ...themeTokensToStyle(studioConfigToThemeTokens(props.config), scheme),
    ...studioSurfaceStyle(props.config, palette?.dominant ?? null),
    ...appearanceStyle(borderPreview),
    ...cardFillStyle(props.config),
    // The template's app-scope backdrop choice paints the canvas, so the
    // builder previews on the same backdrop the published page will.
    ...studioBackgroundVars(props.config, "app"),
  };

  // Follow the selection: a selected block (including one just added) shows
  // its settings; clearing it returns to the panel that was open before.
  useEffect(() => {
    if (props.selectedBlockId) setRailTab("block");
    else setRailTab((tab) => (tab === "block" ? lastPanelTabRef.current : tab));
  }, [props.selectedBlockId]);
  const toggleTab = (tab: Exclude<RailTab, "block">) =>
    setRailTab((current) => (current === tab ? null : tab));

  return (
    // The member's theme, personality and card ink apply to the canvas only.
    // Editor chrome (top bar, panels, sheets) stays on the app's own tokens so
    // a low-contrast theme can't make the controls unreadable.
    <div
      className="relative flex h-[calc(100dvh-3rem)] min-h-0 flex-col overflow-hidden bg-background"
      data-studio-builder="g"
    >
      <a
        href="#studio-canvas"
        className="sr-only z-50 bg-[var(--surface-elevated)] px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:left-2 focus:top-2"
      >
        Skip to the canvas
      </a>
      <GStudioTopBar
        mode={props.mode}
        device={props.device}
        compact={compact}
        dirty={props.dirty}
        saving={props.saving}
        published={props.published}
        hasUnpublishedChanges={props.hasUnpublishedChanges}
        unpublishedSummary={props.unpublishedSummary ?? []}
        publishedVersion={props.publishedVersion}
        lastSavedAt={props.lastSavedAt}
        canUndo={props.canUndo}
        canRedo={props.canRedo}
        historyOpen={historyOpen}
        snapToBlocks={snapToBlocks}
        onSnapToBlocksChange={setSnapToBlocks}
        showGrid={showGrid}
        onShowGridChange={toggleShowGrid}
        onHistory={() => setHistoryOpen((open) => !open)}
        onCommands={props.onOpenCommands}
        onHistoryClosed={() => setHistoryOpen(false)}
        onModeChange={props.onModeChange}
        onDeviceChange={props.onDeviceChange}
        onUndo={props.onUndo}
        onRedo={props.onRedo}
        onCustomize={() => toggleTab("style")}
        onPalette={() => {
          // From the top bar, add to the area in view, not a stale target.
          props.onPaletteTargetChange("");
          toggleTab("add");
        }}
        onSave={props.onSave}
        onPublish={props.onPublish}
        customizeOpen={railTab === "style"}
        paletteOpen={railTab === "add"}
        onExit={props.onExit}
        profile={props.profile}
        onTemplates={props.onOpenTemplates}
        onSaveAsTemplate={props.onSaveAsTemplate}
        onReset={props.onReset}
        // One shortcut sheet for the whole app (also on "?"), Studio included.
        onShortcuts={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))}
        versions={props.versions}
        onRollback={props.onRollback}
      />
      {editing && props.starterPrompt && <GStarterStrip {...props.starterPrompt} />}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {props.mode === "preview" ? (
          <GStudioPreviewFrame
            handle={props.profile?.handle ?? null}
            width={deviceWidth}
            saving={props.saving}
            reloadKey={props.lastSavedAt ?? 0}
          />
        ) : (
          <div
            role="region"
            id="studio-canvas"
            tabIndex={-1}
            className="relative isolate min-w-0 flex-1 overflow-y-auto outline-none bg-[var(--studio-bg,var(--background))] bg-noise text-foreground"
            aria-label="Studio canvas"
            data-personality={props.config.personality}
            // The canvas is the member's profile: Tethyr's own palette under
            // their theme, never the editor's Site appearance.
            data-base-palette=""
            data-scheme={scheme}
            style={{ ...surfaceStyle, colorScheme: scheme }}
          >
            {/* Pinned to the visible canvas: absolute inside this scroll box,
                the backdrop scrolled away after the first screen. */}
            <div aria-hidden className="pointer-events-none sticky top-0 -z-10 h-0">
              <div className="relative h-[calc(100dvh-3rem)]">
                <BackgroundLayer
                  background={me?.background}
                  imageUrl={me?.backgroundImageUrl}
                  bannerColor={palette?.dominant ?? null}
                />
              </div>
            </div>
            {/* Card surfaces nest under the theme tokens they derive from. */}
            <div
              ref={cardInk.ref}
              data-card-ink={cardInk.active ? "" : undefined}
              // Bottom room for the docked phone editor bar so it never covers a block.
              className={cn(
                "studio-canvas relative isolate mx-auto w-full",
                editing && compact && "pb-36",
              )}
              {...lookCanvasAttributes(props.config)}
              style={{
                ...CARD_SURFACE_STYLE,
                ...cardInk.style,
                maxWidth,
              }}
            >
              <LookFilters />
              <GStudioCanvas
                {...props}
                sections={sections}
                editing={editing}
                directManipulation={directManipulation}
                touchDrag={touch}
                onBlockEmptyChange={handleBlockEmpty}
                emptyBlockIds={emptyBlocks}
                snapToBlocks={snapToBlocks}
                showGrid={showGrid}
                onEditArea={editArea}
                editingAreaId={railTab === "area" ? editingAreaId : null}
                onGridChange={props.onGridChange}
                onRequestPalette={(sectionId) => {
                  props.onPaletteTargetChange(sectionId);
                  setRailTab("add");
                }}
              />
            </div>
          </div>
        )}
        {editing && railTab && (
          <GStudioRail
            {...props}
            editingAreaId={editingAreaId}
            onEditArea={editArea}
            emptyBlockIds={emptyBlocks}
            tab={railTab}
            onTabChange={setRailTab}
          />
        )}
        {editing && compact && <GMobileEditSheet {...props} />}
      </div>
    </div>
  );
}

function GStarterStrip({ onBrowse, onDismiss }: { onBrowse: () => void; onDismiss: () => void }) {
  return (
    <div
      role="region"
      aria-label="Starting directions"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-[var(--surface-elevated)] px-4 py-2"
    >
      <LayoutTemplate className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Not sure where to start?</span> Pick a
        starting direction.
        <span className="hidden sm:inline">
          {" "}
          It rearranges what you have, and one undo puts it back.
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="secondary" onClick={onBrowse}>
          Browse directions
        </Button>
        <IconButton label="Dismiss starting directions" onClick={onDismiss}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

function GStudioCanvas({
  sections,
  editing,
  directManipulation,
  touchDrag,
  snapToBlocks,
  showGrid,
  onRequestPalette,
  ...props
}: GStudioSurfaceProps & {
  sections: LayoutSection[];
  editing: boolean;
  directManipulation: boolean;
  touchDrag: boolean;
  snapToBlocks: boolean;
  showGrid: boolean;
  onRequestPalette: (id: string) => void;
}) {
  return (
    <div
      className="mx-auto w-full px-4 pb-24 pt-5 sm:px-6"
      onClick={() => editing && props.onSelect(null)}
    >
      <div className="flex flex-col" style={{ gap: "calc(var(--studio-gap, 14px) * 1.6)" }}>
        {sections.map((section, index) => (
          <GSectionBand
            key={section.id}
            section={section}
            index={index}
            total={sections.length}
            editing={editing}
            directManipulation={directManipulation}
            touchDrag={touchDrag}
            snapToBlocks={snapToBlocks}
            showGrid={showGrid}
            {...props}
            onRequestPalette={onRequestPalette}
          />
        ))}
        {editing && (
          <button
            type="button"
            id="studio-add-section"
            onClick={props.onAddSection}
            className="flex w-full items-center justify-center gap-1.5 border border-dashed border-border py-3 font-mono text-2xs uppercase tracking-widest text-muted-foreground outline-none hover:border-[var(--user-accent-border)] hover:text-[var(--user-accent-text)] focus-visible:border-[var(--user-accent-border)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1"
          >
            <Plus className="h-3.5 w-3.5" /> New area
          </button>
        )}
      </div>
    </div>
  );
}
