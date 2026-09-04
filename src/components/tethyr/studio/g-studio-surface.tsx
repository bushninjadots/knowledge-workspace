import { forwardRef, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  GripHorizontal,
  GripVertical,
  History,
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
import { Responsive as LegacyResponsive, WidthProvider } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import { BlockRenderer } from "@/components/tethyr/page/block-renderer";
import { Button } from "@/components/ui/button";
import { getAllBlocks, getBlock } from "@/lib/block-registry";
import type {
  BlockCategory,
  BlockConfig,
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
  structureMaxWidth,
  studioConfigToStyle,
  type StudioConfig,
} from "@/lib/studio-config";
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
  onAddSection: () => void;
  onMoveToSection: (id: string, sectionId: string) => void;
  onAdd: (type: string, sectionId?: string, placement?: LayoutGridItem) => void;
  onDragTypeChange: (type: string | null) => void;
  onPaletteTargetChange: (id: string) => void;
  onCustomizeChange: (patch: Partial<GStudioConfig>) => void;
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
}

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS = { lg: 12, md: 12, sm: 8, xs: 4, xxs: 1 };
const PERSISTED_BREAKPOINTS = new Set(["lg", "md"]);
const ResponsiveGrid = WidthProvider(LegacyResponsive);
const DEVICE_WIDTHS: Record<GStudioDevice, number | undefined> = {
  desktop: undefined,
  tablet: 834,
  mobile: 390,
};
const BLOCK_SIZES: Record<string, [number, number, number, number]> = {
  "profile-header": [12, 4, 6, 3],
  "profile-bio": [7, 3, 3, 2],
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

export function GStudioSurface(props: GStudioSurfaceProps) {
  // Customization is the whole point of this view, so the panel starts open on
  // desktop instead of hiding behind a toggle the owner has to discover.
  const [customizeOpen, setCustomizeOpen] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024,
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"left" | "right" | null>(null);
  const [starterOpen, setStarterOpen] = useState(false);
  const compact = typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
  const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const directManipulation = !compact && !touch;
  const editing = props.mode === "edit";
  const deviceWidth = props.mode === "preview" ? DEVICE_WIDTHS[props.device] : undefined;
  const maxWidth = structureMaxWidth(props.config);
  const sections = props.layout.sections;
  const surfaceStyle = studioSurfaceStyle(props.config);

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
        canUndo={props.canUndo}
        canRedo={props.canRedo}
        historyOpen={historyOpen}
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
        <main className="min-w-0 flex-1 overflow-y-auto bg-noise" aria-label="Studio canvas">
          <div className="mx-auto w-full" style={{ maxWidth: deviceWidth ?? maxWidth }}>
            <GStudioCanvas
              {...props}
              sections={sections}
              editing={editing}
              directManipulation={directManipulation}
              frameWidth={deviceWidth}
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
  canUndo,
  canRedo,
  historyOpen,
  onHistory,
  onModeChange,
  onDeviceChange,
  onUndo,
  onRedo,
  onFeel,
  onExit,
  onCustomize,
  onPalette,
  onSave,
  onPublish,
  customizeOpen,
  paletteOpen,
}: {
  mode: GStudioMode;
  device: GStudioDevice;
  compact: boolean;
  dirty: boolean;
  saving: boolean;
  published: boolean;
  hasUnpublishedChanges: boolean;
  publishedVersion: number | null;
  canUndo: boolean;
  canRedo: boolean;
  historyOpen: boolean;
  onHistory: () => void;
  onModeChange: (mode: GStudioMode) => void;
  onDeviceChange: (device: GStudioDevice) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFeel: () => void;
  onExit?: () => void;
  onCustomize: () => void;
  onPalette: () => void;
  onSave: () => void;
  onPublish: () => void;
  customizeOpen: boolean;
  paletteOpen: boolean;
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
        </div>
      </div>
      {mode === "edit" && (
        <div className="flex min-h-5 items-center gap-2 border-t border-border bg-[var(--surface)] px-3 py-0.5">
          <span className="t-label">Editing</span>
          <span className="truncate text-2xs text-muted-foreground-subtle">
            Drag the grip to move · pull an edge to resize · click a block for its actions
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
  onRequestPalette,
  ...props
}: GStudioSurfaceProps & {
  sections: LayoutSection[];
  editing: boolean;
  directManipulation: boolean;
  frameWidth?: number;
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
            {...props}
            onRequestPalette={onRequestPalette}
          />
        ))}
        {editing && (
          <button
            type="button"
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

function GSectionBand({
  section,
  index,
  total,
  editing,
  directManipulation,
  onRequestPalette,
  ...props
}: GStudioSurfaceProps & {
  section: LayoutSection;
  index: number;
  total: number;
  editing: boolean;
  directManipulation: boolean;
  onRequestPalette: (id: string) => void;
}) {
  const breakpointRef = useRef("lg");
  const [renaming, setRenaming] = useState(false);
  const sectionTitle = sectionLabel(section);
  const blocks = useMemo(
    () => [...section.blocks].sort((a, b) => a.position - b.position),
    [section.blocks],
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
  if (!editing && (section.visible === false || !blocks.some((block) => block.visible !== false)))
    return null;
  return (
    <section
      aria-label={section.layout}
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
      ) : (
        <ResponsiveGrid
          className="layout"
          layouts={{ lg: grid }}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          rowHeight={rowHeight}
          margin={[margin, margin]}
          containerPadding={[0, 0]}
          isDraggable={editing && directManipulation}
          isResizable={editing && directManipulation}
          isDroppable={editing && directManipulation && Boolean(props.dragType)}
          droppingItem={dropItem}
          draggableHandle=".magic-drag-handle"
          draggableCancel="input,textarea,a,[data-no-drag]"
          resizeHandles={["se", "e", "s"]}
          resizeHandle={ResizeHandle}
          useCSSTransforms
          compactType={null}
          onBreakpointChange={(breakpoint) => {
            breakpointRef.current = breakpoint;
          }}
          onDragStart={() => props.onGridInteractionStart()}
          onResizeStart={() => props.onGridInteractionStart()}
          onDragStop={() => props.onGridInteractionEnd()}
          onResizeStop={() => props.onGridInteractionEnd()}
          onDrop={(_layout, item, event) => {
            const type = props.dragType ?? (event as DragEvent).dataTransfer?.getData("text/plain");
            if (type && item) {
              props.onAdd(type, section.id, item);
              props.onDragTypeChange(null);
            }
          }}
          onLayoutChange={(next, layouts) => {
            if (!editing || !PERSISTED_BREAKPOINTS.has(breakpointRef.current)) return;
            const canonical = layouts[breakpointRef.current] ?? layouts.lg ?? next;
            props.onGridChange(
              section.id,
              canonical.map((item) => ({
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
              {...props}
            />
          ))}
        </ResponsiveGrid>
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
  GStudioSurfaceProps & {
    block: LayoutBlockInstance;
    editing: boolean;
    selected: boolean;
    style?: CSSProperties;
    className?: string;
    children?: ReactNode;
  }
>(function GBlockFrame({ block, editing, selected, style, className, children, ...props }, ref) {
  const def = getBlock(block.type);
  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        className,
        "group/frame relative h-full min-h-0",
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
        className="relative h-full min-h-0 overflow-y-auto overflow-x-hidden rounded-[inherit] bg-[var(--surface)]"
        style={{ borderRadius: "var(--studio-radius)" }}
      >
        <div className="flex min-h-full [&>*]:min-w-0 [&>*]:flex-1">
          <BlockRenderer
            type={block.type}
            config={block.config}
            context={{
              ownerId: props.userId,
              ownerType: "profile",
              pageId: `profile:${props.userId}`,
              blockId: block.id,
              isEditing: editing,
              isOwner: true,
              data: props.profile ? { profile: props.profile } : undefined,
            }}
            onChange={(config) => props.onUpdateBlockConfig(block.id, config)}
          />
        </div>
      </div>
      {editing && (
        <>
          <button
            type="button"
            aria-label={`Move ${def?.label ?? block.type}`}
            className="magic-drag-handle absolute left-1 top-1 z-20 flex h-6 w-5 cursor-grab items-center justify-center border border-border bg-[var(--surface-elevated)] text-muted-foreground opacity-0 transition-opacity group-hover/frame:opacity-100 focus-visible:opacity-100"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
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
          "pointer-events-none absolute inset-0 z-10 rounded-[inherit] ring-1 ring-inset",
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

function GBlockPalette(props: GStudioSurfaceProps & { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const sections = props.layout.sections;
  const selectedSectionId = props.selectedBlockId
    ? findSection(props.layout, props.selectedBlockId)?.id
    : undefined;
  const target = props.paletteTarget ?? selectedSectionId ?? sections[0]?.id;
  const blocks = useMemo(
    () =>
      getAllBlocks().filter((block) =>
        `${block.label} ${block.description}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
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
        {blocks.map((def) => (
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
            className="group/item mb-1 flex w-full cursor-grab items-start gap-2 border border-border bg-[var(--surface)] px-2 py-1.5 text-left hover:border-[var(--user-accent-border)]"
          >
            <GripHorizontal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground-subtle" />
            <span className="min-w-0">
              <span className="block text-xs font-medium text-foreground">{def.label}</span>
              <span className="block text-2xs text-muted-foreground-subtle">{def.description}</span>
            </span>
          </button>
        ))}
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
        {(def.fields ?? []).map((field) => (
          <label key={field.key} className="block text-xs text-muted-foreground">
            {field.label}
            {field.type === "toggle" ? (
              <input
                className="ml-2"
                type="checkbox"
                checked={Boolean(block.config[field.key] ?? def.defaults[field.key])}
                onChange={(event) =>
                  props.onUpdateBlockConfig(block.id, {
                    ...block.config,
                    [field.key]: event.target.checked,
                  })
                }
              />
            ) : field.type === "select" ? (
              <select
                className="mt-1 w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs"
                value={String(block.config[field.key] ?? def.defaults[field.key] ?? "")}
                onChange={(event) =>
                  props.onUpdateBlockConfig(block.id, {
                    ...block.config,
                    [field.key]: event.target.value,
                  })
                }
              >
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                className="mt-1 min-h-16 w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs"
                value={String(block.config[field.key] ?? def.defaults[field.key] ?? "")}
                onChange={(event) =>
                  props.onUpdateBlockConfig(block.id, {
                    ...block.config,
                    [field.key]: event.target.value,
                  })
                }
              />
            )}
          </label>
        ))}
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

function GCustomizePanel({
  config,
  starterId,
  layout,
  compact,
  onChange,
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
        <Choice
          label="Corners"
          value={config.radius}
          options={[
            ["sharp", "Sharp"],
            ["soft", "Soft"],
          ]}
          onChange={(value) => onChange({ radius: value as GStudioConfig["radius"] })}
        />
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
              const defs = getAllBlocks().filter((def) => def.category === category);
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
  return style;
}

function findSection(layout: PageLayout, blockId: string) {
  return layout.sections.find((section) => section.blocks.some((block) => block.id === blockId));
}

/** Display label for a section: its custom title, else its layout type. */
function sectionLabel(section: LayoutSection): string {
  return section.title ?? section.layout.replace(/_/g, " ");
}
