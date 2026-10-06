import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  LayoutTemplate,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { ReactGridLayout as LegacyGridLayout, WidthProvider } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import { BlockRenderer } from "@/components/tethyr/page/block-renderer";
import { BackgroundLayer } from "@/components/tethyr/background-layer";
import {
  appearanceStyle,
  withCardBorderPreference,
  type CardBorderPreference,
} from "@/lib/background-themes";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUserPalette } from "@/lib/dominant-color";
import { useTheme } from "@/hooks/use-theme";
import { useTheme as useAppTheme } from "@/lib/theme";
import { SECTION_GRID, colStartClass, spanClass } from "@/components/tethyr/page/page-layout";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBlock } from "@/lib/block-registry";
import type {
  BlockConfig,
  BlockContext,
  LayoutBlockInstance,
  LayoutGridItem,
  LayoutSection,
  PageLayout,
  PageVersion,
} from "@/lib/page-blocks";
import { themeTokensToStyle } from "@/lib/theme-tokens";
import { cn } from "@/lib/utils";
import {
  blockFrameStyle,
  CARD_SURFACE_STYLE,
  cardFillStyle,
  studioBackgroundVars,
  structureMaxWidthCss,
  studioConfigToThemeTokens,
  studioSurfaceStyle,
  type StudioConfig,
} from "@/lib/studio-config";
import {
  COLS,
  fitGridItemToContent,
  sectionGrid,
  sectionLabel,
  settleGridSnap,
  sizeFor,
} from "@/lib/studio-grid";
import { useCardInk } from "@/hooks/use-card-ink";
import { useIsMobile, useMediaQuery } from "@/hooks/use-mobile";
import { IconButton } from "./studio-controls";
import { GStudioPreviewFrame } from "./studio-preview-frame";
import { GStudioTopBar } from "./studio-top-bar";
import { GStudioRail, type RailTab } from "./studio-rail";
import { GMobileEditSheet } from "./studio-mobile-sheet";

/** GStudioConfig keeps the legacy component-local name so callers don't churn. */
export type GStudioConfig = StudioConfig;

export type GStudioMode = "view" | "edit" | "preview";
export type GStudioDevice = "desktop" | "tablet" | "mobile";

/** RGL attaches its mouse listeners to each grid item's DOM node. Blocks that
 *  do not forward `onMouseDown`/`onMouseUp` silently disable drag; keep the
 *  event props flowing from the injected handlers down to the host element. */
type ForwardedGridEvents = {
  onMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onTouchEnd?: (event: React.TouchEvent<HTMLDivElement>) => void;
};

/** Pointer types that must never start a block drag while editing. Mirrors the
 *  project-page canvas cancel list (interactive controls stay clickable). */
const BLOCK_DRAG_CANCEL =
  "button, a, input, textarea, select, label, [role='button'], [contenteditable='true'], [data-no-drag]";

export interface GStudioSurfaceProps {
  layout: PageLayout;
  config: GStudioConfig;
  mode: GStudioMode;
  device: GStudioDevice;
  selectedBlockId: string | null;
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
  onSelect: (id: string | null) => void;
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
  onRenameSection: (id: string, title: string) => void;
  onSectionLayoutChange: (sectionId: string, layout: LayoutSection["layout"]) => void;
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

const EditorGrid = WidthProvider(LegacyGridLayout);
/** Preview frame widths. The preview is the real public page in an iframe,
 *  so these are true viewport widths and every breakpoint applies. */
const DEVICE_WIDTHS: Record<GStudioDevice, number | undefined> = {
  desktop: undefined,
  tablet: 834,
  mobile: 390,
};
/** Layout presets exposed in the section header. Choosing one seeds the grid. */
const SECTION_LAYOUT_OPTIONS: Array<{ value: LayoutSection["layout"]; label: string }> = [
  { value: "full", label: "Full" },
  { value: "two_column", label: "Two columns" },
  { value: "three_column", label: "Three columns" },
  { value: "sidebar_left", label: "Sidebar left" },
  { value: "sidebar_right", label: "Sidebar right" },
  { value: "feature", label: "Feature" },
  { value: "side_by_side", label: "Side by side" },
];

/** Tiny SVG wireframe showing a section's column arrangement. */
function LayoutThumbnail({ layout, small }: { layout: LayoutSection["layout"]; small?: boolean }) {
  const w = 36;
  const h = 24;
  const p = 2;
  const inner = { x: p, y: p, w: w - p * 2, h: h - p * 2 };
  const stroke = "var(--border-strong)";
  const accent = "var(--user-accent,var(--primary))";
  const rects: Array<{ x: number; y: number; w: number; h: number; fill?: string }> = [];

  switch (layout) {
    case "full":
      rects.push({ x: inner.x, y: inner.y, w: inner.w, h: inner.h });
      break;
    case "two_column":
      rects.push({ x: inner.x, y: inner.y, w: inner.w / 2 - 1, h: inner.h });
      rects.push({ x: inner.x + inner.w / 2 + 1, y: inner.y, w: inner.w / 2 - 1, h: inner.h });
      break;
    case "three_column":
      rects.push({ x: inner.x, y: inner.y, w: inner.w / 3 - 1, h: inner.h });
      rects.push({ x: inner.x + inner.w / 3 + 0.5, y: inner.y, w: inner.w / 3 - 1, h: inner.h });
      rects.push({
        x: inner.x + (inner.w / 3) * 2 + 1,
        y: inner.y,
        w: inner.w / 3 - 1,
        h: inner.h,
      });
      break;
    case "sidebar_left":
      rects.push({ x: inner.x, y: inner.y, w: inner.w * 0.3, h: inner.h });
      rects.push({ x: inner.x + inner.w * 0.3 + 2, y: inner.y, w: inner.w * 0.7 - 2, h: inner.h });
      break;
    case "sidebar_right":
      rects.push({ x: inner.x, y: inner.y, w: inner.w * 0.7 - 2, h: inner.h });
      rects.push({ x: inner.x + inner.w * 0.7, y: inner.y, w: inner.w * 0.3, h: inner.h });
      break;
    case "feature":
      rects.push({ x: inner.x, y: inner.y, w: inner.w * 0.65 - 1, h: inner.h, fill: accent });
      rects.push({
        x: inner.x + inner.w * 0.65 + 1,
        y: inner.y,
        w: inner.w * 0.35 - 1,
        h: inner.h,
      });
      break;
    case "side_by_side":
      rects.push({ x: inner.x, y: inner.y, w: inner.w / 2 - 1, h: inner.h });
      rects.push({ x: inner.x + inner.w / 2 + 1, y: inner.y, w: inner.w / 2 - 1, h: inner.h });
      break;
    default:
      rects.push({ x: inner.x, y: inner.y, w: inner.w, h: inner.h });
  }

  return (
    <svg
      width={small ? 18 : w}
      height={small ? 12 : h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0"
      aria-hidden
    >
      {rects.map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          rx={1.5}
          fill={r.fill ?? "none"}
          stroke={r.fill ? "none" : stroke}
          strokeWidth={0.8}
        />
      ))}
    </svg>
  );
}

/** Area layout menu: wireframe thumbnails so the creator sees what they're
 *  choosing. A real menu (Escape, arrow keys, focus return), not a hand-rolled
 *  popover. */
function SectionLayoutPicker({
  value,
  areaName,
  onChange,
}: {
  value: LayoutSection["layout"];
  areaName: string;
  onChange: (layout: LayoutSection["layout"]) => void;
}) {
  const current = SECTION_LAYOUT_OPTIONS.find((o) => o.value === value)?.label ?? value;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Layout of ${areaName}: ${current}. Change layout`}
          className="flex h-6 pointer-coarse:h-10 items-center gap-1 rounded-sm border border-border bg-[var(--surface-sunken)] px-1.5 text-2xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:border-[var(--user-accent-border)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1"
        >
          <LayoutThumbnail layout={value} small />
          {current}
          <ChevronDown className="h-3 w-3" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="studio-editor-chrome grid w-64 grid-cols-3 gap-1 p-2"
      >
        {SECTION_LAYOUT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onChange(option.value)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md border p-1.5 text-center",
              option.value === value
                ? "border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)]"
                : "border-transparent",
            )}
          >
            <LayoutThumbnail layout={option.value} />
            <span className="text-2xs leading-tight text-muted-foreground">{option.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GStudioSurface(props: GStudioSurfaceProps) {
  const { resolvedTheme } = useAppTheme();
  const { data: me } = useCurrentUser();
  const palette = useUserPalette(me?.bannerSigned ?? null);
  // Live theme preview: derive the page theme's CSS vars for the active
  // light/dark scheme so picking a preset repaints the canvas immediately.
  const { data: themeVars = {} } = useTheme(props.themeId);
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
  const [emptyBlocks, setEmptyBlocks] = useState<Set<string>>(() => new Set());
  const [snapToBlocks, setSnapToBlocks] = useState(true);
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
    ...themeTokensToStyle(studioConfigToThemeTokens(props.config), resolvedTheme),
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
        onHistory={() => setHistoryOpen((open) => !open)}
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
            style={surfaceStyle}
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
              className={cn("mx-auto w-full", editing && compact && "pb-36")}
              style={{
                ...CARD_SURFACE_STYLE,
                ...cardInk.style,
                maxWidth,
              }}
            >
              <GStudioCanvas
                {...props}
                sections={sections}
                editing={editing}
                directManipulation={directManipulation}
                touchDrag={touch}
                onBlockEmptyChange={handleBlockEmpty}
                emptyBlockIds={emptyBlocks}
                snapToBlocks={snapToBlocks}
                onGridChange={props.onGridChange}
                onRequestPalette={(sectionId) => {
                  props.onPaletteTargetChange(sectionId);
                  setRailTab("add");
                }}
              />
            </div>
          </div>
        )}
        {editing && railTab && <GStudioRail {...props} tab={railTab} onTabChange={setRailTab} />}
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
  onRequestPalette,
  ...props
}: GStudioSurfaceProps & {
  sections: LayoutSection[];
  editing: boolean;
  directManipulation: boolean;
  touchDrag: boolean;
  snapToBlocks: boolean;
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

function ResizeHandle(axis: string, ref: React.Ref<HTMLElement>) {
  const isCorner = axis === "se";
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={cn(
        "react-resizable-handle",
        `react-resizable-handle-${axis}`,
        // Hover reveals the handles; a selected block keeps them (touch has no hover).
        "opacity-0 transition-opacity duration-140 group-hover/frame:opacity-100 [[aria-current=true]>&]:opacity-100",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "block rounded-sm border bg-[var(--surface-elevated)] border-[var(--user-accent)]",
          isCorner ? "h-2.5 w-2.5" : axis === "e" ? "h-5 w-2" : "h-2 w-5",
        )}
      />
    </div>
  );
}

/** Pointer position from a drag event, covering both mouse and touch gestures. */
function pointerPosition(event: Event | undefined): { x: number; y: number } | null {
  if (!event) return null;
  const mouse = event as MouseEvent;
  if (Number.isFinite(mouse.clientX) && Number.isFinite(mouse.clientY)) {
    return { x: mouse.clientX, y: mouse.clientY };
  }
  const touch = (event as TouchEvent).changedTouches?.[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

/**
 * The area canvas under the pointer, excluding the drag's own area. Dragging is
 * per-grid, so without this a block released over another area snaps back home.
 */
function sectionUnderPointer(x: number, y: number, sourceSectionId: string): string | null {
  let best: { id: string; area: number } | null = null;
  for (const node of Array.from(document.querySelectorAll<HTMLElement>("[data-studio-grid]"))) {
    const id = node.dataset.studioGrid;
    if (!id || id === sourceSectionId) continue;
    const rect = node.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
    const area = rect.width * rect.height;
    if (!best || area < best.area) best = { id, area };
  }
  return best?.id ?? null;
}

/** Grid cell for a drop point, measured against the target area's own metrics. */
function cellUnderPointer(
  point: { x: number; y: number },
  sectionId: string,
  width: number,
): { col: number; row: number } | undefined {
  const node = document.querySelector<HTMLElement>(`[data-studio-grid="${sectionId}"]`);
  if (!node) return undefined;
  const rect = node.getBoundingClientRect();
  if (rect.width <= 0) return undefined;
  const rowHeight = Number(node.dataset.rowHeight) || 24;
  const margin = Number(node.dataset.margin) || 14;
  const col = Math.floor(((point.x - rect.left) / rect.width) * COLS);
  const row = Math.round((point.y - rect.top) / (rowHeight + margin));
  return {
    col: Math.max(0, Math.min(COLS - width, col)),
    row: Math.max(0, row),
  };
}

function GSectionBand({
  section,
  index,
  total,
  editing,
  directManipulation,
  touchDrag,
  snapToBlocks,
  onRequestPalette,
  ...props
}: GStudioSurfaceProps & {
  section: LayoutSection;
  index: number;
  total: number;
  editing: boolean;
  directManipulation: boolean;
  touchDrag: boolean;
  snapToBlocks: boolean;
  onRequestPalette: (id: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  // Phones edit in one stacked column: a 12-column desktop arrangement can't
  // be dragged by touch and squeezes side-by-side blocks to a few words wide.
  const stacked = useIsMobile();
  const sectionTitle = sectionLabel(section);
  const blocks = useMemo(
    () =>
      [...section.blocks]
        .sort((a, b) => a.position - b.position)
        .filter((block) => editing || block.visible !== false),
    [editing, section.blocks],
  );
  const grid = useMemo(() => sectionGrid(section, blocks), [section, blocks]);
  const rowHeight =
    props.config.density === "compact" ? 20 : props.config.density === "spacious" ? 28 : 24;
  const margin =
    props.config.density === "compact" ? 10 : props.config.density === "spacious" ? 20 : 14;
  const dropItem = props.dragType
    ? {
        i: "__dropping-elem__",
        x: 0,
        y: 0,
        w: sizeFor(props.dragType)[0],
        h: sizeFor(props.dragType)[1],
      }
    : undefined;
  const hasGrid = !editing && (section.grid?.length ?? 0) > 0;

  // Auto-fit: when a block's content is taller than its grid rows the frame
  // clips it. Measure each block and grow its rows (pushing neighbours down)
  // so nothing in the canvas is ever cut off. The ResizeObserver lives in
  // GBlockFrame; this band converts reported content height into grid rows and
  // commits the change. All reads go through refs so the callback stays stable.
  const gridRef = useRef<LayoutGridItem[]>(grid);
  gridRef.current = grid;
  const rowHeightRef = useRef(rowHeight);
  rowHeightRef.current = rowHeight;
  const marginRef = useRef(margin);
  marginRef.current = margin;
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const onGridFitRef = useRef(props.onGridFit);
  onGridFitRef.current = props.onGridFit;
  const sectionIdRef = useRef(section.id);
  sectionIdRef.current = section.id;
  // True between a drag/resize start and its stop. The grid library also
  // reports layout changes on its own (echoing a stale layout after a prop
  // change), which fought content auto-fit in a loop; only a gesture is an edit.
  const gestureRef = useRef(false);
  const pendingFitRef = useRef<Map<string, number>>(new Map());
  const fitTimerRef = useRef<number | null>(null);
  const fitBlock = useCallback((blockId: string, contentPx: number) => {
    pendingFitRef.current.set(blockId, contentPx);
    if (fitTimerRef.current !== null) return;
    const run = () => {
      fitTimerRef.current = null;
      if (!editingRef.current) {
        pendingFitRef.current.clear();
        return;
      }
      // Never fight an in-flight drag or resize; re-run once it settles.
      const busy =
        typeof document !== "undefined" &&
        Boolean(
          document.querySelector(
            ".react-grid-item.react-draggable-dragging, .react-grid-item.resizing",
          ),
        );
      if (busy) {
        fitTimerRef.current = window.setTimeout(run, 120);
        return;
      }
      let current = gridRef.current;
      let changed = false;
      for (const [blockId, px] of pendingFitRef.current) {
        const updated = fitGridItemToContent(
          current,
          blockId,
          px,
          rowHeightRef.current,
          marginRef.current,
        );
        if (updated) {
          current = updated;
          changed = true;
        }
      }
      pendingFitRef.current.clear();
      if (changed) onGridFitRef.current(sectionIdRef.current, current);
    };
    fitTimerRef.current = window.setTimeout(run, 0);
  }, []);
  useEffect(() => {
    if (editing && props.autoRenameId === section.id && !renaming) {
      setRenaming(true);
      props.onRenameFocusHandled?.();
    }
    // Only react when the target section id changes to the requested one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, props.autoRenameId, section.id]);
  if (
    !editing &&
    (section.visible === false ||
      !blocks.some(
        (block) => block.visible !== false && !(props.emptyBlockIds?.has(block.id) ?? false),
      ))
  )
    return null;
  return (
    <section
      data-section-id={section.id}
      aria-label={sectionTitle}
      className={cn("relative", section.visible === false && editing && "opacity-60")}
      onClick={(event) => event.stopPropagation()}
    >
      {editing ? (
        <header className="mb-2 flex flex-wrap items-center gap-1.5">
          <span
            className="h-3.5 w-0.5 shrink-0"
            style={{
              backgroundColor:
                section.layout === "feature" ? "var(--user-accent)" : "var(--border-strong)",
            }}
          />
          {renaming ? (
            <input
              autoFocus
              defaultValue={sectionTitle}
              aria-label="Area name"
              onBlur={(event) => {
                props.onRenameSection(section.id, event.target.value.trim());
                setRenaming(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                if (event.key === "Escape") setRenaming(false);
              }}
              className="t-label w-40 rounded-sm border border-[var(--user-accent-border)] bg-[var(--surface-sunken)] px-1 py-0.5 outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setRenaming(true)}
              title="Rename area"
              aria-label={`${sectionTitle}. Rename area`}
              className="t-label flex h-6 pointer-coarse:h-10 items-center truncate rounded-sm px-1 hover:text-foreground"
            >
              {sectionTitle}
            </button>
          )}
          <span className="font-mono text-3xs text-muted-foreground-subtle">
            {blocks.length} {blocks.length === 1 ? "block" : "blocks"}
          </span>
          <SectionLayoutPicker
            value={section.layout}
            areaName={sectionTitle}
            onChange={(layout) => props.onSectionLayoutChange(section.id, layout)}
          />
          <div className="ml-auto flex gap-0.5">
            <IconButton
              label="Move area up"
              disabled={index === 0}
              onClick={() => props.onMoveSection(section.id, -1)}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              label="Move area down"
              disabled={index === total - 1}
              onClick={() => props.onMoveSection(section.id, 1)}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              label={section.visible === false ? "Show area" : "Hide area"}
              onClick={() => props.onToggleSection(section.id)}
            >
              {section.visible === false ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </IconButton>
          </div>
        </header>
      ) : section.layout === "feature" ? (
        <header className="mb-2 flex items-center gap-2">
          <span className="h-3 w-0.5" style={{ backgroundColor: "var(--user-accent)" }} />
          <span className="t-label">{sectionTitle}</span>
          <span className="t-rule flex-1" />
        </header>
      ) : null}
      {blocks.length === 0 ? (
        editing ? (
          <button
            type="button"
            data-studio-grid={section.id}
            data-row-height={rowHeight}
            data-margin={margin}
            onClick={() => onRequestPalette(section.id)}
            className="flex w-full items-center justify-center gap-1.5 border border-dashed border-border py-8 text-xs text-muted-foreground outline-none hover:border-[var(--user-accent-border)] hover:text-[var(--user-accent-text)] focus-visible:border-[var(--user-accent-border)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add a block
          </button>
        ) : null
      ) : editing && stacked ? (
        <div className="flex flex-col" style={{ gap: margin }}>
          {[...grid]
            .sort((a, b) => a.y - b.y || a.x - b.x)
            .map((item) => blocks.find((block) => block.id === item.i))
            .filter((block): block is LayoutBlockInstance => !!block)
            .map((block) => (
              <GBlockFrame
                key={block.id}
                block={block}
                editing={editing}
                selected={props.selectedBlockId === block.id}
                fluid
                {...props}
              />
            ))}
        </div>
      ) : editing ? (
        <div
          data-studio-grid={section.id}
          data-row-height={rowHeight}
          data-margin={margin}
          className="relative"
        >
          <EditorGrid
            className="layout"
            layout={grid}
            cols={12}
            rowHeight={rowHeight}
            margin={[margin, margin]}
            containerPadding={[0, 0]}
            isDraggable={editing && directManipulation}
            isBounded={false}
            isResizable={editing && directManipulation}
            isDroppable={editing && directManipulation && Boolean(props.dragType)}
            droppingItem={dropItem}
            draggableCancel={BLOCK_DRAG_CANCEL}
            draggableHandle={touchDrag ? ".studio-drag-handle" : undefined}
            // Width only: heights follow content (the public page ignores them).
            resizeHandles={["e"]}
            resizeHandle={ResizeHandle}
            useCSSTransforms
            compactType={null}
            // Free canvas: a dragged block never displaces its neighbours. It
            // parks at the last free spot instead of shoving everything away.
            preventCollision

            onDragStart={() => {
              gestureRef.current = true;
              props.onGridInteractionStart();
            }}
            onResizeStart={() => {
              gestureRef.current = true;
              props.onGridInteractionStart();
            }}
            onDragStop={(current, _oldItem, newItem, _placeholder, event) => {
              // The final onLayoutChange lands after this callback.
              window.setTimeout(() => (gestureRef.current = false), 0);
              props.onGridInteractionEnd();
              if (!editing || !directManipulation || !newItem) return;
              const blockId = String(newItem.i);
              // Each area owns its own grid, so a block released over a different
              // area would be clamped back into its own. Hand it to the area under
              // the pointer instead, at the cell it was dropped on.
              const point = pointerPosition(event);
              const targetSectionId = point
                ? sectionUnderPointer(point.x, point.y, section.id)
                : null;
              if (point && targetSectionId) {
                props.onMoveToSection(
                  blockId,
                  targetSectionId,
                  cellUnderPointer(point, targetSectionId, newItem.w),
                );
                return;
              }
              const committed = (current as unknown as LayoutGridItem[]).map((item) => ({
                i: item.i,
                x: item.x,
                y: item.y,
                w: item.w,
                h: item.h,
                minW: item.minW,
                minH: item.minH,
              }));
              // RGL has already committed the drop at the grid cell; when block
              // snapping is on, nudge the final cell onto the nearest neighbour
              // edge one tick later so this is the last write and wins.
              const settled = settleGridSnap(committed, blockId, snapToBlocks);
              if (settled) {
                window.setTimeout(() => props.onGridChange(section.id, settled), 0);
              }
            }}
            onResizeStop={() => {
              window.setTimeout(() => (gestureRef.current = false), 0);
              props.onGridInteractionEnd();
            }}
            onDrop={(_layout, item, event) => {
              const type =
                props.dragType ?? (event as DragEvent).dataTransfer?.getData("text/plain");
              if (type && item) {
                props.onAdd(type, section.id, item);
                props.onDragTypeChange(null);
              }
            }}
            onLayoutChange={(next) => {
              if (!editing || !gestureRef.current) return;
              props.onGridChange(
                section.id,
                next.map((item) => ({
                  i: item.i,
                  x: item.x,
                  y: item.y,
                  w: item.w,
                  h: item.h,
                  minW: item.minW,
                  minH: item.minH,
                })),
              );
            }}
          >
            {blocks.map((block) => (
              <GBlockFrame
                key={block.id}
                block={block}
                editing={editing}
                selected={props.selectedBlockId === block.id}
                reportContentHeight={fitBlock}
                {...props}
              />
            ))}
          </EditorGrid>
        </div>
      ) : (
        <div
          className={cn(
            "content-safe",
            hasGrid
              ? "grid grid-cols-1 gap-8 md:grid-cols-12"
              : (SECTION_GRID[section.layout] ?? ""),
          )}
          style={
            hasGrid
              ? { gridAutoFlow: "row dense", alignItems: "start" }
              : (SECTION_GRID[section.layout] ?? "")
                ? { gridAutoFlow: "row", alignItems: "start" }
                : undefined
          }
        >
          {blocks.map((block) => {
            const item = hasGrid ? grid.find((candidate) => candidate.i === block.id) : undefined;
            return hasGrid ? (
              <GBlockFrame
                key={block.id}
                block={block}
                editing={editing}
                selected={false}
                fluid
                className={cn(
                  "relative min-w-0",
                  colStartClass((item?.x ?? 0) + 1),
                  spanClass(item?.w ?? 12),
                )}
                {...props}
              />
            ) : (
              <GBlockFrame
                key={block.id}
                block={block}
                editing={editing}
                selected={false}
                bare
                className={cn(
                  "contents",
                  (SECTION_GRID[section.layout] ?? "") && typeof block.span === "number"
                    ? spanClass(block.span)
                    : "",
                )}
                {...props}
              />
            );
          })}
        </div>
      )}
      {editing && blocks.length > 0 && (
        <button
          type="button"
          onClick={() => onRequestPalette(section.id)}
          className="mx-auto mt-1 flex h-6 pointer-coarse:h-10 pointer-coarse:px-3 pointer-coarse:opacity-100 items-center gap-1 border border-border bg-[var(--studio-bg,var(--background))] px-1.5 font-mono text-3xs uppercase tracking-widest text-muted-foreground opacity-40 outline-none transition-opacity hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1"
        >
          <Plus className="h-3 w-3" /> Add block
        </button>
      )}
    </section>
  );
}

const GBlockFrame = forwardRef<
  HTMLDivElement,
  GStudioSurfaceProps &
    ForwardedGridEvents & {
      block: LayoutBlockInstance;
      editing: boolean;
      selected: boolean;
      style?: CSSProperties;
      className?: string;
      children?: ReactNode;
      /** Content-sized frame (public-style flow) instead of a fixed grid cell. */
      fluid?: boolean;
      /** Frame-less render mirroring the public page's `contents` wrapper. */
      bare?: boolean;
      /** Reports the natural content height (px) of an editing block so the
       *  section can grow the grid rows instead of clipping the content. */
      reportContentHeight?: (blockId: string, contentPx: number) => void;
    }
>(function GBlockFrame(
  {
    block,
    editing,
    selected,
    style,
    className,
    children,
    fluid,
    bare,
    onMouseDown,
    onMouseUp,
    onTouchEnd,
    reportContentHeight,
    ...props
  },
  ref,
) {
  const def = getBlock(block.type);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const blockContext = {
    ownerId: props.userId,
    ownerType: "profile" as const,
    pageId: `profile:${props.userId}`,
    blockId: block.id,
    isEditing: editing,
    isOwner: true,
    data: props.profile ? { profile: props.profile } : undefined,
    // Reported while editing too: the frame flags blocks visitors won't see.
    onBlockEmptyChange: props.onBlockEmptyChange,
    onCompleteProfile: props.onCompleteProfile,
    onAddProject: props.onAddProject,
  } as BlockContext;
  // Watch the content box of an editing block and report its natural height so
  // the grid can grow the row count instead of clipping the block's content.
  useEffect(() => {
    if (!editing || fluid || !reportContentHeight) return;
    const node = contentRef.current;
    const inner = innerRef.current;
    if (!node || !inner) return;
    let frame = 0;
    // Natural height = the content's own height plus the frame's padding. The
    // frame's scrollHeight can't shrink below the frame, so it only grew.
    const report = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const box = getComputedStyle(node);
        const padding = parseFloat(box.paddingTop) + parseFloat(box.paddingBottom);
        reportContentHeight(block.id, Math.ceil(inner.offsetHeight + padding));
      });
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(node);
    observer.observe(inner);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [editing, fluid, block.id, reportContentHeight]);
  if (bare) {
    return (
      <div ref={ref} style={style} className={className}>
        <BlockRenderer
          type={block.type}
          config={block.config}
          context={blockContext}
          onChange={(config) => props.onUpdateBlockConfig(block.id, config)}
        />
      </div>
    );
  }
  return (
    <div
      ref={ref}
      style={style}
      data-block-id={block.id}
      // Keyboard path to every block: Tab reaches it, Enter or Space selects
      // it, and then the arrow / Delete / Ctrl+D shortcuts apply.
      tabIndex={editing ? 0 : undefined}
      role={editing ? "group" : undefined}
      aria-label={editing ? `${def?.label ?? block.type} block` : undefined}
      aria-current={editing && selected ? "true" : undefined}
      onKeyDown={(event) => {
        if (!editing || event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onSelect(block.id);
        }
      }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onTouchEnd={onTouchEnd}
      className={cn(
        className,
        "group/frame relative scroll-mt-20",
        editing &&
          "outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-2",
        !fluid && "h-full min-h-0",
        editing && "cursor-grab active:cursor-grabbing",
        selected && "ring-1 ring-[var(--user-accent)]",
        block.visible === false && "opacity-45",
      )}
      // Links inside a block stay inert while editing: a click on a project
      // card selects the block instead of leaving the editor. Modifier clicks
      // still open the link in a new tab.
      onClickCapture={(event) => {
        if (!editing) return;
        const link = (event.target as Element).closest?.("a[href]");
        if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
      }}
      onClick={(event) => {
        if (!editing) return;
        event.stopPropagation();
        props.onSelect(block.id);
      }}
    >
      <div
        ref={contentRef}
        style={blockFrameStyle(block)}
        className={cn(
          "relative overflow-x-hidden studio-block",
          (def?.containerless || block.type === "profile-header") && "studio-block-flush",
          !fluid && "h-full min-h-0 overflow-y-auto",
        )}
      >
        <div ref={innerRef} className="flex [&>*]:min-w-0 [&>*]:flex-1">
          <BlockRenderer
            type={block.type}
            config={block.config}
            context={blockContext}
            onChange={(config) => props.onUpdateBlockConfig(block.id, config)}
          />
        </div>
      </div>
      {editing && props.emptyBlockIds?.has(block.id) && block.visible !== false && (
        <span
          title="Visitors won't see this block until it has content"
          className="absolute bottom-1.5 left-1.5 z-20 inline-flex items-center gap-1 whitespace-nowrap rounded-sm border border-border bg-[var(--surface-elevated)] px-1.5 py-0.5 text-2xs text-muted-foreground shadow-sm"
        >
          <EyeOff className="h-3 w-3" aria-hidden />
          Hidden: empty
          <span className="sr-only"> — visitors won't see this block until it has content</span>
        </span>
      )}
      {editing && (
        <>
          <span
            aria-hidden
            className={cn(
              // The drag handle on touch screens (pointer-coarse); decoration
              // elsewhere, where the whole frame drags.
              "studio-drag-handle pointer-events-none absolute -left-2.5 -top-2.5 z-20 flex h-6 w-6 items-center justify-center rounded-sm border border-[var(--user-accent-border)] bg-[var(--surface-elevated)] text-[var(--user-accent-text)] shadow-sm transition-opacity group-hover/frame:opacity-100 group-focus-visible/frame:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:h-9 pointer-coarse:w-9 pointer-coarse:touch-none pointer-coarse:opacity-100",
              // Sits on the frame's corner, off the content: it used to cover
              // the first letters of every block title.
              selected ? "opacity-100" : "opacity-0",
            )}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          {selected && (
            // Straddles the frame's bottom edge: the top edge is where blocks
            // keep their own controls (the profile header's Add banner etc.),
            // which the toolbar used to cover. Settings live in the Block tab.
            <div
              role="toolbar"
              aria-label={`${def?.label ?? block.type} block actions`}
              className="absolute -bottom-3.5 right-2 z-30 flex items-center gap-0.5 border border-border bg-[var(--popover)] px-1 py-0.5 shadow-panel"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="t-label max-w-[110px] truncate pr-1">
                {def?.label ?? block.type}
              </span>
              <IconButton
                label={block.visible === false ? "Show block" : "Hide block"}
                onClick={() => props.onBlockAction(block.id, { visible: block.visible === false })}
              >
                {block.visible === false ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
              </IconButton>
              <IconButton label="Duplicate block" onClick={() => props.onDuplicate(block.id)}>
                <Copy className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="Remove block" onClick={() => props.onRemove(block.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          )}
        </>
      )}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-10 rounded-[var(--studio-block-radius,var(--studio-radius))] ring-1 ring-inset",
          selected
            ? "ring-[var(--user-accent)]"
            : "ring-transparent group-hover/frame:ring-border-strong",
        )}
      />
      {children}
    </div>
  );
});
