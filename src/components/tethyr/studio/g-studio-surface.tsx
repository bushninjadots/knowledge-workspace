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
  GripHorizontal,
  GripVertical,
  History,
  Magnet,
  Monitor,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Settings2,
  Sliders,
  Smartphone,
  Sparkles,
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
  BORDER_SWATCHES,
  withCardBorderPreference,
  type CardBorderPreference,
} from "@/lib/background-themes";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUserPalette } from "@/lib/dominant-color";
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
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import {
  StarterPicker,
  STUDIO_STARTERS,
  type StudioStarter,
} from "@/components/tethyr/studio/starter-picker";
import {
  BACKGROUND_OPTIONS,
  CARD_FILL_SWATCHES,
  CARD_SURFACE_STYLE,
  cardFillStyle,
  EDITORIAL_HEADING_FONT,
  RADIUS_MAX,
  RADIUS_MIN,
  structureMaxWidth,
  studioConfigToStyle,
  TECHNICAL_HEADING_FONT,
  type StudioConfig,
} from "@/lib/studio-config";
/** GStudioConfig keeps the legacy component-local name so callers don't churn. */
export type GStudioConfig = StudioConfig;

export type GStudioMode = "view" | "edit" | "preview";
export type GStudioDevice = "desktop" | "tablet" | "mobile";

type DragTarget = { sectionId: string; col: number; row: number };

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
  onGridChange: (sectionId: string, grid: LayoutGridItem[]) => void;
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
  onDragTypeChange: (type: string | null) => void;
  onPaletteTargetChange: (id: string) => void;
  onCustomizeChange: (patch: Partial<GStudioConfig>) => void;
  /** Live card-border preference: the member's appearance, editable in
   *  Customize and persisted to `profiles.background` by the creator. */
  cardBorders: CardBorderPreference;
  cardBorderColor: string;
  onCardBordersChange: (cardBorders: CardBorderPreference) => void;
  onCardBorderColorChange: (color: string) => void;
  onSave: () => void;
  onPublish: () => void;
  onRollback: (version: number) => void;
  onChooseStarter: (starter: StudioStarter) => void;
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

const COLS = 12;
const EditorGrid = WidthProvider(LegacyGridLayout);
const DEVICE_WIDTHS: Record<GStudioDevice, number | undefined> = {
  desktop: undefined,
  // Public CSS grids use `md` = 996px, so the tablet frame lands on the same
  // 12-column grid instead of the editor-only 8-column `sm` layout.
  tablet: 996,
  mobile: 390,
};
const BLOCK_SIZES: Record<string, [number, number, number, number]> = {
  "profile-header": [12, 4, 6, 3],
  "profile-bio": [7, 3, 3, 2],
  "profile-readme": [8, 6, 4, 4],
  "profile-direction": [5, 3, 3, 2],
  "profile-projects": [12, 5, 4, 3],
  "profile-needs": [5, 4, 3, 2],
  "profile-credits": [7, 4, 4, 2],
  "profile-activity": [5, 4, 3, 2],
  "profile-skills": [5, 4, 3, 2],
  "profile-tools": [4, 4, 2, 2],
  "profile-links": [3, 4, 2, 2],
  "profile-achievements": [6, 4, 3, 2],
  "profile-gallery": [12, 5, 4, 3],
  "content-text": [6, 3, 3, 2],
  "content-heading": [12, 2, 3, 2],
  "content-divider": [12, 1, 2, 1],
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
        className="h-5 max-w-[130px] rounded-sm border border-border bg-[var(--surface-sunken)] px-1 font-mono text-3xs uppercase tracking-widest text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:border-[var(--user-accent-border)]"
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
                  "group flex flex-col items-center gap-1 rounded-md border p-1.5 transition-colors",
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
  const { data: me } = useCurrentUser();
  const palette = useUserPalette(me?.bannerSigned ?? null);
  // Customization is the whole point of this view, so the panel starts open on
  // desktop instead of hiding behind a toggle the owner has to discover.
  const [customizeOpen, setCustomizeOpen] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024,
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"left" | "right" | null>(null);
  const [starterOpen, setStarterOpen] = useState(false);
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
  const compact = typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
  const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const directManipulation = !touch;
  const editing = props.mode === "edit";
  const deviceWidth = props.mode === "preview" ? DEVICE_WIDTHS[props.device] : undefined;
  const maxWidth = structureMaxWidth(props.config);
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
  const surfaceStyle = {
    ...studioSurfaceStyle(props.config),
    ...appearanceStyle(borderPreview),
    ...cardFillStyle(props.config),
  };

  const toggleCustomize = () => {
    setCustomizeOpen((open) => !open);
    setPaletteOpen(false);
  };
  const togglePalette = () => {
    setPaletteOpen((open) => !open);
    setCustomizeOpen(false);
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-background"
      data-studio-builder="g"
      data-personality={props.config.personality}
      style={surfaceStyle}
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
        onModeChange={props.onModeChange}
        onDeviceChange={props.onDeviceChange}
        onUndo={props.onUndo}
        onRedo={props.onRedo}
        onFeel={() => setStarterOpen(true)}
        onCustomize={toggleCustomize}
        onPalette={togglePalette}
        onSave={props.onSave}
        onPublish={props.onPublish}
        customizeOpen={customizeOpen}
        paletteOpen={paletteOpen}
        onExit={props.onExit}
        profile={props.profile}
      />
      {historyOpen && (
        <VersionPopover
          versions={props.versions}
          publishedVersion={props.publishedVersion}
          onRollback={props.onRollback}
          onClose={() => setHistoryOpen(false)}
        />
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {editing && (customizeOpen || mobilePanel === "left") && (
          <GCustomizePanel
            config={props.config}
            starterId={props.config.starterId}
            layout={props.layout}
            compact={mobilePanel === "left"}
            onChange={props.onCustomizeChange}
            cardBorders={props.cardBorders}
            cardBorderColor={props.cardBorderColor}
            onCardBordersChange={props.onCardBordersChange}
            onCardBorderColorChange={props.onCardBorderColorChange}
            onToggleSection={props.onToggleSection}
            onBlockAction={props.onBlockAction}
            onSelect={props.onSelect}
            onClose={() => {
              setCustomizeOpen(false);
              setMobilePanel(null);
            }}
            onFeel={() => setStarterOpen(true)}
            onCompleteProfile={props.onCompleteProfile}
            onReset={props.onReset}
          />
        )}
        <main
          className="relative min-w-0 flex-1 overflow-y-auto bg-noise"
          aria-label="Studio canvas"
          style={CARD_SURFACE_STYLE}
        >
          <BackgroundLayer
            background={me?.background}
            imageUrl={me?.backgroundImageUrl}
            bannerColor={palette?.dominant ?? null}
          />
          <div
            className="mx-auto w-full"
            style={{
              // Desktop preview is full-bleed like the public page; edit and
              // tablet/mobile preview stay capped (structure or device width).
              maxWidth: deviceWidth ?? (props.mode === "preview" ? undefined : maxWidth),
            }}
          >
            <GStudioCanvas
              {...props}
              sections={sections}
              editing={editing}
              directManipulation={directManipulation}
              frameWidth={deviceWidth}
              onBlockEmptyChange={handleBlockEmpty}
              emptyBlockIds={emptyBlocks}
              snapToBlocks={snapToBlocks}
              onGridChange={props.onGridChange}
              onRequestPalette={(sectionId) => {
                props.onPaletteTargetChange(sectionId);
                setPaletteOpen(true);
              }}
            />
          </div>
        </main>
        {editing && (paletteOpen || props.selectedBlockId || mobilePanel === "right") && (
          <GInspectorRail
            {...props}
            paletteOpen={paletteOpen}
            onClose={() => {
              setPaletteOpen(false);
              props.onSelect(null);
            }}
          />
        )}
        {editing && compact && <GMobileEditSheet {...props} onFeel={() => setStarterOpen(true)} />}
      </div>
      {starterOpen && (
        <StarterPicker
          currentId={props.config.starterId}
          canUndo={props.canUndo}
          onUndo={props.onUndo}
          onChoose={props.onChooseStarter}
          onClose={() => setStarterOpen(false)}
        />
      )}
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
  onModeChange,
  onDeviceChange,
  onUndo,
  onRedo,
  onFeel,
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
  onModeChange: (mode: GStudioMode) => void;
  onDeviceChange: (device: GStudioDevice) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFeel: () => void;
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
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[var(--surface-elevated)]">
      <div className="flex min-h-10 items-center gap-2 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {onExit && (
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onExit}>
              <ArrowLeft className="h-3.5 w-3.5" />
              {!compact && <span className="text-xs">Studio</span>}
            </Button>
          )}
          <span className="font-mono text-2xs font-semibold uppercase tracking-[0.18em] text-foreground">
            Tethyr
          </span>
          <span className="text-muted-foreground-subtle" aria-hidden>
            /
          </span>
          <span className="t-heading truncate text-[13px] font-semibold text-foreground">
            Studio
          </span>
          <span className="text-muted-foreground-subtle" aria-hidden>
            /
          </span>
          <span className="truncate text-[13px] text-muted-foreground">Customize</span>
          <span
            className={cn(
              "hidden border px-1.5 py-0.5 font-mono text-3xs sm:inline",
              hasUnpublishedChanges ? "border-caution text-caution" : "border-trust text-trust",
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
            <span className="hidden font-mono text-2xs text-muted-foreground-subtle sm:inline">
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
              onClick={() => onModeChange(item)}
              className={cn(
                "flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs",
                mode === item
                  ? "bg-[var(--surface-elevated)] text-foreground shadow-sm"
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
              {!compact && (
                <>
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
                  <Button variant="ghost" size="sm" onClick={onFeel}>
                    <Sparkles className="h-3 w-3" /> Starting point
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
                    disabled={!dirty || saving}
                    onClick={onSave}
                  >
                    {saving ? "Saving" : "Save draft"}
                  </Button>
                  <Button
                    variant={hasUnpublishedChanges ? "default" : "outline"}
                    size="sm"
                    disabled={!hasUnpublishedChanges || saving}
                    onClick={onPublish}
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
                  label={`${item} preview`}
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
          <IconButton label="Version history" active={historyOpen} onClick={onHistory}>
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
          <span className="truncate text-2xs text-muted-foreground-subtle">
            Drag any block to move it — it snaps to the grid and nearby blocks when Snap is on ·
            pull an edge or corner to resize · arrow keys nudge a selected block
          </span>
        </div>
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
  return (
    <div
      className="absolute right-3 top-11 z-50 w-72 border border-border bg-[var(--popover)] p-3 shadow-panel"
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
                  {version.version === publishedVersion ? "Latest published" : "Published"}
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
                Restore
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
  frameWidth,
  snapToBlocks,
  onRequestPalette,
  ...props
}: GStudioSurfaceProps & {
  sections: LayoutSection[];
  editing: boolean;
  directManipulation: boolean;
  frameWidth?: number;
  snapToBlocks: boolean;
  onRequestPalette: (id: string) => void;
}) {
  return (
    <div
      className="mx-auto w-full px-4 pb-24 pt-5 sm:px-6"
      style={{ maxWidth: frameWidth ?? undefined }}
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
            className="flex w-full items-center justify-center gap-1.5 border border-dashed border-border py-3 font-mono text-2xs uppercase tracking-widest text-muted-foreground hover:border-[var(--user-accent-border)] hover:text-[var(--user-accent)]"
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
        "opacity-0 transition-opacity duration-140 group-hover/frame:opacity-100",
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

function overlapsGridItems(a: LayoutGridItem, b: LayoutGridItem): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function xOverlaps(a: LayoutGridItem, b: LayoutGridItem): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x;
}

function firstFreeGridPosition(
  existing: LayoutGridItem[],
  width: number,
  height: number,
): { x: number; y: number } {
  const maxY = existing.reduce((value, item) => Math.max(value, item.y + item.h), 0);
  for (let y = 0; y <= maxY + height; y += 1) {
    for (let x = 0; x <= COLS - width; x += 1) {
      const candidate = { i: "__candidate__", x, y, w: width, h: height };
      if (!existing.some((item) => overlapsGridItems(candidate, item))) {
        return { x, y };
      }
    }
  }
  return { x: 0, y: maxY };
}

export function snapGridPlacement(
  target: DragTarget | null,
  width: number,
  height: number,
  existing: LayoutGridItem[],
  enabled: boolean,
  ignoreId?: string,
): DragTarget | null {
  if (!target) return null;
  const maxCol = Math.max(0, COLS - width);
  const clamped = {
    ...target,
    col: Math.max(0, Math.min(maxCol, Math.round(target.col))),
    row: Math.max(0, Math.round(target.row)),
  };
  if (!enabled) return clamped;

  const others = existing.filter((item) => item.i !== ignoreId);
  const candidates: Array<{ col: number; row: number; distance: number }> = [];
  for (const item of others) {
    const edgeCandidates = [
      { col: item.x + item.w, row: item.y },
      { col: item.x - width, row: item.y },
      { col: item.x, row: item.y + item.h },
      { col: item.x, row: item.y - height },
      { col: item.x + item.w - width, row: item.y },
      { col: item.x + item.w - width, row: item.y + item.h - height },
      { col: item.x, row: item.y + item.h - height },
    ];
    for (const candidate of edgeCandidates) {
      const col = Math.max(0, Math.min(maxCol, candidate.col));
      const row = Math.max(0, candidate.row);
      const distance = Math.abs(col - clamped.col) + Math.abs(row - clamped.row);
      if (distance <= 2) {
        const proposed = { i: "__snap__", x: col, y: row, w: width, h: height };
        if (!others.some((other) => overlapsGridItems(proposed, other))) {
          candidates.push({ col, row, distance });
        }
      }
    }
  }
  const nearest = candidates.sort((a, b) => a.distance - b.distance)[0];
  return nearest ? { ...clamped, col: nearest.col, row: nearest.row } : clamped;
}

/** After RGL settles a drag inside a section, re-align the block onto a nearby
 *  neighbour edge when block-edge snapping is enabled. Returns an updated grid
 *  when the dropped cell moved, otherwise null (caller keeps the RGL result). */
function settleGridSnap(
  grid: LayoutGridItem[],
  blockId: string,
  enabled: boolean,
): LayoutGridItem[] | null {
  const item = grid.find((candidate) => candidate.i === blockId);
  if (!item) return null;
  const others = grid.filter((candidate) => candidate.i !== blockId);
  const snapped = snapGridPlacement(
    { sectionId: "", col: item.x, row: item.y },
    item.w,
    item.h,
    others,
    enabled,
    blockId,
  );
  if (!snapped || (snapped.col === item.x && snapped.row === item.y)) return null;
  const moved = { ...item, x: snapped.col, y: snapped.row };
  if (others.some((other) => overlapsGridItems(moved, other))) {
    const free = firstFreeGridPosition(others, moved.w, moved.h);
    moved.x = free.x;
    moved.y = free.y;
  }
  if (moved.x === item.x && moved.y === item.y) return null;
  return [...others, moved];
}

/** Minimum whole grid rows whose pixel box (h × row + (h−1) × margin) can hold
 *  `contentPx` pixels. Auto-grow uses this so editing never clips content. */
function minRowsForContent(
  contentPx: number,
  rowHeight: number,
  marginY: number,
  minRows = 1,
): number {
  if (!Number.isFinite(contentPx) || contentPx <= 0) return minRows;
  return Math.max(minRows, Math.ceil((contentPx + marginY) / (rowHeight + marginY)));
}

/** Grow a block's rows to fit its measured content, pushing any neighbours it
 *  would now overlap downward so the grid never ends up with overlapping
 *  blocks. Returns the updated grid or null when no change is needed. */
function growGridItemToContent(
  grid: LayoutGridItem[],
  blockId: string,
  contentPx: number,
  rowHeight: number,
  marginY: number,
): LayoutGridItem[] | null {
  const item = grid.find((candidate) => candidate.i === blockId);
  if (!item) return null;
  const rows = minRowsForContent(contentPx, rowHeight, marginY, item.minH ?? 1);
  if (rows <= item.h) return null;
  const grown = { ...item, h: rows };
  const updated = grid.map((candidate) => (candidate.i === blockId ? grown : candidate));
  return pushDownOverlaps(updated);
}

/** Move any item that overlaps the one above it straight down so the grid is
 *  never overlapping. Only items that actually collide move — deliberate
 *  whitespace gaps elsewhere survive. The item array order (and therefore block
 *  positions) is preserved. */
function pushDownOverlaps(grid: LayoutGridItem[]): LayoutGridItem[] {
  const items = grid.map((item) => ({ ...item }));
  let changed = true;
  let guard = 0;
  const maxPasses = items.length * items.length + items.length + 4;
  while (changed && guard < maxPasses) {
    changed = false;
    guard += 1;
    for (let i = 0; i < items.length; i += 1) {
      const upper = items[i];
      for (let j = 0; j < items.length; j += 1) {
        if (i === j) continue;
        const lower = items[j];
        // Only nudge items that start below the grown block.
        if (lower.y < upper.y) continue;
        if (lower.y >= upper.y + upper.h) continue;
        if (!xOverlaps(upper, lower)) continue;
        const pushedY = upper.y + upper.h;
        if (pushedY > lower.y) {
          lower.y = pushedY;
          changed = true;
        }
      }
    }
  }
  return items;
}

function GSectionBand({
  section,
  index,
  total,
  editing,
  directManipulation,
  snapToBlocks,
  onRequestPalette,
  ...props
}: GStudioSurfaceProps & {
  section: LayoutSection;
  index: number;
  total: number;
  editing: boolean;
  directManipulation: boolean;
  snapToBlocks: boolean;
  onRequestPalette: (id: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
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
  const onGridChangeRef = useRef(props.onGridChange);
  onGridChangeRef.current = props.onGridChange;
  const sectionIdRef = useRef(section.id);
  sectionIdRef.current = section.id;
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
        const updated = growGridItemToContent(
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
      if (changed) onGridChangeRef.current(sectionIdRef.current, current);
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
        <header className="mb-2 flex items-center gap-1.5">
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
              className="t-label truncate rounded-sm px-0.5 hover:text-foreground"
            >
              {sectionTitle}
            </button>
          )}
          {section.layout === "feature" && (
            <span className="t-label text-[var(--user-accent)]">spine</span>
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
            onClick={() => onRequestPalette(section.id)}
            className="flex w-full items-center justify-center gap-1.5 border border-dashed border-border py-8 text-xs text-muted-foreground hover:border-[var(--user-accent-border)] hover:text-[var(--user-accent)]"
          >
            <Plus className="h-3.5 w-3.5" /> Add a block
          </button>
        ) : null
      ) : editing ? (
        <div data-studio-grid={section.id} className="relative">
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
            resizeHandles={["se", "e", "s"]}
            resizeHandle={ResizeHandle}
            useCSSTransforms
            compactType={null}
            // Free canvas: a dragged block never displaces its neighbours. It
            // parks at the last free spot instead of shoving everything away.
            preventCollision

            onDragStart={() => props.onGridInteractionStart()}
            onResizeStart={() => props.onGridInteractionStart()}
            onDragStop={(current, _oldItem, newItem) => {
              props.onGridInteractionEnd();
              if (!editing || !directManipulation || !newItem) return;
              const blockId = newItem.i;
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
            onResizeStop={() => props.onGridInteractionEnd()}
            onDrop={(_layout, item, event) => {
              const type =
                props.dragType ?? (event as DragEvent).dataTransfer?.getData("text/plain");
              if (type && item) {
                props.onAdd(type, section.id, item);
                props.onDragTypeChange(null);
              }
            }}
            onLayoutChange={(next) => {
              if (!editing) return;
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
          className="mx-auto mt-1 flex h-6 items-center gap-1 border border-border bg-[var(--surface-elevated)] px-1.5 font-mono text-3xs uppercase tracking-widest text-muted-foreground opacity-0 hover:opacity-100 focus-visible:opacity-100"
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
  const blockContext = {
    ownerId: props.userId,
    ownerType: "profile" as const,
    pageId: `profile:${props.userId}`,
    blockId: block.id,
    isEditing: editing,
    isOwner: true,
    data: props.profile ? { profile: props.profile } : undefined,
    onBlockEmptyChange: editing ? undefined : props.onBlockEmptyChange,
    onCompleteProfile: props.onCompleteProfile,
    onAddProject: props.onAddProject,
  } as BlockContext;
  // Watch the content box of an editing block and report its natural height so
  // the grid can grow the row count instead of clipping the block's content.
  useEffect(() => {
    if (!editing || fluid || !reportContentHeight) return;
    const node = contentRef.current;
    if (!node) return;
    let frame = 0;
    const report = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        reportContentHeight(block.id, node.scrollHeight);
      });
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(node);
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
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onTouchEnd={onTouchEnd}
      className={cn(
        className,
        "group/frame relative",
        !fluid && "h-full min-h-0",
        editing && "cursor-grab active:cursor-grabbing",
        selected && "ring-1 ring-[var(--user-accent)]",
        block.visible === false && "opacity-45",
      )}
      onClick={(event) => {
        if (!editing) return;
        event.stopPropagation();
        props.onSelect(block.id);
      }}
    >
      <div
        ref={contentRef}
        className={cn(
          "relative overflow-x-hidden studio-block",
          !fluid && "h-full min-h-0 overflow-y-auto",
        )}
      >
        <div className={cn("flex [&>*]:min-w-0 [&>*]:flex-1", !fluid && "min-h-full")}>
          <BlockRenderer
            type={block.type}
            config={block.config}
            context={blockContext}
            onChange={(config) => props.onUpdateBlockConfig(block.id, config)}
          />
        </div>
      </div>
      {editing && (
        <>
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-1 top-1 z-20 flex h-6 w-6 items-center justify-center rounded-sm border border-[var(--user-accent-border)] bg-[var(--surface-elevated)] text-[var(--user-accent)] shadow-sm transition-opacity group-hover/frame:opacity-100",
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
          "pointer-events-none absolute inset-0 z-10 rounded-[var(--studio-radius)] ring-1 ring-inset",
          selected
            ? "ring-[var(--user-accent)]"
            : "ring-transparent group-hover/frame:ring-border-strong",
        )}
      />
      {children}
    </div>
  );
});

function GInspectorRail(
  props: GStudioSurfaceProps & { paletteOpen: boolean; onClose: () => void },
) {
  const block = props.layout.sections
    .flatMap((section) => section.blocks)
    .find((item) => item.id === props.selectedBlockId);
  return (
    <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-border bg-[var(--surface-elevated)] lg:block">
      {props.paletteOpen ? (
        <GBlockPalette {...props} />
      ) : (
        <GBlockInspector {...props} block={block} onClose={props.onClose} />
      )}
    </aside>
  );
}

/** 36×24 wireframe sketch shown next to each block in the palette. Type-level
 *  sketches communicate what a block renders at a glance; unknown or new types
 *  fall back to a category sketch so the palette never looks broken. */
function BlockGlyph({ type, category }: { type: string; category: BlockCategory }) {
  const stroke = "var(--border-strong)";
  const accent = "var(--user-accent,var(--primary))";
  const line = (y: number, x = 2, w = 32, h = 1.6) => (
    <rect x={x} y={y} width={w} height={h} rx={0.8} fill="var(--border)" />
  );
  const chip = (y: number, x: number, w = 12, h = 4) => (
    <rect x={x} y={y} width={w} height={h} rx={2} fill="var(--border-soft,var(--border))" />
  );
  const card = (x: number, y: number, w: number, h: number) => (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={1.5}
      fill="var(--surface-sunken)"
      stroke={stroke}
      strokeWidth={0.8}
    />
  );
  switch (type) {
    case "profile-header":
      return (
        <>
          <circle
            cx={8}
            cy={9}
            r={5}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
          <rect x={16} y={4} width={18} height={2.4} rx={1.2} fill={accent} />
          {line(9, 16, 14)}
          {line(12.5, 16, 18)}
          {line(16, 16, 12)}
        </>
      );
    case "profile-projects":
      return (
        <>
          {card(2, 3, 15, 18)}
          {line(5.5, 5, 9)}
          {line(9.5, 5, 9)}
          {line(15, 5, 9)}
          {card(19, 3, 15, 18)}
          {line(22.5, 22, 9)}
          {line(26.5, 22, 9)}
        </>
      );
    case "profile-skills":
      return (
        <>
          {chip(3, 2, 12, 5)}
          {line(4.5, 18, 16)}
          {chip(9.5, 2, 8, 5)}
          {line(11, 18, 16)}
          {chip(16, 2, 10, 5)}
          {line(17.5, 18, 16)}
        </>
      );
    case "profile-tools":
      return (
        <>
          {chip(3, 2, 14, 5)}
          {chip(10, 2, 10, 5)}
          {chip(3, 19, 12, 5)}
          {chip(10, 19, 12, 5)}
          {chip(17, 19, 8, 5)}
          {chip(20, 2, 6, 5)}
        </>
      );
    case "profile-gallery":
      return (
        <>
          {card(2, 2, 15, 9)}
          {card(19, 2, 15, 9)}
          {card(2, 13, 15, 9)}
          {card(19, 13, 15, 9)}
        </>
      );
    case "profile-experience":
      return (
        <>
          <rect
            x={8}
            y={2}
            width={1.4}
            height={20}
            rx={0.7}
            fill="var(--border-soft,var(--border))"
          />
          <circle cx={8.9} cy={6} r={1.8} fill={accent} />
          <circle
            cx={8.9}
            cy={12}
            r={1.8}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
          <circle
            cx={8.9}
            cy={18}
            r={1.8}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
          {line(5, 15, 19)}
          {line(11, 15, 15)}
          {line(17, 15, 17)}
        </>
      );
    case "profile-achievements":
      return (
        <>
          <rect
            x={2}
            y={3}
            width={14}
            height={18}
            rx={1.5}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.8}
          />
          <rect x={6} y={7} width={6} height={1.6} rx={0.8} fill={accent} />
          {line(11, 6, 6)}
          {line(14.5, 6, 6)}
          {line(18, 6, 6)}
        </>
      );
    case "profile-direction":
      return (
        <>
          <circle
            cx={7}
            cy={9}
            r={5.5}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
          <rect
            x={10}
            y={12}
            width={5}
            height={1.4}
            rx={0.7}
            fill="var(--border-soft,var(--border))"
            transform="rotate(45 12.5 12.7)"
          />
          <rect
            x={4.5}
            y={6.5}
            width={5}
            height={1.4}
            rx={0.7}
            fill="var(--border-soft,var(--border))"
            transform="rotate(45 7 7.2)"
          />
          <circle
            cx={7}
            cy={9}
            r={1.4}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.8}
          />
          {line(6, 17, 17)}
          {line(12, 17, 12)}
          {line(18, 17, 9)}
        </>
      );
    case "content-divider":
      return (
        <rect
          x={2}
          y={11}
          width={32}
          height={1.4}
          rx={0.7}
          fill="var(--border-strong,var(--border))"
        />
      );
    case "content-heading":
      return (
        <>
          <rect x={2} y={3} width={26} height={3} rx={1.2} fill={accent} />
          {line(10, 2, 30)}
          {line(14, 2, 26)}
          {line(18, 2, 18)}
        </>
      );
    case "profile-bio":
    case "content-text":
    case "content-markdown":
      return (
        <>
          {line(4, 2, 32)}
          {line(9, 2, 28)}
          {line(14, 2, 32)}
          {line(19, 2, 20)}
        </>
      );
    case "profile-links":
      return (
        <>
          {line(4, 9, 25)}
          <circle
            cx={6}
            cy={4.8}
            r={1.5}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
          {line(9, 9, 25)}
          <circle
            cx={6}
            cy={9.8}
            r={1.5}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
          {line(14, 9, 25)}
          <circle
            cx={6}
            cy={14.8}
            r={1.5}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
        </>
      );
    default:
      if (category === "project" || category === "community") {
        return (
          <>
            <rect x={2} y={3} width={32} height={4} rx={1.5} fill={accent} />
            {line(11, 2, 30)}
            {line(16, 2, 24)}
          </>
        );
      }
      return (
        <>
          <circle
            cx={8}
            cy={8}
            r={5}
            fill="var(--surface-sunken)"
            stroke={stroke}
            strokeWidth={0.9}
          />
          {line(17, 16, 18)}
          {line(21, 16, 18)}
        </>
      );
  }
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

function GBlockPalette(props: GStudioSurfaceProps & { onClose: () => void }) {
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
    <aside aria-label="Add blocks" className="flex min-h-full w-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="t-label">Add to Studio</h2>
        <IconButton label="Close palette" onClick={props.onClose}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </header>
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
                  <p className="t-label mb-1 mt-3 text-2xs text-[var(--user-accent)] first:mt-0">
                    {BLOCK_CATEGORY_LABELS[category]}
                  </p>
                  {categoryBlocks.map((def) => blockItem(def))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </aside>
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
                  className="h-4 w-4 rounded-sm"
                />
              </label>
            );
          }

          if (field.type === "select") {
            return (
              <label key={field.key} className="block text-xs text-muted-foreground">
                {field.label}
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
      <div className="border-t border-border pt-3">
        <p className="t-label mb-2">Actions</p>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => props.onMove(block.id, -1)}>
            <ChevronUp className="h-3 w-3" /> Up
          </Button>
          <Button variant="outline" size="sm" onClick={() => props.onMove(block.id, 1)}>
            <ChevronDown className="h-3 w-3" /> Down
          </Button>
          <IconButton label="Duplicate block" onClick={() => props.onDuplicate(block.id)}>
            <Copy className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Remove block" onClick={() => props.onRemove(block.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
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
            className="flex w-full items-center justify-between px-1.5 py-1 text-left text-xs text-muted-foreground hover:bg-[var(--surface-sunken)] disabled:text-[var(--user-accent)]"
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

const ACCENT_SWATCHES = ["#3f8f8a", "#2f6fd0", "#7a4ecf", "#b4632a", "#2f7d4a", "#1f2328"];
const STUDIO_CUSTOMIZE_ADVANCED_KEY = "studio-customize-advanced-open";

function GCustomizePanel({
  config,
  starterId,
  layout,
  compact,
  onChange,
  cardBorders,
  cardBorderColor,
  onCardBordersChange,
  onCardBorderColorChange,
  onToggleSection,
  onBlockAction,
  onSelect,
  onClose,
  onFeel,
  onCompleteProfile,
  onReset,
}: {
  config: GStudioConfig;
  starterId: StudioConfig["starterId"];
  layout: PageLayout;
  compact: boolean;
  onChange: (patch: Partial<GStudioConfig>) => void;
  cardBorders: CardBorderPreference;
  cardBorderColor: string;
  onCardBordersChange: (cardBorders: CardBorderPreference) => void;
  onCardBorderColorChange: (color: string) => void;
  onToggleSection: (id: string) => void;
  onBlockAction: (id: string, patch: Partial<LayoutBlockInstance>) => void;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  onFeel: () => void;
  onCompleteProfile?: () => void;
  onReset: () => void;
}) {
  const starter = starterId
    ? (STUDIO_STARTERS.find((item) => item.id === starterId) ?? null)
    : null;
  // Progressive disclosure: the three "feel" decisions stay on top for every
  // visitor; fine-tuning lives under "More options" and remembers its state.
  const [advancedOpen, setAdvancedOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setAdvancedOpen(window.localStorage.getItem(STUDIO_CUSTOMIZE_ADVANCED_KEY) === "open");
  }, []);
  const toggleAdvanced = useCallback(() => {
    setAdvancedOpen((open) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STUDIO_CUSTOMIZE_ADVANCED_KEY, open ? "closed" : "open");
      }
      return !open;
    });
  }, []);
  return (
    <aside
      className={cn(
        "flex w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-[var(--surface-elevated)]",
        compact && "fixed inset-y-11 left-0 z-40",
      )}
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="t-label">Customize</h2>
        <IconButton label="Close customize" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-border pb-3">
          <div className="min-w-0">
            <p className="t-label">Starting point</p>
            <p className="mt-0.5 truncate text-xs text-foreground">
              {starter ? starter.name : "Custom"}
            </p>
            <p className="truncate text-2xs text-muted-foreground-subtle">
              {starter ? starter.tagline : "Built from your own choices"}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onFeel}>
            <Sparkles className="h-3 w-3" /> Change
          </Button>
        </div>
        <Choice
          label="Structure"
          hint="How wide your Studio reads"
          value={config.structure}
          options={[
            ["single", "Column"],
            ["sidebar", "Balanced"],
            ["wide", "Wide"],
          ]}
          onChange={(value) => onChange({ structure: value as GStudioConfig["structure"] })}
        />
        <Choice
          label="Personality"
          hint="Typography and visual character — Editorial uses Space Grotesk, Technical uses JetBrains Mono"
          value={config.personality}
          options={[
            ["modern", "Modern"],
            ["editorial", "Editorial"],
            ["technical", "Technical"],
          ]}
          onChange={(value) => onChange({ personality: value as GStudioConfig["personality"] })}
        />
        <button
          type="button"
          onClick={toggleAdvanced}
          aria-expanded={advancedOpen}
          className="mb-3 flex w-full items-center justify-between gap-2 border-t border-border pt-3 text-left"
        >
          <span className="t-label">More options</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              advancedOpen && "rotate-180",
            )}
          />
        </button>
        {advancedOpen && (
          <>
            <Choice
              label="Density"
              hint="Spacing rhythm between blocks"
              value={config.density}
              options={[
                ["compact", "Compact"],
                ["comfortable", "Comfortable"],
                ["spacious", "Spacious"],
              ]}
              onChange={(value) => onChange({ density: value as GStudioConfig["density"] })}
            />
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="t-label">Corners</p>
                <span className="t-label tabular-nums">{config.radius}px</span>
              </div>
              <p className="mb-1.5 text-[0.6875rem] leading-snug text-muted-foreground">
                Roundness of card corners, from sharp to generously soft.
              </p>
              <input
                type="range"
                min={RADIUS_MIN}
                max={RADIUS_MAX}
                step={1}
                value={config.radius}
                aria-label="Corner radius in pixels"
                onChange={(event) => onChange({ radius: Number(event.target.value) })}
                className="studio-slider w-full"
              />
            </div>
            <Choice
              label="Accent"
              value={config.accentMode}
              options={[
                ["auto", "From banner"],
                ["custom", "Pick"],
                ["none", "None"],
              ]}
              onChange={(value) => onChange({ accentMode: value as GStudioConfig["accentMode"] })}
            />
            {config.accentMode === "custom" && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ACCENT_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`Accent ${swatch}`}
                    aria-pressed={config.accentColor.toLowerCase() === swatch}
                    onClick={() => onChange({ accentColor: swatch })}
                    className={cn(
                      "h-6 w-6 rounded-sm border-2",
                      config.accentColor.toLowerCase() === swatch
                        ? "border-foreground"
                        : "border-border",
                    )}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
            )}
            <Choice
              label="Card borders"
              hint="Outlines around cards and panels"
              value={cardBorders}
              options={[
                ["neutral", "Neutral"],
                ["accent", "Dynamic"],
                ["custom", "Custom"],
                ["none", "None"],
              ]}
              onChange={(value) => onCardBordersChange(value as CardBorderPreference)}
            />
            <Choice
              label="Border weight"
              hint="Control how much the card outline carries"
              value={config.cardBorderWidth ?? "thin"}
              options={[
                ["thin", "Thin"],
                ["medium", "Medium"],
                ["thick", "Thick"],
              ]}
              onChange={(value) =>
                onChange({ cardBorderWidth: value as GStudioConfig["cardBorderWidth"] })
              }
            />
            {cardBorders === "custom" && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {BORDER_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`Card border ${swatch}`}
                    aria-pressed={cardBorderColor.toLowerCase() === swatch}
                    onClick={() => onCardBorderColorChange(swatch)}
                    className={cn(
                      "h-6 w-6 rounded-sm border-2",
                      cardBorderColor.toLowerCase() === swatch
                        ? "border-foreground"
                        : "border-border",
                    )}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
            )}
            <div className="mb-4">
              <p className="t-label mb-1.5">Card fill</p>
              <p className="mb-1.5 text-2xs leading-snug text-muted-foreground-subtle">
                Colour and translucency of every block surface
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CARD_FILL_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.value || "auto"}
                    type="button"
                    title={swatch.label}
                    aria-label={`Card fill ${swatch.label}`}
                    aria-pressed={(config.cardColor ?? "").toLowerCase() === swatch.value}
                    onClick={() => onChange({ cardColor: swatch.value })}
                    className={cn(
                      "h-6 w-6 rounded-sm border-2 text-3xs",
                      (config.cardColor ?? "").toLowerCase() === swatch.value
                        ? "border-foreground"
                        : "border-border",
                    )}
                    style={
                      swatch.value
                        ? { backgroundColor: swatch.value }
                        : { backgroundColor: "var(--surface-elevated)" }
                    }
                  >
                    {swatch.value ? "" : "A"}
                  </button>
                ))}
              </div>
              <label className="mt-2 block">
                <span className="mb-1 flex items-center justify-between font-mono text-3xs uppercase tracking-widest text-muted-foreground-subtle">
                  Opacity <span>{config.cardOpacity}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={config.cardOpacity}
                  onChange={(event) => onChange({ cardOpacity: Number(event.target.value) })}
                  className="w-full accent-[var(--user-accent)]"
                />
              </label>
            </div>
            <div className="mb-4 border-t border-border pt-3">
              <p className="t-label mb-1.5">Background</p>
              {(
                [
                  ["While editing", "appBackground"],
                  ["Public Studio", "publicBackground"],
                ] as const
              ).map(([label, key]) => (
                <div key={key} className="mb-2">
                  <p className="mb-1 font-mono text-3xs uppercase tracking-widest text-muted-foreground-subtle">
                    {label}
                  </p>
                  <div className="grid grid-cols-3 gap-1 border border-border bg-[var(--surface-sunken)] p-0.5">
                    {BACKGROUND_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={config[key] === option.value}
                        onClick={() => onChange({ [key]: option.value } as Partial<GStudioConfig>)}
                        className={cn(
                          "rounded-sm px-1 py-1 text-2xs",
                          config[key] === option.value
                            ? "bg-[var(--surface-elevated)] text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3">
              <p className="t-label mb-1.5">Content</p>
              <ul className="space-y-2">
                {layout.sections.map((section) => (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => onToggleSection(section.id)}
                      aria-label={
                        section.visible === false
                          ? `Show ${sectionLabel(section)}`
                          : `Hide ${sectionLabel(section)}`
                      }
                      className="flex min-w-0 w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left hover:bg-[var(--surface-sunken)]"
                    >
                      {section.visible === false ? (
                        <EyeOff className="h-3 w-3 shrink-0 text-muted-foreground-subtle" />
                      ) : (
                        <Eye className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                      <span
                        className={cn(
                          "truncate text-xs",
                          section.visible === false
                            ? "text-muted-foreground-subtle line-through"
                            : "text-foreground",
                        )}
                      >
                        {sectionLabel(section)}
                      </span>
                    </button>
                    <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
                      {section.blocks.map((block) => (
                        <li key={block.id}>
                          <button
                            type="button"
                            onClick={() => {
                              onSelect(block.id);
                              onBlockAction(block.id, { visible: block.visible === false });
                            }}
                            className="flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left hover:bg-[var(--surface-sunken)]"
                          >
                            {block.visible === false ? (
                              <EyeOff className="h-3 w-3 shrink-0 text-muted-foreground-subtle" />
                            ) : (
                              <Eye className="h-3 w-3 shrink-0 text-muted-foreground-subtle" />
                            )}
                            <span
                              className={cn(
                                "truncate text-2xs",
                                block.visible === false
                                  ? "text-muted-foreground-subtle line-through"
                                  : "text-muted-foreground",
                              )}
                            >
                              {getBlock(block.type)?.label ?? block.type}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
            {onCompleteProfile && (
              <button
                type="button"
                onClick={onCompleteProfile}
                className="mt-4 border-t border-border pt-3 text-left text-xs text-primary"
              >
                Complete your profile
              </button>
            )}
          </>
        )}
      </div>
      <footer className="border-t border-border p-3">
        <button
          type="button"
          onClick={onReset}
          className="flex w-full items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-[var(--surface-sunken)] hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          Reset to default Studio
        </button>
      </footer>
    </aside>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <div className="mb-4">
      <p className="t-label mb-1.5">{label}</p>
      {hint && <p className="mb-1.5 text-2xs leading-snug text-muted-foreground-subtle">{hint}</p>}
      <div className="grid grid-cols-3 gap-1 border border-border bg-[var(--surface-sunken)] p-0.5">
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-sm px-1 py-1.5 text-2xs",
              value === option
                ? "bg-[var(--surface-elevated)] text-foreground"
                : "text-muted-foreground",
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function GMobileEditSheet(props: GStudioSurfaceProps & { onFeel: () => void }) {
  const [tab, setTab] = useState<"arrange" | "add" | "feel">("arrange");
  const [open, setOpen] = useState(true);
  const [targetArea, setTargetArea] = useState<string | undefined>(props.layout.sections[0]?.id);
  const usedBlockTypes = new Set(props.layout.sections.flatMap((s) => s.blocks.map((b) => b.type)));
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 border border-border bg-[var(--surface-elevated)] px-3 py-2 text-xs shadow-panel"
      >
        Edit Studio
      </button>
    );
  return (
    <section
      className="fixed inset-x-0 bottom-0 z-40 max-h-[62vh] border-t border-border bg-[var(--surface-elevated)] shadow-panel"
      aria-label="Mobile Studio editor"
    >
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => setTab("arrange")}
          className={cn(
            "px-2 py-1 text-xs",
            tab === "arrange" && "bg-[var(--user-accent-subtle)] text-[var(--user-accent)]",
          )}
        >
          Arrange
        </button>
        <button
          type="button"
          onClick={() => setTab("add")}
          className={cn(
            "px-2 py-1 text-xs",
            tab === "add" && "bg-[var(--user-accent-subtle)] text-[var(--user-accent)]",
          )}
        >
          <Plus className="mr-1 inline h-3 w-3" /> Add
        </button>
        <button
          type="button"
          onClick={() => setTab("feel")}
          className={cn(
            "px-2 py-1 text-xs",
            tab === "feel" && "bg-[var(--user-accent-subtle)] text-[var(--user-accent)]",
          )}
        >
          <Sliders className="mr-1 inline h-3 w-3" /> Style
        </button>
        <IconButton label="Close mobile editor" className="ml-auto" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>
      <div className="max-h-[48vh] overflow-y-auto px-3 py-2">
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
                        "min-w-0 flex-1 truncate rounded-sm px-1 py-0.5 text-left text-xs",
                        props.selectedBlockId === block.id
                          ? "bg-[var(--user-accent-subtle)] text-[var(--user-accent)]"
                          : "text-foreground",
                      )}
                    >
                      {getBlock(block.type)?.label ?? block.type}
                    </button>
                    <WidthStepper block={block} section={section} onResize={props.onGridChange} />
                    <IconButton label="Move block up" onClick={() => props.onMove(block.id, -1)}>
                      <ChevronUp className="h-3.5 w-3.5" />
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
        {tab === "feel" && (
          <div>
            <Choice
              label="Structure"
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
            <Choice
              label="Personality"
              value={props.config.personality}
              options={[
                ["modern", "Modern"],
                ["editorial", "Editorial"],
                ["technical", "Technical"],
              ]}
              onChange={(value) =>
                props.onCustomizeChange({ personality: value as GStudioConfig["personality"] })
              }
            />
            <Choice
              label="Density"
              value={props.config.density}
              options={[
                ["compact", "Compact"],
                ["comfortable", "Comfortable"],
                ["spacious", "Spacious"],
              ]}
              onChange={(value) =>
                props.onCustomizeChange({ density: value as GStudioConfig["density"] })
              }
            />
            <Button size="sm" variant="ghost" onClick={props.onFeel}>
              <Sparkles className="h-3 w-3" /> Choose a starting feel
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function WidthStepper({
  block,
  section,
  onResize,
}: {
  block: LayoutBlockInstance;
  section: LayoutSection;
  onResize: (sectionId: string, grid: LayoutGridItem[]) => void;
}) {
  const item = section.grid?.find((candidate) => candidate.i === block.id);
  if (!item) return null;
  return (
    <span className="flex shrink-0 items-center border border-border">
      <IconButton
        label="Narrower"
        disabled={item.w <= (item.minW ?? 2)}
        onClick={() =>
          onResize(
            section.id,
            (section.grid ?? []).map((candidate) =>
              candidate.i === block.id
                ? { ...candidate, w: Math.max(candidate.minW ?? 2, candidate.w - 1) }
                : candidate,
            ),
          )
        }
      >
        −
      </IconButton>
      <span className="w-5 text-center font-mono text-3xs">{item.w}</span>
      <IconButton
        label="Wider"
        disabled={item.w >= 12}
        onClick={() =>
          onResize(
            section.id,
            (section.grid ?? []).map((candidate) =>
              candidate.i === block.id
                ? { ...candidate, w: Math.min(12, candidate.w + 1) }
                : candidate,
            ),
          )
        }
      >
        +
      </IconButton>
    </span>
  );
}

function IconButton({
  label,
  children,
  active,
  className,
  ...rest
}: {
  label: string;
  children: ReactNode;
  active?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border text-muted-foreground",
        active
          ? "border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)] text-[var(--user-accent)]"
          : "border-transparent hover:border-border hover:bg-[var(--surface-sunken)] hover:text-foreground",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function sectionGrid(section: LayoutSection, blocks: LayoutBlockInstance[]): LayoutGridItem[] {
  const existing = new Map((section.grid ?? []).map((item) => [item.i, item]));
  return blocks.map((block, index) => {
    const current = existing.get(block.id);
    if (current) return current;
    const [w, h, minW, minH] = sizeFor(block.type);
    return {
      i: block.id,
      x: w >= 12 ? 0 : index % 2 === 0 ? 0 : 6,
      y: Math.floor(index / 2) * 5,
      w,
      h,
      minW,
      minH,
    };
  });
}

/** Default canvas size [w, h, minW, minH] for a block type. Exported so the
 * orchestrator (creation-studio) sizes new/duplicated blocks identically to
 * drag-in placeholders — one source of truth for block default heights. */
export function sizeFor(type: string): [number, number, number, number] {
  return BLOCK_SIZES[type] ?? [6, 4, 2, 2];
}

function studioSurfaceStyle(config: GStudioConfig): CSSProperties {
  // Use the canonical style computation from studio-config so all accent
  // variables (--user-accent-foreground, --user-accent-glow, etc.) are set
  // consistently — the previous local copy omitted several, breaking contrast
  // on buttons/labels when a custom accent colour was picked.
  const style = studioConfigToStyle(config) as CSSProperties & Record<string, string>;
  style["--studio-display-font"] = config.personality === "editorial" ? "Space Grotesk" : "Inter";
  style["--studio-label-font"] = config.personality === "technical" ? "JetBrains Mono" : "Inter";
  // Match the public page's font mapping (studioConfigToThemeTokens): an
  // editorial page flips --font-display/title to Space Grotesk and a technical
  // page to JetBrains Mono, so the canvas renders the face the published page
  // will.
  if (config.personality === "editorial") {
    style["--font-display"] = EDITORIAL_HEADING_FONT;
    style["--font-title"] = EDITORIAL_HEADING_FONT;
  } else if (config.personality === "technical") {
    style["--font-display"] = TECHNICAL_HEADING_FONT;
    style["--font-title"] = TECHNICAL_HEADING_FONT;
  }
  return style;
}

function findSection(layout: PageLayout, blockId: string) {
  return layout.sections.find((section) => section.blocks.some((block) => block.id === blockId));
}

/** Display label for a section: its custom title, else its layout type. */
function sectionLabel(section: LayoutSection): string {
  return section.title ?? section.layout.replace(/_/g, " ");
}
