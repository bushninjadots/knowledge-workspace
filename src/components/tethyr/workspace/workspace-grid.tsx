import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import {
  ArrowDown,
  ArrowUp,
  Check,
  EyeOff,
  GripVertical,
  MoreHorizontal,
  Pin,
  Plus,
  RotateCcw,
  Undo2,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useLayoutPreferences,
  type LayoutStorage,
  type PersistedLayout,
} from "@/hooks/use-layout-preferences";
import {
  GRID_COLS,
  ROW_HEIGHT,
  GRID_MARGIN,
  mergeLayout,
  stackDefault,
  type WorkspaceModule,
  type WorkspaceLayoutPreset,
} from "@/lib/workspace-layouts";

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS = { lg: 12, md: 12, sm: 8, xs: 4, xxs: 1 };

type Props = {
  page: "dashboard" | "profile";
  userId: string | null | undefined;
  modules: WorkspaceModule[];
  /** Render a module's body. Return null when the module has no content yet. */
  renderModule: (id: string) => React.ReactNode;
  /** Whether the current user is allowed to customize (own dashboard/profile). */
  canCustomize: boolean;
  /** Optional controlled customize state for page-owned edit controls. */
  customizing?: boolean;
  /** Start in customize mode immediately (for parent-triggered customize). */
  defaultCustomizing?: boolean;
  /** Extra class on the grid wrapper. */
  className?: string;
  /** Notify a parent that owns the page-level customize state. */
  onCustomizingChange?: (customizing: boolean) => void;
  /** Hide module titles when the rendered module already owns its header. */
  showModuleTitles?: boolean;
  /** Hide the built-in toolbar when the page renders its own toolbar. */
  showCustomizeBar?: boolean;
  /** Show quick, persistent creative arrangement choices in normal mode. */
  showPresetPicker?: boolean;
  /** Apply dashboard-only migrations for modules intentionally moved out of the grid. */
  migrateRetiredModules?: boolean;
  /** Optional public/profile-owned storage adapter instead of private layout prefs. */
  layoutStorage?: LayoutStorage;
  /** Optional starting arrangements for owners who want a guided setup. */
  layoutPresets?: WorkspaceLayoutPreset[];
  /** Human-readable name used by the customization guidance. */
  workspaceLabel?: string;
  /** Show direct links to the visible sections above the workspace. */
  showSectionNav?: boolean;
  /** Label for the quick-arrangement picker. Dashboard uses “Focus” so the
   *  preset buttons read as a focus choice; profile keeps “Creative
   *  arrangement” since it is about presentation. */
  presetPickerLabel?: string;
};

/**
 * Personal workspace grid. Normal mode is a clean, static layout. Customize
 * mode adds drag handles, resize handles, a per-module menu, a hidden-modules
 * tray, and a reset action — all persisted per user per page.
 */
export function WorkspaceGrid({
  page,
  userId,
  modules,
  renderModule,
  canCustomize,
  customizing: controlledCustomizing,
  defaultCustomizing,
  className,
  onCustomizingChange,
  showModuleTitles = true,
  showCustomizeBar = true,
  showPresetPicker = false,
  migrateRetiredModules = false,
  layoutStorage,
  layoutPresets = [],
  workspaceLabel = "workspace",
  showSectionNav = false,
  presetPickerLabel = "Creative arrangement",
}: Props) {
  const isMobile = useIsMobile();
  const privateStorage = useLayoutPreferences(page, userId, !layoutStorage);
  const storage = layoutStorage ?? privateStorage;
  const { data: saved, isLoading, save } = storage;
  const { width, containerRef } = useContainerWidth({ initialWidth: 1024 });

  const defaultItems = useMemo(() => stackDefault(modules), [modules]);

  const [internalCustomizing, setInternalCustomizing] = useState(defaultCustomizing ?? false);
  const customizing = controlledCustomizing ?? internalCustomizing;
  const setCustomizing = useCallback(
    (value: boolean) => {
      if (controlledCustomizing === undefined) setInternalCustomizing(value);
      onCustomizingChange?.(value);
    },
    [controlledCustomizing, onCustomizingChange],
  );
  const [items, setItems] = useState<LayoutItem[]>(
    () => mergeLayout(modules, null, [], [], defaultItems, migrateRetiredModules).items,
  );
  const [hidden, setHidden] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const undoStackRef = useRef<{ items: LayoutItem[]; hidden: string[]; pinned: string[] }[]>([]);
  const [, setUndoVersion] = useState(0);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef(items);
  const hiddenRef = useRef(hidden);
  const pinnedRef = useRef(pinned);
  const hydratedRef = useRef(false);
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);
  useEffect(() => {
    pinnedRef.current = pinned;
  }, [pinned]);

  // Load saved layout once the preferences arrive.
  useEffect(() => {
    if (isLoading) return;
    const merged = mergeLayout(
      modules,
      saved?.items,
      saved?.hidden,
      saved?.pinned,
      defaultItems,
      migrateRetiredModules,
    );

    setItems(packForPins(merged.items, merged.pinned));
    setHidden(merged.hidden);
    setPinned(merged.pinned);
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Debounced persistence on any layout/visibility change.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const payload: PersistedLayout = {
        v: 1,
        items: itemsRef.current,
        hidden: hiddenRef.current,
        pinned: pinnedRef.current,
      };
      setSaveState("saving");
      save(payload)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [items, hidden, pinned, save]);

  // Flush any pending save on unmount so a quick navigation doesn't drop the
  // user's arrangement (debounce timer + latest refs, no stale closures).
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      if (hydratedRef.current) {
        const payload: PersistedLayout = {
          v: 1,
          items: itemsRef.current,
          hidden: hiddenRef.current,
          pinned: pinnedRef.current,
        };
        saveRef.current(payload).catch(() => {});
      }
    };
  }, []);

  // Escape exits customize mode.
  useEffect(() => {
    if (!customizing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCustomizing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [customizing, setCustomizing]);

  // Evaluate module content once so visibility filtering and rendering agree.
  const contents = useMemo(() => {
    const map: Record<string, React.ReactNode> = {};
    for (const m of modules) map[m.id] = renderModule(m.id);
    return map;
  }, [modules, renderModule]);

  const visibleItems = useMemo(() => {
    const visible = items.filter((it) => !hidden.includes(it.i) && contents[it.i] != null);
    // Null modules must not preserve their old grid coordinates: otherwise a
    // data-empty dashboard leaves tall, blank rows between the live modules.
    const hasMissingModules =
      visible.length !== items.filter((it) => !hidden.includes(it.i)).length;
    const next = hasMissingModules ? packForPins(visible, pinned) : visible;
    // Mobile renders a simple vertical list, so reflect the saved grid order
    // explicitly instead of relying on react-grid-layout's desktop packing.
    return isMobile ? [...next].sort((a, b) => a.y - b.y || a.x - b.x) : next;
  }, [items, hidden, contents, pinned, isMobile]);

  const layouts = useMemo(() => ({ lg: visibleItems }), [visibleItems]);
  const sectionModules = useMemo(
    () =>
      visibleItems
        .map((item) => modules.find((module) => module.id === item.i))
        .filter((module): module is WorkspaceModule => !!module),
    [modules, visibleItems],
  );

  const handleLayoutChange = useCallback((layout: Layout, all: Partial<Record<string, Layout>>) => {
    // Keep the lg (12-col) layout as canonical — RGL derives smaller
    // breakpoints from it, so we never destroy the desktop arrangement.
    // Skip the state update entirely when nothing moved, so drag ticks
    // don't re-render the whole grid (spec §19).
    const lg = (all?.lg ?? layout) as LayoutItem[];
    setItems((prev) => {
      let changed = false;
      const next = prev.map((it) => {
        const found = lg.find((l) => l.i === it.i);
        if (!found) return it;
        if (found.x === it.x && found.y === it.y && found.w === it.w && found.h === it.h) {
          return it;
        }
        changed = true;
        return { ...it, x: found.x, y: found.y, w: found.w, h: found.h };
      });
      return changed ? next : prev;
    });
  }, []);

  const remember = () => {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-19),
      { items: itemsRef.current, hidden: hiddenRef.current, pinned: pinnedRef.current },
    ];
    setUndoVersion((v) => v + 1);
  };

  const undo = () => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    setItems(previous.items);
    setHidden(previous.hidden);
    setPinned(previous.pinned);
    setUndoVersion((v) => v + 1);
  };

  const applyPreset = (preset: WorkspaceLayoutPreset) => {
    remember();
    const merged = mergeLayout(
      modules,
      preset.items,
      preset.hidden,
      preset.pinned,
      defaultItems,
      migrateRetiredModules,
    );
    setItems(packForPins(merged.items, merged.pinned));
    setHidden(merged.hidden);
    setPinned(merged.pinned);
  };

  const togglePin = (id: string) => {
    remember();
    const nextPinned = pinned.includes(id) ? pinned.filter((p) => p !== id) : [...pinned, id];
    setPinned(nextPinned);
    setItems((prev) => packForPins(prev, nextPinned));
  };

  const hideModule = (id: string) => {
    remember();
    setHidden((prev) => [...prev, id]);
  };

  const restoreModule = (id: string) => {
    remember();
    setHidden((prev) => prev.filter((h) => h !== id));
  };

  const resetSize = (id: string) => {
    remember();
    const def = modules.find((m) => m.id === id);
    if (!def) return;
    setItems((prev) =>
      prev.map((it) =>
        it.i === id
          ? { ...it, w: def.defaultW, h: def.defaultH, x: Math.min(it.x, GRID_COLS - def.defaultW) }
          : it,
      ),
    );
  };

  const resetLayout = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    setConfirmReset(false);
    remember();
    const merged = mergeLayout(modules, null, [], [], defaultItems);
    setItems(merged.items);
    setHidden(merged.hidden);
    setPinned(merged.pinned);
    setCustomizing(false);
  };

  // Keyboard moving: focus a drag handle and use arrow keys.
  const moveItem = (id: string, dx: number, dy: number) => {
    if (isMobile && dx === 0 && Math.abs(dy) === 1) {
      const currentIndex = visibleItems.findIndex((item) => item.i === id);
      const targetIndex = currentIndex + dy;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= visibleItems.length) return;

      const current = visibleItems[currentIndex];
      const target = visibleItems[targetIndex];
      remember();
      setItems((prev) =>
        prev.map((item) => {
          if (item.i === current.i) return { ...item, x: target.x, y: target.y };
          if (item.i === target.i) return { ...item, x: current.x, y: current.y };
          return item;
        }),
      );
      return;
    }

    remember();
    setItems((prev) =>
      prev.map((it) => {
        if (it.i !== id) return it;
        const nx = Math.max(0, Math.min(GRID_COLS - it.w, it.x + dx));
        const ny = Math.max(0, it.y + dy);
        return { ...it, x: nx, y: ny };
      }),
    );
  };

  const dragEnabled = customizing && canCustomize && !isMobile;

  const renderGridItem = (it: LayoutItem) => (
    <div
      id={showSectionNav ? `workspace-section-${it.i}` : undefined}
      key={it.i}
      className={`content-safe h-full ${showSectionNav ? "scroll-mt-20" : ""} ${customizing ? "ws-editing" : ""}`}
    >
      <ModuleShell
        module={modules.find((m) => m.id === it.i)}
        customizing={customizing}
        pinned={pinned.includes(it.i)}
        onPin={canCustomize ? () => togglePin(it.i) : undefined}
        onHide={canCustomize ? () => hideModule(it.i) : undefined}
        onResetSize={canCustomize ? () => resetSize(it.i) : undefined}
        onMove={(dx, dy) => moveItem(it.i, dx, dy)}
        showTitle={showModuleTitles}
      >
        {contents[it.i]}
      </ModuleShell>
    </div>
  );

  return (
    <div className={className}>
      {/* ── Customize bar ── */}
      {canCustomize && showCustomizeBar && (
        <div className="mb-5 border-y border-border/60 py-3">
          {customizing ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="section-label">Customize layout</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    Arrange your {workspaceLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Choose a starting arrangement, then move, resize, pin, or hide sections.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {saveState === "saving" && (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                      role="status"
                    >
                      <LoaderCircle className="h-3 w-3 animate-spin" /> Saving
                    </span>
                  )}
                  {saveState === "saved" && (
                    <span className="text-xs text-primary" role="status">
                      Saved
                    </span>
                  )}
                  {saveState === "error" && (
                    <span className="text-xs text-destructive" role="status">
                      Couldn’t save
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={undo}
                    disabled={undoStackRef.current.length === 0}
                    aria-label="Undo layout change"
                  >
                    <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                    Undo
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={confirmReset ? "text-destructive" : "text-muted-foreground"}
                    onClick={resetLayout}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    {confirmReset ? "Confirm reset?" : "Reset"}
                  </Button>
                  <Button size="sm" onClick={() => setCustomizing(false)}>
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Done
                  </Button>
                </div>
              </div>
              {layoutPresets.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Start with</span>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Layout presets">
                    {layoutPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.description}
                        onClick={() => applyPreset(preset)}
                        className="rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="section-label">Make it yours</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose which {workspaceLabel} sections people see first.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-muted-foreground"
                  onClick={() => setCustomizing(true)}
                >
                  <GripVertical className="mr-1.5 h-3.5 w-3.5" />
                  Customize
                </Button>
              </div>
              {showPresetPicker && layoutPresets.length > 0 && (
                <PresetPicker
                  layoutPresets={layoutPresets}
                  onSelect={applyPreset}
                  label={presetPickerLabel}
                  helper={
                    presetPickerLabel === "Focus"
                      ? "Pick what your dashboard leads with — you can still rearrange anytime."
                      : undefined
                  }
                />
              )}
            </div>
          )}
        </div>
      )}

      {canCustomize &&
        !showCustomizeBar &&
        !customizing &&
        showPresetPicker &&
        layoutPresets.length > 0 && (
          <div className="mb-5 border-y border-border/60 py-3">
            <PresetPicker
              layoutPresets={layoutPresets}
              onSelect={applyPreset}
              onArrange={() => setCustomizing(true)}
              label={presetPickerLabel}
              helper={
                presetPickerLabel === "Focus"
                  ? "Pick what your dashboard leads with — you can still rearrange anytime."
                  : undefined
              }
            />
          </div>
        )}

      {showSectionNav && sectionModules.length > 1 && (
        <nav
          aria-label={`${workspaceLabel} sections`}
          className="mb-5 border-b border-border/60 pb-3"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="section-label">Jump to</span>
            {sectionModules.map((module) => (
              <a
                key={module.id}
                href={`#workspace-section-${module.id}`}
                className="text-xs text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
              >
                {module.title}
              </a>
            ))}
          </div>
        </nav>
      )}

      {/* ── Grid ── */}
      <div ref={containerRef}>
        {isMobile ? (
          <div className="space-y-4">{visibleItems.map(renderGridItem)}</div>
        ) : (
          width > 0 && (
            <ResponsiveGridLayout
              className="ws-grid"
              width={width}
              layouts={layouts}
              breakpoints={BREAKPOINTS}
              cols={COLS}
              rowHeight={ROW_HEIGHT}
              margin={GRID_MARGIN}
              containerPadding={[0, 0]}
              dragConfig={{
                enabled: dragEnabled,
                bounded: true,
                handle: ".ws-drag-handle",
              }}
              resizeConfig={{
                enabled: dragEnabled,
                handles: ["se", "e", "s"],
              }}
              onLayoutChange={handleLayoutChange}
            >
              {visibleItems.map(renderGridItem)}
            </ResponsiveGridLayout>
          )
        )}
      </div>

      {/* ── Hidden modules tray (customize mode) ── */}
      {customizing && canCustomize && hidden.length > 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-border/70 bg-surface/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Hidden modules
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {hidden.map((id) => {
              const def = modules.find((m) => m.id === id);
              if (!def) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => restoreModule(id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface px-3 py-1.5 text-xs text-muted-foreground transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                  {def.title}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Module shell — chrome shown only in customize mode; body is always the
 * module's own content (which carries its own card styling).
 * ------------------------------------------------------------------------- */

function PresetPicker({
  layoutPresets,
  onSelect,
  onArrange,
  label = "Creative arrangement",
  helper,
}: {
  layoutPresets: WorkspaceLayoutPreset[];
  onSelect: (preset: WorkspaceLayoutPreset) => void;
  onArrange?: () => void;
  label?: string;
  helper?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={label}>
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {helper && <span className="text-xs text-muted-foreground">{helper}</span>}
      {layoutPresets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          title={preset.description}
          onClick={() => onSelect(preset)}
          className="rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:text-foreground"
        >
          {preset.label}
        </button>
      ))}
      {onArrange && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto text-xs text-muted-foreground"
          onClick={onArrange}
        >
          Arrange sections
        </Button>
      )}
    </div>
  );
}

function ModuleShell({
  module,
  customizing,
  pinned,
  onPin,
  onHide,
  onResetSize,
  onMove,
  showTitle,
  children,
}: {
  module: WorkspaceModule | undefined;
  customizing: boolean;
  pinned: boolean;
  onPin?: () => void;
  onHide?: () => void;
  onResetSize?: () => void;
  onMove?: (dx: number, dy: number) => void;
  showTitle: boolean;
  children: React.ReactNode;
}) {
  if (!customizing) {
    return (
      <div className="content-safe h-full min-w-0 overflow-x-hidden overflow-y-auto scrollbar-none">
        {children}
      </div>
    );
  }
  const Icon = module?.icon;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--user-accent-border,var(--border-strong))]/60 bg-surface/70">
      <div className="flex items-center gap-2 border-b border-border/60 bg-surface-elevated/60 px-3 py-2">
        <span
          className="ws-drag-handle flex shrink-0 cursor-grab items-center rounded-md p-0.5 text-muted-foreground/70 transition hover:bg-surface hover:text-foreground active:cursor-grabbing"
          title="Drag to move"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        {showTitle && Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        {showTitle && (
          <span className="truncate text-xs font-semibold">{module?.title ?? "Module"}</span>
        )}
        {showTitle && pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
        <div className="ml-auto flex items-center gap-0.5">
          {onMove && (
            <>
              <button
                type="button"
                aria-label={`Move ${module?.title ?? "module"} up`}
                title="Move up"
                className="rounded-md p-1 text-muted-foreground/70 transition hover:bg-surface hover:text-foreground"
                onClick={() => onMove(0, -1)}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Move ${module?.title ?? "module"} down`}
                title="Move down"
                className="rounded-md p-1 text-muted-foreground/70 transition hover:bg-surface hover:text-foreground"
                onClick={() => onMove(0, 1)}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Move module"
                title={`Move ${module?.title ?? "module"} with arrow keys`}
                className="ws-drag-handle rounded-md p-1 text-muted-foreground/70 transition hover:bg-surface hover:text-foreground"
                onKeyDown={(e) => {
                  // Arrow keys normally scroll the page — prevent that so the
                  // module moves cleanly without the viewport jumping.
                  if (
                    e.key === "ArrowLeft" ||
                    e.key === "ArrowRight" ||
                    e.key === "ArrowUp" ||
                    e.key === "ArrowDown"
                  ) {
                    e.preventDefault();
                  }
                  if (e.key === "ArrowLeft") onMove(-1, 0);
                  else if (e.key === "ArrowRight") onMove(1, 0);
                  else if (e.key === "ArrowUp") onMove(0, -1);
                  else if (e.key === "ArrowDown") onMove(0, 1);
                }}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {onPin && onHide && onResetSize && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Module options"
                  className="rounded-md p-1 text-muted-foreground/70 transition hover:bg-surface hover:text-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[10rem]">
                <DropdownMenuItem onClick={onPin}>
                  <Pin className="mr-2 h-3.5 w-3.5" />
                  {pinned ? "Unpin" : "Pin to top"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onResetSize}>
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  Reset size
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onHide}>
                  <EyeOff className="mr-2 h-3.5 w-3.5" />
                  Hide
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <div className="content-safe min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto scrollbar-none">
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Pinning helper — pinned modules rise to the top, then everything packs
 * into clean, aligned rows.
 * ------------------------------------------------------------------------- */

function packForPins(items: LayoutItem[], pinned: string[]): LayoutItem[] {
  const pinnedSet = new Set(pinned);
  const sorted = [...items].sort((a, b) => {
    const ap = pinnedSet.has(a.i) ? pinned.indexOf(a.i) : Number.MAX_SAFE_INTEGER;
    const bp = pinnedSet.has(b.i) ? pinned.indexOf(b.i) : Number.MAX_SAFE_INTEGER;
    if (ap !== bp) return ap - bp;
    return a.y - b.y || a.x - b.x;
  });
  const result: LayoutItem[] = [];
  let y = 0;
  let x = 0;
  let rowH = 0;
  for (const it of sorted) {
    const w = Math.min(it.w, GRID_COLS);
    if (x + w > GRID_COLS) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    result.push({ ...it, x, y, w });
    x += w;
    rowH = Math.max(rowH, it.h);
  }
  return result;
}
