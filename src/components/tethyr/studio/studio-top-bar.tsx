// Studio editor top bar: status, mode, history, publish and the actions menu.
// Split out of g-studio-surface.tsx.
import { useEffect, useRef } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  Command,
  History,
  Keyboard,
  LayoutTemplate,
  Monitor,
  MoreHorizontal,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Sliders,
  Smartphone,
  Save,
  Tablet,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PageVersion } from "@/lib/page-blocks";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { IconButton } from "./studio-controls";
import type { GStudioSurfaceProps, GStudioMode, GStudioDevice } from "./g-studio-surface";

export function GStudioTopBar({
  mode,
  device,
  compact,
  dirty,
  saving,
  published,
  hasUnpublishedChanges,
  unpublishedSummary,
  publishedVersion,
  lastSavedAt,
  canUndo,
  canRedo,
  historyOpen,
  onHistory,
  onCommands,
  onHistoryClosed,
  versions,
  onRollback,
  onModeChange,
  onDeviceChange,
  onUndo,
  onRedo,
  snapToBlocks,
  onSnapToBlocksChange,
  showGrid,
  onShowGridChange,
  onExit,
  onCustomize,
  onPalette,
  onSave,
  onPublish,
  customizeOpen,
  paletteOpen,
  profile,
  onTemplates,
  onSaveAsTemplate,
  onReset,
  onShortcuts,
}: {
  mode: GStudioMode;
  device: GStudioDevice;
  compact: boolean;
  dirty: boolean;
  saving: boolean;
  published: boolean;
  hasUnpublishedChanges: boolean;
  unpublishedSummary: string[];
  publishedVersion: number | null;
  lastSavedAt?: number | null;
  canUndo: boolean;
  canRedo: boolean;
  historyOpen: boolean;
  onHistory: () => void;
  /** Open the Studio command palette (Ctrl/⌘+J). */
  onCommands?: () => void;
  onHistoryClosed: () => void;
  onModeChange: (mode: GStudioMode) => void;
  onDeviceChange: (device: GStudioDevice) => void;
  onUndo: () => void;
  onRedo: () => void;
  snapToBlocks: boolean;
  onSnapToBlocksChange: (enabled: boolean) => void;
  showGrid: boolean;
  onShowGridChange: (enabled: boolean) => void;
  onExit?: () => void;
  onCustomize: () => void;
  onPalette: () => void;
  onSave: () => void;
  onPublish: () => void;
  customizeOpen: boolean;
  paletteOpen: boolean;
  profile: GStudioSurfaceProps["profile"];
  onTemplates?: () => void;
  onSaveAsTemplate?: () => void;
  onReset: () => void;
  onShortcuts: () => void;
  versions: PageVersion[];
  onRollback: (version: number) => void;
}) {
  // Autosave runs a second after each edit, so the status is the save
  // indicator; "Save now" lives in the menu for people who want to force it.
  // Phone labels stay at seven characters or fewer: the top bar's buttons
  // leave the chip about that much room, and longer words truncated.
  const status = saving
    ? "Saving…"
    : dirty
      ? compact
        ? "Unsaved"
        : "Unsaved changes"
      : hasUnpublishedChanges
        ? published
          ? compact
            ? "Pending"
            : "Unpublished changes"
          : compact
            ? "Draft"
            : "Draft · not published"
        : published
          ? compact
            ? `Live v${publishedVersion ?? 1}`
            : `Live · v${publishedVersion ?? 1}`
          : "Draft";
  const statusDetail = hasUnpublishedChanges
    ? `Not live yet: ${unpublishedSummary.join(", ").toLowerCase() || "changes"}.`
    : published
      ? "Visitors see exactly this."
      : undefined;
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[var(--surface-elevated)]">
      <div className="flex min-h-11 items-center gap-2 px-3 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onExit && (
            <IconButton label="Back to your Studio" onClick={onExit}>
              <ArrowLeft className="h-3.5 w-3.5" />
            </IconButton>
          )}
          <span
            role="status"
            title={statusDetail}
            className={cn(
              // Amber is too light to read as text, so caution states keep it
              // for the border and fill and set the label in the body colour.
              "min-w-0 truncate whitespace-nowrap border px-1.5 py-0.5 font-mono text-2xs",
              saving || dirty || hasUnpublishedChanges
                ? "border-caution bg-caution/10 text-foreground"
                : "border-trust text-trust",
            )}
          >
            {status}
            {statusDetail && <span className="sr-only"> — {statusDetail}</span>}
          </span>
          {lastSavedAt && !saving && !dirty && (
            <span className="hidden whitespace-nowrap font-mono text-2xs text-muted-foreground xl:inline">
              saved {timeAgo(new Date(lastSavedAt).toISOString())}
            </span>
          )}
        </div>
        <div
          className="flex shrink-0 rounded-sm border border-border bg-[var(--surface-sunken)] p-0.5"
          role="radiogroup"
          aria-label="Studio mode"
        >
          {(
            [
              ["edit", "Edit"],
              ["preview", "Preview"],
            ] as Array<[GStudioMode, string]>
          ).map(([item, label]) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={mode === item}
              aria-label={label}
              title={item === "preview" ? "See your page as visitors will" : "Edit your page"}
              onClick={() => onModeChange(item)}
              className={cn(
                "flex h-7 pointer-coarse:h-10 items-center gap-1.5 rounded-sm px-2 text-xs",
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
        <div className="flex flex-1 shrink-0 items-center justify-end gap-1">
          {mode === "edit" && (
            <>
              <IconButton label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
                <Undo2 className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo}>
                <Redo2 className="h-3.5 w-3.5" />
              </IconButton>
              {!compact && (
                <>
                  {onTemplates && (
                    <Button variant="ghost" size="sm" onClick={onTemplates}>
                      <LayoutTemplate className="h-3 w-3" /> Layouts
                    </Button>
                  )}
                  <Button
                    variant={customizeOpen ? "default" : "ghost"}
                    size="sm"
                    aria-pressed={customizeOpen}
                    onClick={onCustomize}
                  >
                    <Sliders className="h-3 w-3" /> Style
                  </Button>
                  <Button
                    variant={paletteOpen ? "default" : "secondary"}
                    size="sm"
                    aria-pressed={paletteOpen}
                    onClick={onPalette}
                  >
                    <Plus className="h-3 w-3" /> Add block
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
          <Button
            variant={hasUnpublishedChanges ? "default" : "outline"}
            size="sm"
            disabled={!hasUnpublishedChanges}
            onClick={onPublish}
            title={hasUnpublishedChanges ? "Publish your changes" : "Nothing new to publish"}
            aria-label="Publish changes"
          >
            <Upload className="h-3 w-3" />
            {!compact && "Publish"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="More Studio actions" data-version-history-trigger>
                <MoreHorizontal className="h-3.5 w-3.5" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="studio-editor-chrome w-56">
              <DropdownMenuItem disabled={!dirty || saving} onSelect={onSave}>
                <Save className="h-3.5 w-3.5" /> Save now
                <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
              </DropdownMenuItem>
              {compact && onTemplates && (
                <DropdownMenuItem onSelect={onTemplates}>
                  <LayoutTemplate className="h-3.5 w-3.5" /> Layouts
                </DropdownMenuItem>
              )}
              {onCommands && (
                <DropdownMenuItem onSelect={onCommands}>
                  <Command className="h-3.5 w-3.5" /> All commands
                  <DropdownMenuShortcut>Ctrl+J</DropdownMenuShortcut>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={onHistory}>
                <History className="h-3.5 w-3.5" /> Version history
              </DropdownMenuItem>
              {profile?.handle && (
                <DropdownMenuItem asChild>
                  <a href={`/u/${profile.handle}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Open public page
                  </a>
                </DropdownMenuItem>
              )}
              {!compact && mode === "edit" && (
                <DropdownMenuCheckboxItem
                  checked={snapToBlocks}
                  onCheckedChange={(checked) => onSnapToBlocksChange(checked === true)}
                >
                  Snap to block edges
                </DropdownMenuCheckboxItem>
              )}
              {!compact && mode === "edit" && (
                <DropdownMenuCheckboxItem
                  checked={showGrid}
                  onCheckedChange={(checked) => onShowGridChange(checked === true)}
                >
                  Show layout grid
                </DropdownMenuCheckboxItem>
              )}
              {!compact && (
                <DropdownMenuItem onSelect={onShortcuts}>
                  <Keyboard className="h-3.5 w-3.5" /> Keyboard shortcuts
                  <DropdownMenuShortcut>?</DropdownMenuShortcut>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {onSaveAsTemplate && (
                <DropdownMenuItem onSelect={onSaveAsTemplate}>
                  <LayoutTemplate className="h-3.5 w-3.5" /> Share as a template…
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={onReset}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset to the default Studio…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
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
