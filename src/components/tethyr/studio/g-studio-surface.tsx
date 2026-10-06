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
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Frame,
  GripHorizontal,
  GripVertical,
  History,
  LayoutTemplate,
  Magnet,
  Monitor,
  Pencil,
  Plus,
  Redo2,
  Settings2,
  Sliders,
  Smartphone,
  Save,
  SquareDashed,
  Tablet,
  Trash2,
  Undo2,
  Upload,
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
import { getAllBlocks, getBlock } from "@/lib/block-registry";
import type {
  BlockCategory,
  BlockConfig,
  BlockContext,
  BlockDefinition,
  LayoutBlockInstance,
  LayoutGridItem,
  LayoutSection,
  PageLayout,
  PageVersion,
} from "@/lib/page-blocks";
import { themeTokensToStyle } from "@/lib/theme-tokens";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import {
  BlockFrameBorder,
  BLOCK_INSET_DEFAULT_PX,
  BLOCK_INSET_MAX,
  BLOCK_INSET_MIN,
  BLOCK_RADIUS_MAX,
  BLOCK_RADIUS_MIN,
  blockFrameStyle,
  CARD_SURFACE_STYLE,
  cardFillStyle,
  studioBackgroundVars,
  structureMaxWidthCss,
  studioConfigToThemeTokens,
  studioSurfaceStyle,
  type StudioConfig,
} from "@/lib/studio-config";
import type { BlockShape } from "@/lib/page-blocks";
import {
  COLS,
  findSection,
  fitGridItemToContent,
  sectionGrid,
  sectionLabel,
  settleGridSnap,
  sizeFor,
} from "@/lib/studio-grid";
import { BlockGlyph } from "./block-glyph";
import { useCardInk } from "@/hooks/use-card-ink";
import { useIsMobile, useMediaQuery } from "@/hooks/use-mobile";
import { IconButton, Choice, WidthStepper } from "./studio-controls";
import {
  ThemeSection,
  TypeSection,
  GCustomizeAdvanced,
  GCustomizePanel,
} from "./g-customize-panel";
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

interface GStudioSurfaceProps {
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
const BLOCK_CATEGORY_ORDER: BlockCategory[] = [
  "content",
  "media",
  "people",
  "project",
  "community",
  "utility",
];
const BLOCK_CATEGORY_LABELS: Record<BlockCategory, string> = {
  content: "Content",
  media: "Media",
  people: "People",
  project: "Projects",
  community: "Community",
  utility: "Utility",
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
function LayoutThumbnail({ layout }: { layout: LayoutSection["layout"] }) {
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
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
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

/** Popover grid of layout thumbnails replacing the native <select>. Shows tiny
 *  wireframe diagrams for each layout option so the creator sees what they're
 *  choosing instead of reading abstract labels. */
function SectionLayoutPicker({
  value,
  onChange,
}: {
  value: LayoutSection["layout"];
  onChange: (layout: LayoutSection["layout"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  const current = SECTION_LAYOUT_OPTIONS.find((o) => o.value === value)?.label ?? value;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Change area layout"
        className="h-6 pointer-coarse:h-10 max-w-[130px] rounded-sm border border-border bg-[var(--surface-sunken)] px-1 font-mono text-3xs uppercase tracking-widest text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:border-[var(--user-accent-border)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1"
      >
        {current}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-border bg-background p-2 shadow-lg">
          <div className="grid grid-cols-4 gap-1.5">
            {SECTION_LAYOUT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-md border p-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1",
                  option.value === value
                    ? "border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)]"
                    : "border-transparent hover:border-border hover:bg-surface/50",
                )}
                title={option.label}
              >
                <LayoutThumbnail layout={option.value} />
                <span className="text-[9px] leading-none text-muted-foreground group-hover:text-foreground">
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
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
  // Drag and resize wherever the grid is shown (lg and up), touch included:
  // on touch screens a drag starts from the grip so the canvas still scrolls.
  const directManipulation = !compact;
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
      className="flex h-[calc(100dvh-3rem)] min-h-0 flex-col overflow-hidden bg-background"
      data-studio-builder="g"
    >
      <GStudioTopBar
        mode={props.mode}
        device={props.device}
        compact={compact}
        dirty={props.dirty}
        saving={props.saving}
        published={props.published}
        hasUnpublishedChanges={props.hasUnpublishedChanges}
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
        onPalette={() => toggleTab("add")}
        onSave={props.onSave}
        onPublish={props.onPublish}
        customizeOpen={railTab === "style"}
        paletteOpen={railTab === "add"}
        onExit={props.onExit}
        profile={props.profile}
        onTemplates={props.onOpenTemplates}
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
          <main
            className="relative isolate min-w-0 flex-1 overflow-y-auto bg-[var(--studio-bg,var(--background))] bg-noise text-foreground"
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
          </main>
        )}
        {editing && railTab && <GStudioRail {...props} tab={railTab} onTabChange={setRailTab} />}
        {editing && compact && <GMobileEditSheet {...props} />}
      </div>
    </div>
  );
}

/**
 * Preview = the real public page, rendering the saved draft, in an iframe at
 * a true device width. The editor canvas can't stand in for it: its frame
 * narrows a box, but breakpoints follow the window, so a "phone" preview used
 * to show the desktop grid. Waits for an in-flight save so it never shows a
 * draft older than the canvas; a new save reloads it.
 */
function GStudioPreviewFrame({
  handle,
  width,
  saving,
  reloadKey,
}: {
  handle: string | null;
  width: number | undefined;
  saving: boolean;
  reloadKey: number;
}) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [reloadKey]);
  return (
    <section
      aria-label="Preview"
      className="relative flex min-h-0 min-w-0 flex-1 justify-center overflow-hidden bg-[var(--surface-sunken)] sm:px-4 sm:pt-3"
    >
      {!handle ? (
        <p className="m-auto max-w-xs text-center text-sm text-muted-foreground">
          Choose a handle in Settings to preview your public page.
        </p>
      ) : saving ? (
        <p className="m-auto text-sm text-muted-foreground" role="status">
          Saving your draft…
        </p>
      ) : (
        <div
          className="relative flex h-full w-full flex-col"
          style={{ maxWidth: width !== undefined ? width + 2 : undefined }}
        >
          {width !== undefined && (
            <span className="mb-1 self-end font-mono text-2xs text-muted-foreground">
              {width}px
            </span>
          )}
          {!loaded && (
            <p
              role="status"
              className="absolute inset-x-0 top-1/3 text-center text-sm text-muted-foreground"
            >
              Loading preview…
            </p>
          )}
          <iframe
            key={reloadKey}
            src={`/u/${encodeURIComponent(handle)}?embed=true&draft=true`}
            title="Your Studio as visitors will see it after you publish"
            onLoad={() => setLoaded(true)}
            className={cn(
              "min-h-0 w-full flex-1 bg-background sm:rounded-t-md sm:border sm:border-b-0 sm:border-border",
              !loaded && "opacity-0",
            )}
          />
        </div>
      )}
    </section>
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

function GStudioTopBar({
  mode,
  device,
  compact,
  dirty,
  saving,
  published,
  hasUnpublishedChanges,
  publishedVersion,
  lastSavedAt,
  canUndo,
  canRedo,
  historyOpen,
  onHistory,
  onHistoryClosed,
  versions,
  onRollback,
  onModeChange,
  onDeviceChange,
  onUndo,
  onRedo,
  snapToBlocks,
  onSnapToBlocksChange,
  onExit,
  onCustomize,
  onPalette,
  onSave,
  onPublish,
  customizeOpen,
  paletteOpen,
  profile,
  onTemplates,
}: {
  mode: GStudioMode;
  device: GStudioDevice;
  compact: boolean;
  dirty: boolean;
  saving: boolean;
  published: boolean;
  hasUnpublishedChanges: boolean;
  publishedVersion: number | null;
  lastSavedAt?: number | null;
  canUndo: boolean;
  canRedo: boolean;
  historyOpen: boolean;
  onHistory: () => void;
  onHistoryClosed: () => void;
  onModeChange: (mode: GStudioMode) => void;
  onDeviceChange: (device: GStudioDevice) => void;
  onUndo: () => void;
  onRedo: () => void;
  snapToBlocks: boolean;
  onSnapToBlocksChange: (enabled: boolean) => void;
  onExit?: () => void;
  onCustomize: () => void;
  onPalette: () => void;
  onSave: () => void;
  onPublish: () => void;
  customizeOpen: boolean;
  paletteOpen: boolean;
  profile: GStudioSurfaceProps["profile"];
  onTemplates?: () => void;
  versions: PageVersion[];
  onRollback: (version: number) => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[var(--surface-elevated)]">
      <div className="flex min-h-10 items-center gap-2 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {onExit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1.5"
              onClick={onExit}
              title="Back to Studio view"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          <span className="t-heading truncate text-[13px] font-semibold text-foreground">
            Studio
          </span>
          <span className="text-muted-foreground-subtle" aria-hidden>
            /
          </span>
          <span className="truncate text-[13px] text-muted-foreground">Customize</span>
          <span
            role="status"
            className={cn(
              // Amber is too light to read as text, so caution states keep it
              // for the border and fill and set the label in the body colour.
              "hidden shrink-0 whitespace-nowrap border px-1.5 py-0.5 font-mono text-2xs sm:inline",
              saving || dirty || hasUnpublishedChanges
                ? "border-caution bg-caution/10 text-foreground"
                : "border-trust text-trust",
            )}
          >
            {saving
              ? "Saving"
              : dirty
                ? "Unsaved changes"
                : hasUnpublishedChanges
                  ? "Unpublished changes"
                  : published
                    ? `Live · v${publishedVersion ?? 1}`
                    : "Draft"}
          </span>
          {lastSavedAt && !saving && !dirty && (
            <span className="hidden font-mono text-2xs text-muted-foreground sm:inline">
              saved {timeAgo(new Date(lastSavedAt).toISOString())}
            </span>
          )}
        </div>
        <div
          className="mx-auto flex rounded-sm border border-border bg-[var(--surface-sunken)] p-0.5"
          role="radiogroup"
          aria-label="Studio mode"
        >
          {(
            [
              ["edit", "Editing"],
              ["preview", "Preview"],
            ] as Array<[GStudioMode, string]>
          ).map(([item, label]) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={mode === item}
              aria-label={label}
              title={item === "preview" ? "See your page as visitors do" : "Edit your page"}
              onClick={() => onModeChange(item)}
              className={cn(
                "flex h-6 pointer-coarse:h-10 items-center gap-1.5 rounded-sm px-2 text-xs",
                mode === item
                  ? "bg-[var(--surface-elevated)] text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item === "edit" ? (
                <Pencil className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              {!compact && label}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {mode === "edit" && (
            <>
              <IconButton label="Undo" disabled={!canUndo} onClick={onUndo}>
                <Undo2 className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="Redo" disabled={!canRedo} onClick={onRedo}>
                <Redo2 className="h-3.5 w-3.5" />
              </IconButton>
              {compact ? (
                <>
                  {onTemplates && (
                    <IconButton label="Templates" onClick={onTemplates}>
                      <LayoutTemplate className="h-3.5 w-3.5" />
                    </IconButton>
                  )}
                  <IconButton label="Customize Studio" active={customizeOpen} onClick={onCustomize}>
                    <Sliders className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    label={saving ? "Saving draft" : "Save draft"}
                    disabled={!dirty || saving}
                    onClick={onSave}
                  >
                    <Save className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    label="Publish changes"
                    active={hasUnpublishedChanges}
                    disabled={!hasUnpublishedChanges || saving}
                    onClick={onPublish}
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </IconButton>
                </>
              ) : (
                <>
                  {onTemplates && (
                    <Button variant="ghost" size="sm" onClick={onTemplates}>
                      <LayoutTemplate className="h-3 w-3" /> Templates
                    </Button>
                  )}
                  <Button
                    variant={customizeOpen ? "default" : "ghost"}
                    size="sm"
                    onClick={onCustomize}
                  >
                    <Sliders className="h-3 w-3" /> Customize
                  </Button>
                  <Button
                    variant={snapToBlocks ? "default" : "ghost"}
                    size="sm"
                    aria-pressed={snapToBlocks}
                    onClick={() => onSnapToBlocksChange(!snapToBlocks)}
                    title="Align dragged blocks to nearby block edges"
                  >
                    <Magnet className="h-3 w-3" /> Snap
                  </Button>
                  <Button
                    variant={paletteOpen ? "default" : "secondary"}
                    size="sm"
                    onClick={onPalette}
                  >
                    <Plus className="h-3 w-3" /> Add block
                  </Button>
                  <Button
                    variant={dirty ? "default" : "outline"}
                    size="sm"
                    busy={saving}
                    disabled={!dirty || saving}
                    onClick={onSave}
                    title={saving ? "Saving draft" : "Save draft"}
                    aria-label={saving ? "Saving draft" : "Save draft"}
                  >
                    <Save className="h-3 w-3" /> {saving ? "Saving" : "Save draft"}
                  </Button>
                  <Button
                    variant={hasUnpublishedChanges ? "default" : "outline"}
                    size="sm"
                    busy={saving}
                    disabled={!hasUnpublishedChanges || saving}
                    onClick={onPublish}
                    title="Publish changes"
                    aria-label="Publish changes"
                  >
                    <Upload className="h-3 w-3" /> Publish
                  </Button>
                </>
              )}
            </>
          )}
          {mode === "preview" && (
            <div className="flex border border-border p-0.5">
              {(["desktop", "tablet", "mobile"] as GStudioDevice[]).map((item) => (
                <IconButton
                  key={item}
                  label={`Preview on ${item === "mobile" ? "a phone" : item === "tablet" ? "a tablet" : "desktop"}`}
                  active={device === item}
                  onClick={() => onDeviceChange(item)}
                >
                  {item === "desktop" ? (
                    <Monitor className="h-3.5 w-3.5" />
                  ) : item === "tablet" ? (
                    <Tablet className="h-3.5 w-3.5" />
                  ) : (
                    <Smartphone className="h-3.5 w-3.5" />
                  )}
                </IconButton>
              ))}
            </div>
          )}
          <IconButton
            label="Version history"
            active={historyOpen}
            data-version-history-trigger
            onClick={onHistory}
          >
            <History className="h-3.5 w-3.5" />
          </IconButton>
          {profile?.handle && (
            <a
              href={`/u/${profile.handle}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-[var(--surface-sunken)] hover:text-foreground"
              title="View public page"
              aria-label="View public page"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
      {mode === "edit" && (
        <div className="flex min-h-5 items-center gap-2 border-t border-border bg-[var(--surface)] px-3 py-0.5">
          <span className="t-label">Editing</span>
          <span className="truncate text-2xs text-muted-foreground-subtle pointer-coarse:hidden">
            Drag blocks between areas · pull a block's right edge to change its width · arrow keys
            nudge · Del removes · Ctrl/⌘D duplicates · click a block for its settings
          </span>
          <span className="hidden truncate text-2xs text-muted-foreground-subtle pointer-coarse:inline">
            Tap a block to edit it · use Edit Studio below to arrange and add
          </span>
        </div>
      )}
      {/* Anchored to this header, so it drops below the bar instead of floating
          over its own trigger; dismisses like every other popover in the file. */}
      {historyOpen && (
        <VersionPopover
          versions={versions}
          publishedVersion={publishedVersion}
          onRollback={onRollback}
          onClose={() => onHistoryClosed()}
        />
      )}
    </header>
  );
}

function VersionPopover({
  versions,
  publishedVersion,
  onRollback,
  onClose,
}: {
  versions: PageVersion[];
  publishedVersion: number | null;
  onRollback: (version: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    // Same dismissal contract as SectionLayoutPicker: outside mousedown and
    // Escape both close, and the trigger stays clickable because the popover
    // anchors below the bar instead of painting over it.
    const onMousedown = (event: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const target = event.target as Element | null;
      // A click on the popover's own trigger is not "outside" — the trigger's
      // onClick performs the single toggle. Without this exception the
      // mousedown closes the popover and the click immediately reopens it.
      if (target?.closest("[data-version-history-trigger]")) return;
      if (!el.contains(target as Node)) onClose();
    };
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMousedown);
    document.addEventListener("keydown", onKeydown);
    return () => {
      document.removeEventListener("mousedown", onMousedown);
      document.removeEventListener("keydown", onKeydown);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Published versions"
      className="absolute right-3 top-full z-50 mt-1 w-72 border border-border bg-[var(--popover)] p-3 shadow-panel"
      style={{ borderRadius: "var(--studio-radius)" }}
    >
      <div className="flex items-center justify-between">
        <p className="t-label">Published versions</p>
        <IconButton label="Close versions" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>
      {versions.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Nothing published yet. Publish to save the first version.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {versions.map((version) => (
            <li key={version.version} className="flex items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-foreground">
                  {version.version === publishedVersion ? "Live now" : "Earlier version"}
                </span>
                <span className="font-mono text-2xs text-muted-foreground-subtle">
                  v{version.version} · {timeAgo(version.publishedAt)}
                </span>
                {version.note && (
                  <span className="mt-0.5 block truncate text-2xs text-muted-foreground">
                    {version.note}
                  </span>
                )}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onRollback(version.version);
                  onClose();
                }}
              >
                {version.version === publishedVersion ? "Discard draft…" : "Restore…"}
              </Button>
            </li>
          ))}
        </ul>
      )}
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
              aria-label="Section name"
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
              aria-label="Rename area"
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
              "studio-drag-handle pointer-events-none absolute left-1 top-1 z-20 flex h-6 w-6 items-center justify-center rounded-sm border border-[var(--user-accent-border)] bg-[var(--surface-elevated)] text-[var(--user-accent-text)] shadow-sm transition-opacity group-hover/frame:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:h-9 pointer-coarse:w-9 pointer-coarse:touch-none",
              selected ? "opacity-100" : "opacity-60",
            )}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          {selected && (
            <div
              className="absolute -top-2 right-1 z-30 flex items-center gap-0.5 border border-border bg-[var(--popover)] px-1 py-0.5 shadow-panel"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="t-label max-w-[110px] truncate pr-1">
                {def?.label ?? block.type}
              </span>
              <IconButton label="Block settings" onClick={() => props.onSelect(block.id)}>
                <Settings2 className="h-3.5 w-3.5" />
              </IconButton>
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
              <IconButton
                label={block.frameBorder === "none" ? "Show block border" : "Hide block border"}
                active={block.frameBorder === "none"}
                onClick={() =>
                  props.onBlockAction(block.id, {
                    frameBorder: block.frameBorder === "none" ? "default" : "none",
                  })
                }
              >
                {block.frameBorder === "none" ? (
                  <SquareDashed className="h-3.5 w-3.5" />
                ) : (
                  <Frame className="h-3.5 w-3.5" />
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

/** Shape presets shown as mini wireframe previews in the inspector. Each
 *  entry pairs a BlockShape value with a tiny SVG that renders the actual
 *  border-radius so the creator sees the real silhouette, not an abstraction. */
const SHAPE_PRESETS: Array<{ value: BlockShape; label: string; radius: string }> = [
  { value: "default", label: "Theme", radius: "3px" },
  { value: "square", label: "Sharp", radius: "0px" },
  { value: "rounded", label: "Round", radius: "5px" },
  { value: "soft", label: "Soft", radius: "9px" },
  { value: "pill", label: "Pill", radius: "9999px" },
  { value: "organic", label: "Organic", radius: "42% 58% 58% 42% / 42% 42% 58% 58%" },
  { value: "blob", label: "Blob", radius: "63% 37% 30% 70% / 60% 30% 70% 40%" },
  { value: "leaf", label: "Leaf", radius: "0 50% 50% 0" },
];

/** Shapes that support a per-block radius slider. */
const RADIUS_SHAPES = new Set<BlockShape>(["rounded", "soft"]);

/** Tiny SVG preview of a shape silhouette at 28×20. */
function ShapeThumbnail({ radius, active }: { radius: string; active: boolean }) {
  return (
    <svg width={28} height={20} viewBox="0 0 28 20" className="shrink-0" aria-hidden>
      <rect
        x={2}
        y={2}
        width={24}
        height={16}
        rx={radius}
        ry={radius}
        fill={active ? "var(--user-accent-subtle)" : "var(--surface-sunken)"}
        stroke={active ? "var(--user-accent)" : "var(--border-strong)"}
        strokeWidth={0.8}
      />
    </svg>
  );
}

/** Per-block frame controls in the inspector: shape, border on/off (plus
 *  "follow appearance"), inner spacing, and corner radius. Writes the block's
 *  `frameBorder`/`frameInset`/`frameShape`/`frameRadius` fields; the shared
 *  `.studio-block` utility renders them on every surface (editor, owner view,
 *  public page). */
function BlockFrameSection({
  block,
  ...props
}: GStudioSurfaceProps & { block: LayoutBlockInstance }) {
  const def = getBlock(block.type);
  const flush = def?.containerless || block.type === "profile-header";
  const inset = typeof block.frameInset === "number" ? block.frameInset : undefined;
  const shape = block.frameShape ?? "default";
  const radius = typeof block.frameRadius === "number" ? block.frameRadius : undefined;
  const showRadiusSlider = RADIUS_SHAPES.has(shape);

  return (
    <div className="border-t border-border py-3">
      <div className="mb-3 flex items-start gap-2">
        <Sliders
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--user-accent-text)]"
          aria-hidden
        />
        <div>
          <p className="text-xs font-medium text-foreground">Block appearance</p>
          <p className="mt-0.5 text-2xs leading-snug text-muted-foreground-subtle">
            Change this block only. Anything set to Theme follows your Studio appearance settings.
          </p>
        </div>
      </div>
      <p className="t-label mb-1">Shape</p>
      <p className="mb-2 text-2xs leading-snug text-muted-foreground-subtle">
        Choose the silhouette of this block&apos;s surface.
      </p>
      <div role="radiogroup" aria-label="Block shape" className="grid grid-cols-4 gap-1">
        {SHAPE_PRESETS.map((preset) => {
          const active = shape === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={preset.label}
              onClick={() =>
                props.onBlockAction(block.id, {
                  frameShape: preset.value === "default" ? undefined : preset.value,
                  // Clear per-block radius when switching to a shape that
                  // doesn't use it, so stale values don't linger.
                  frameRadius:
                    preset.value !== "default" && RADIUS_SHAPES.has(preset.value)
                      ? (block.frameRadius ?? (preset.value === "soft" ? 20 : 8))
                      : undefined,
                })
              }
              className={cn(
                "flex flex-col items-center gap-1 rounded-sm border p-1.5 transition-colors",
                active
                  ? "border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)]"
                  : "border-transparent hover:border-border hover:bg-[var(--surface-sunken)]",
              )}
            >
              <ShapeThumbnail radius={preset.radius} active={active} />
              <span
                className={cn(
                  "text-[9px] leading-none",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>
      {showRadiusSlider && (
        <label className="mt-2.5 block">
          <span className="mb-1 flex items-center justify-between font-mono text-3xs uppercase tracking-widest text-muted-foreground-subtle">
            Corner radius <span>{radius ?? "auto"}px</span>
          </span>
          <input
            type="range"
            min={BLOCK_RADIUS_MIN}
            max={BLOCK_RADIUS_MAX}
            step={2}
            value={radius ?? (shape === "soft" ? 20 : 8)}
            aria-label="Corner radius in pixels"
            onChange={(event) =>
              props.onBlockAction(block.id, { frameRadius: Number(event.target.value) })
            }
            className="studio-slider w-full"
          />
          <button
            type="button"
            onClick={() => props.onBlockAction(block.id, { frameRadius: undefined })}
            disabled={radius === undefined}
            className="mt-1 text-2xs text-muted-foreground-subtle underline-offset-2 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
          >
            Reset radius
          </button>
        </label>
      )}
      {shape !== "default" && (
        <button
          type="button"
          onClick={() =>
            props.onBlockAction(block.id, { frameShape: undefined, frameRadius: undefined })
          }
          className="mt-2 text-2xs text-muted-foreground-subtle underline-offset-2 hover:text-foreground hover:underline"
        >
          Reset to theme shape
        </button>
      )}

      <div className="mt-4 flex items-start gap-2 border-t border-border pt-3">
        <Frame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--user-accent-text)]" aria-hidden />
        <div>
          <p className="text-xs font-medium text-foreground">Outline for this block</p>
          <p className="mt-0.5 text-2xs leading-snug text-muted-foreground-subtle">
            Theme uses the single global Card outline setting. Choose On or Off only to make this
            block different.
          </p>
        </div>
      </div>
      <div
        role="radiogroup"
        aria-label="Card border for this block"
        className="grid grid-cols-3 gap-1 border border-border bg-[var(--surface-sunken)] p-0.5"
      >
        {(
          [
            ["default", "Follow"],
            ["frame", "On"],
            ["none", "Off"],
          ] as Array<[BlockFrameBorder, string]>
        ).map(([option, text]) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={(block.frameBorder ?? "default") === option}
            onClick={() => props.onBlockAction(block.id, { frameBorder: option })}
            className={cn(
              "rounded-sm px-1 py-1.5 text-2xs",
              (block.frameBorder ?? "default") === option
                ? "bg-[var(--surface-elevated)] text-foreground"
                : "text-muted-foreground",
            )}
          >
            {text}
          </button>
        ))}
      </div>
      {flush && (block.frameBorder ?? "default") === "default" && (
        <p className="mt-1.5 text-2xs leading-snug text-muted-foreground-subtle">
          This block is full-bleed — it starts with no outline, like the published page.
        </p>
      )}
      {!flush && (
        <label className="mt-2.5 block">
          <span className="mb-1 flex items-center justify-between font-mono text-3xs uppercase tracking-widest text-muted-foreground-subtle">
            Inner spacing <span>{inset ?? `${BLOCK_INSET_DEFAULT_PX}px · theme`}</span>
          </span>
          <span className="mb-1 block text-2xs leading-snug text-muted-foreground-subtle">
            Space between this block&apos;s content and its edge.
          </span>
          <input
            type="range"
            min={BLOCK_INSET_MIN}
            max={BLOCK_INSET_MAX}
            step={2}
            value={inset ?? BLOCK_INSET_DEFAULT_PX}
            aria-label="Inner spacing in pixels"
            onChange={(event) =>
              props.onBlockAction(block.id, { frameInset: Number(event.target.value) })
            }
            className="studio-slider w-full"
          />
          <button
            type="button"
            onClick={() => props.onBlockAction(block.id, { frameInset: undefined })}
            disabled={inset === undefined}
            className="mt-1 text-2xs text-muted-foreground-subtle underline-offset-2 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
          >
            Reset to theme spacing
          </button>
        </label>
      )}
    </div>
  );
}

type RailTab = "style" | "add" | "block";

const RAIL_TABS: Array<[RailTab, string]> = [
  ["style", "Style"],
  ["add", "Add"],
  ["block", "Block"],
];

function GStudioRail(
  props: GStudioSurfaceProps & { tab: RailTab; onTabChange: (tab: RailTab | null) => void },
) {
  const { tab, onTabChange } = props;
  const block = props.layout.sections
    .flatMap((section) => section.blocks)
    .find((item) => item.id === props.selectedBlockId);
  return (
    <aside
      aria-label="Studio panels"
      className="hidden h-full min-h-0 w-72 shrink-0 flex-col border-l border-border bg-[var(--surface-elevated)] lg:flex"
    >
      <header className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
        <div role="tablist" aria-label="Studio panels" className="flex flex-1 gap-0.5">
          {RAIL_TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`studio-rail-tab-${value}`}
              aria-selected={tab === value}
              aria-controls="studio-rail-panel"
              onClick={() => onTabChange(value)}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]",
                tab === value
                  ? "bg-[var(--user-accent-subtle)] font-medium text-[var(--user-accent-text)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <IconButton label="Close panel" onClick={() => onTabChange(null)}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </header>
      <div
        role="tabpanel"
        id="studio-rail-panel"
        aria-labelledby={`studio-rail-tab-${tab}`}
        className={cn("min-h-0 flex-1", tab === "style" ? "flex flex-col" : "overflow-y-auto")}
      >
        {tab === "style" ? (
          <GCustomizePanel
            config={props.config}
            layout={props.layout}
            onChange={props.onCustomizeChange}
            themeId={props.themeId}
            onThemeChange={props.onThemeChange}
            cardBorders={props.cardBorders}
            cardBorderColor={props.cardBorderColor}
            onCardBordersChange={props.onCardBordersChange}
            onCardBorderColorChange={props.onCardBorderColorChange}
            onToggleSection={props.onToggleSection}
            onBlockAction={props.onBlockAction}
            onSelect={props.onSelect}
            selectedBlockId={props.selectedBlockId}
            onCompleteProfile={props.onCompleteProfile}
            onOpenAppearance={props.onOpenAppearance}
            onOpenTemplates={props.onOpenTemplates}
            onSaveAsTemplate={props.onSaveAsTemplate}
            onReset={props.onReset}
          />
        ) : tab === "add" ? (
          <GBlockPalette {...props} />
        ) : (
          <GBlockInspector {...props} block={block} onClose={() => props.onSelect(null)} />
        )}
      </div>
    </aside>
  );
}

/**
 * "About / README" (project-about) and "README" (profile-readme) both write the
 * same `profiles.readme` document. On a studio page only one should be offered:
 * the one already in the layout wins, the other is hidden.
 */
function dedupeSharedReadmeBlocks(blockType: string, usedTypes: Set<string>): boolean {
  if (blockType === "profile-readme") return !usedTypes.has("project-about");
  if (blockType === "project-about") return !usedTypes.has("profile-readme");
  return true;
}

function GBlockPalette(props: GStudioSurfaceProps) {
  const [query, setQuery] = useState("");
  const sections = props.layout.sections;
  const selectedSectionId = props.selectedBlockId
    ? findSection(props.layout, props.selectedBlockId)?.id
    : undefined;
  const target = props.paletteTarget ?? selectedSectionId ?? sections[0]?.id;
  const usedTypes = useMemo(
    () => new Set(sections.flatMap((s) => s.blocks.map((b) => b.type))),
    [sections],
  );
  const blocks = useMemo(
    () =>
      getAllBlocks()
        .filter((block) => block.ownerContext !== "project")
        .filter((block) => dedupeSharedReadmeBlocks(block.type, usedTypes))
        .filter((block) =>
          `${block.label} ${block.description}`.toLowerCase().includes(query.toLowerCase()),
        ),
    [query, usedTypes],
  );
  const blockItem = (def: BlockDefinition) => (
    <button
      key={def.type}
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", def.type);
        event.dataTransfer.effectAllowed = "copy";
        props.onDragTypeChange(def.type);
      }}
      onDragEnd={() => props.onDragTypeChange(null)}
      onClick={() => props.onAdd(def.type, target)}
      className="group/item mb-1 flex w-full cursor-grab items-center gap-2 border border-border bg-[var(--surface)] px-2 py-1.5 text-left hover:border-[var(--user-accent-border)]"
    >
      <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-sm border border-border/60 bg-[var(--surface-sunken)] py-0.5">
        <BlockGlyph type={def.type} category={def.category} />
      </span>
      <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground-subtle" />
      <span className="min-w-0">
        <span className="block text-xs font-medium text-foreground">{def.label}</span>
        <span className="block text-2xs text-muted-foreground-subtle">{def.description}</span>
      </span>
    </button>
  );
  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="space-y-2 border-b border-border px-3 py-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search blocks"
          aria-label="Search blocks"
          className="w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs outline-none"
        />
        <label className="block">
          <span className="t-label">Drop into</span>
          {/* Studio chrome keeps its compact sunken control instead of the app field grammar. */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <select
            value={target ?? ""}
            onChange={(event) => props.onPaletteTargetChange(event.target.value)}
            className="mt-1 w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs"
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {sectionLabel(section)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {query.trim() ? (
          blocks.map((def) => blockItem(def))
        ) : (
          <>
            {BLOCK_CATEGORY_ORDER.map((category) => {
              const categoryBlocks = blocks.filter((b) => b.category === category);
              if (categoryBlocks.length === 0) return null;
              return (
                <div key={category}>
                  <p className="t-label mb-1 mt-3 text-2xs text-[var(--user-accent-text)] first:mt-0">
                    {BLOCK_CATEGORY_LABELS[category]}
                  </p>
                  {categoryBlocks.map((def) => blockItem(def))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function GBlockInspector({
  block,
  onClose,
  ...props
}: GStudioSurfaceProps & { block?: LayoutBlockInstance; onClose: () => void }) {
  const def = block ? getBlock(block.type) : undefined;
  if (!block || !def)
    return (
      <div className="p-4">
        <p className="t-label">Block inspector</p>
        <div className="mt-10 text-center">
          <Settings2 className="mx-auto h-6 w-6 text-muted-foreground/50" />
          <p className="mt-3 text-xs text-muted-foreground">
            Select a block on the canvas to inspect it.
          </p>
        </div>
      </div>
    );
  return (
    <div className="p-3">
      <header className="flex items-start justify-between gap-2 border-b border-border pb-3">
        <div>
          <p className="t-label">Block inspector</p>
          <h2 className="mt-1 text-sm font-semibold text-foreground">{def.label}</h2>
          <p className="mt-1 text-2xs text-muted-foreground">{def.description}</p>
        </div>
        <IconButton label="Close inspector" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </header>
      <div className="space-y-3 py-3">
        {(def.fields ?? []).map((field) => {
          const value = block.config[field.key] ?? def.defaults[field.key];
          const update = (v: unknown) =>
            props.onUpdateBlockConfig(block.id, { ...block.config, [field.key]: v });

          if (field.type === "toggle") {
            return (
              <label
                key={field.key}
                className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
              >
                {field.label}
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) => update(event.target.checked)}
                  className="h-6 w-6 rounded-sm accent-[var(--user-accent,var(--primary))]"
                />
              </label>
            );
          }

          if (field.type === "select") {
            return (
              <label key={field.key} className="block text-xs text-muted-foreground">
                {field.label}
                {/* Studio chrome keeps its compact sunken control instead of the app field grammar. */}
                {/* eslint-disable-next-line no-restricted-syntax */}
                <select
                  className="mt-1 w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs"
                  value={String(value ?? "")}
                  onChange={(event) => update(event.target.value)}
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          if (field.type === "range") {
            const raw = typeof value === "number" ? value : Number(value);
            const num = Number.isNaN(raw) ? (field.min ?? 0) : raw;
            return (
              <label key={field.key} className="block text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  {field.label}
                  <span className="font-mono text-2xs text-muted-foreground">{num}</span>
                </div>
                <input
                  type="range"
                  min={field.min ?? 0}
                  max={field.max ?? 100}
                  step={field.step ?? 1}
                  value={num}
                  onChange={(event) => update(Number(event.target.value))}
                  className="mt-1 w-full accent-[var(--user-accent,var(--primary))]"
                />
              </label>
            );
          }

          if (field.type === "color") {
            return (
              <label
                key={field.key}
                className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
              >
                {field.label}
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-2xs text-muted-foreground">
                    {String(value ?? "") || "—"}
                  </span>
                  <input
                    type="color"
                    value={String(value || "#333333")}
                    onChange={(event) => update(event.target.value)}
                    className="h-6 w-8 cursor-pointer rounded-sm border border-border bg-transparent p-0.5"
                  />
                </div>
              </label>
            );
          }

          if (field.type === "image") {
            return (
              <div key={field.key} className="text-xs text-muted-foreground">
                <span className="mb-1 block">{field.label}</span>
                {typeof value === "string" && value.startsWith("http") && (
                  <div className="relative mb-1.5 overflow-hidden rounded-sm border border-border/50">
                    <img src={value} alt="" className="h-16 w-full object-cover" />
                  </div>
                )}
                <input
                  aria-label={field.label}
                  className="w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs"
                  placeholder={field.placeholder ?? "https://…"}
                  value={String(value ?? "")}
                  onChange={(event) => update(event.target.value)}
                />
              </div>
            );
          }

          if (field.type === "textarea") {
            return (
              <label key={field.key} className="block text-xs text-muted-foreground">
                {field.label}
                <textarea
                  className="mt-1 min-h-16 w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs"
                  value={String(value ?? "")}
                  onChange={(event) => update(event.target.value)}
                />
              </label>
            );
          }

          // text (default)
          return (
            <label key={field.key} className="block text-xs text-muted-foreground">
              {field.label}
              <input
                className="mt-1 w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs"
                placeholder={field.placeholder}
                value={String(value ?? "")}
                onChange={(event) => update(event.target.value)}
              />
            </label>
          );
        })}
      </div>
      <BlockFrameSection block={block} {...props} />
      <div className="border-t border-border pt-3">
        <p className="t-label mb-2">Actions</p>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 justify-center"
            onClick={() => props.onMove(block.id, -1)}
          >
            <ChevronUp className="h-3 w-3" /> Move up
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 justify-center"
            onClick={() => props.onMove(block.id, 1)}
          >
            <ChevronDown className="h-3 w-3" /> Move down
          </Button>
          <IconButton label="Duplicate block" onClick={() => props.onDuplicate(block.id)}>
            <Copy className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Remove block" onClick={() => props.onRemove(block.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
        <div className="mt-2 flex">
          <WidthStepper
            block={block}
            section={
              findSection(props.layout, block.id) ?? {
                id: "",
                position: 0,
                layout: "full",
                blocks: [],
              }
            }
            onResize={props.onResizeBlock}
          />
        </div>
      </div>
      <div className="mt-3 border-t border-border pt-3">
        <p className="t-label mb-2">Area</p>
        {props.layout.sections.map((section) => (
          <button
            key={section.id}
            type="button"
            disabled={section.id === findSection(props.layout, block.id)?.id}
            onClick={() => props.onMoveToSection(block.id, section.id)}
            className="flex w-full items-center justify-between px-1.5 py-1 text-left text-xs text-muted-foreground hover:bg-[var(--surface-sunken)] disabled:text-[var(--user-accent-text)]"
          >
            <span>{sectionLabel(section)}</span>
            {section.id === findSection(props.layout, block.id)?.id && (
              <span className="t-label">current</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

const MOBILE_SHEET_TABS: Array<["arrange" | "add" | "feel" | "block", string]> = [
  ["arrange", "Arrange"],
  ["add", "Add"],
  ["feel", "Style"],
  ["block", "Block"],
];

function GMobileEditSheet(props: GStudioSurfaceProps) {
  const [tab, setTab] = useState<"arrange" | "add" | "feel" | "block">("arrange");
  const [open, setOpen] = useState(false);
  const selectedBlock = props.layout.sections
    .flatMap((section) => section.blocks)
    .find((block) => block.id === props.selectedBlockId);
  // Below lg there is no side rail, so a tapped block opens its settings
  // here and scrolls up into the half of the screen the sheet leaves free.
  useEffect(() => {
    if (!props.selectedBlockId) return;
    setOpen(true);
    setTab("block");
    const id = props.selectedBlockId;
    window.requestAnimationFrame(() =>
      document
        .querySelector(`[data-block-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, [props.selectedBlockId]);
  const [targetArea, setTargetArea] = useState<string | undefined>(props.layout.sections[0]?.id);
  const usedBlockTypes = new Set(props.layout.sections.flatMap((s) => s.blocks.map((b) => b.type)));
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed inset-x-3 bottom-20 z-40 flex h-11 items-center justify-center gap-1.5 rounded-md border border-border bg-[var(--surface-elevated)] text-sm font-medium text-foreground shadow-panel"
      >
        <Settings2 className="h-4 w-4" aria-hidden /> Edit Studio
      </button>
    );
  return (
    <section
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[52vh] flex-col border-t border-border bg-[var(--surface-elevated)] shadow-panel"
      aria-label="Mobile Studio editor"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            role="status"
            className={cn(
              "text-xs leading-tight",
              props.saving || props.dirty || props.hasUnpublishedChanges
                ? "text-foreground"
                : "text-trust",
            )}
          >
            {props.saving
              ? "Saving…"
              : props.dirty
                ? "Unsaved changes"
                : props.hasUnpublishedChanges
                  ? "Ready to publish"
                  : props.published
                    ? `Live · v${props.publishedVersion ?? 1}`
                    : "Draft"}
          </span>
        </div>
        <Button
          variant={props.dirty ? "default" : "outline"}
          size="sm"
          className="h-7 px-2 text-2xs pointer-coarse:h-10 pointer-coarse:px-3"
          busy={props.saving}
          disabled={!props.dirty || props.saving}
          onClick={props.onSave}
        >
          <Save className="h-3 w-3" /> Save
        </Button>
        <Button
          variant={props.hasUnpublishedChanges ? "default" : "outline"}
          size="sm"
          className="h-7 px-2 text-2xs pointer-coarse:h-10 pointer-coarse:px-3"
          busy={props.saving}
          disabled={!props.hasUnpublishedChanges || props.saving}
          onClick={props.onPublish}
        >
          <Upload className="h-3 w-3" /> Publish
        </Button>
        <IconButton label="Close mobile editor" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>
      <div
        role="tablist"
        aria-label="Studio editor"
        className="flex items-center gap-1 border-b border-border px-3 py-1.5"
      >
        {MOBILE_SHEET_TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "min-h-10 rounded-sm px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]",
              tab === value && "bg-[var(--user-accent-subtle)] text-[var(--user-accent-text)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {tab === "arrange" && (
          <>
            <p className="mb-2 text-2xs leading-snug text-muted-foreground">
              Move, hide and remove blocks here. Widths apply to the wide layout — on a phone the
              public Studio always stacks in this order.
            </p>
            {props.layout.sections.map((section, sectionIndex) => (
              <div key={section.id} className="mb-3">
                <div className="flex items-center gap-1">
                  <span className="t-label flex-1 truncate">{sectionLabel(section)}</span>
                  <IconButton
                    label="Move area up"
                    disabled={sectionIndex === 0}
                    onClick={() => props.onMoveSection(section.id, -1)}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    label="Move area down"
                    disabled={sectionIndex === props.layout.sections.length - 1}
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
                {section.blocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center gap-1 border-y border-border py-2"
                  >
                    <button
                      type="button"
                      onClick={() => props.onSelect(block.id)}
                      className={cn(
                        "min-w-0 flex-1 truncate rounded-sm px-1 py-1.5 text-left text-xs",
                        props.selectedBlockId === block.id
                          ? "bg-[var(--user-accent-subtle)] text-[var(--user-accent-text)]"
                          : "text-foreground",
                      )}
                    >
                      {getBlock(block.type)?.label ?? block.type}
                    </button>
                    <WidthStepper block={block} section={section} onResize={props.onResizeBlock} />
                    <IconButton label="Move block up" onClick={() => props.onMove(block.id, -1)}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton label="Move block down" onClick={() => props.onMove(block.id, 1)}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label={block.visible === false ? "Show block" : "Hide block"}
                      onClick={() =>
                        props.onBlockAction(block.id, { visible: block.visible === false })
                      }
                    >
                      {block.visible === false ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </IconButton>
                    <IconButton label="Remove block" onClick={() => props.onRemove(block.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
        {tab === "add" && (
          <div className="space-y-3">
            <label className="block">
              <span className="t-label">Add to</span>
              {/* Studio chrome keeps its compact sunken control instead of the app field grammar. */}
              {/* eslint-disable-next-line no-restricted-syntax */}
              <select
                aria-label="Target area"
                value={targetArea}
                onChange={(event) => setTargetArea(event.target.value || undefined)}
                className="mt-1 w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1.5 text-xs outline-none"
              >
                {props.layout.sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {sectionLabel(section)}
                  </option>
                ))}
              </select>
            </label>
            {BLOCK_CATEGORY_ORDER.map((category) => {
              const defs = getAllBlocks().filter(
                (def) =>
                  def.category === category &&
                  def.ownerContext !== "project" &&
                  dedupeSharedReadmeBlocks(def.type, usedBlockTypes),
              );
              if (defs.length === 0) return null;
              return (
                <div key={category}>
                  <p className="t-label mb-1">{BLOCK_CATEGORY_LABELS[category]}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {defs.map((def) => (
                      <button
                        key={def.type}
                        type="button"
                        onClick={() => props.onAdd(def.type, targetArea)}
                        className="rounded-sm border border-border px-2 py-2 text-left text-xs hover:border-[var(--user-accent-border)]"
                      >
                        {def.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {tab === "block" && (
          <GBlockInspector
            {...props}
            block={selectedBlock}
            onClose={() => {
              props.onSelect(null);
              setTab("arrange");
            }}
          />
        )}
        {tab === "feel" && (
          <div>
            <ThemeSection themeId={props.themeId} onThemeChange={props.onThemeChange} />
            {props.onOpenTemplates && (
              <button
                type="button"
                onClick={props.onOpenTemplates}
                className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-2 text-2xs text-foreground outline-none hover:border-[var(--user-accent-border)] hover:bg-[var(--surface-sunken)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1"
              >
                <LayoutTemplate className="h-3 w-3" aria-hidden />
                Browse templates
              </button>
            )}
            <Choice
              label="Structure"
              hint="How wide your Studio reads"
              value={props.config.structure}
              options={[
                ["single", "Column"],
                ["sidebar", "Balanced"],
                ["wide", "Wide"],
              ]}
              onChange={(value) =>
                props.onCustomizeChange({ structure: value as GStudioConfig["structure"] })
              }
            />
            <TypeSection config={props.config} onChange={props.onCustomizeChange} />
            {/* Same list as the desktop panel's "More options" — one component,
                so phone parity cannot drift again. */}
            <GCustomizeAdvanced
              config={props.config}
              layout={props.layout}
              onChange={props.onCustomizeChange}
              cardBorders={props.cardBorders}
              cardBorderColor={props.cardBorderColor}
              onCardBordersChange={props.onCardBordersChange}
              onCardBorderColorChange={props.onCardBorderColorChange}
              onToggleSection={props.onToggleSection}
              onBlockAction={props.onBlockAction}
              onSelect={props.onSelect}
              selectedBlockId={props.selectedBlockId}
              onOpenAppearance={props.onOpenAppearance}
            />
          </div>
        )}
      </div>
    </section>
  );
}
