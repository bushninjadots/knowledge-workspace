// ── Studio canvas: one block ─────────────────────────────────────────────────────
// The frame around each block on the editing canvas: selection, hover tools
// (move, duplicate, hide, lock, remove), and the event plumbing react-grid-layout
// needs to drag it. Rendered by GSectionBand (g-section-band.tsx).

// ── Studio canvas: one area ──────────────────────────────────────────────────────
// An area (section) on the editing canvas: its header controls, the
// react-grid-layout grid with drag/resize, the snap and alignment overlay, and
// each block's frame. Split out of g-studio-surface.tsx, which owns the editor
// shell (top bar, rail, preview) and composes these bands.

import { forwardRef, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Trash2,
  Lock,
  LockOpen,
  Layers,
  Monitor,
  Smartphone,
} from "lucide-react";
import { BlockRenderer } from "@/components/tethyr/page/block-renderer";
import { getBlock } from "@/lib/block-registry";
import type { BlockContext, LayoutBlockInstance } from "@/lib/page-blocks";
import { cn } from "@/lib/utils";
import { blockFrameStyle } from "@/lib/studio-config";
import { IconButton } from "./studio-controls";
import type { GStudioSurfaceProps } from "./g-studio-surface";

/** RGL attaches its mouse listeners to each grid item's DOM node. Blocks that
 *  do not forward `onMouseDown`/`onMouseUp` silently disable drag; keep the
 *  event props flowing from the injected handlers down to the host element. */
type ForwardedGridEvents = {
  onMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onTouchEnd?: (event: React.TouchEvent<HTMLDivElement>) => void;
};

export const GBlockFrame = forwardRef<
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
          props.onSelect(block.id, { toggle: event.shiftKey });
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
        // Only clicks on the block itself — not in a dialog it opened.
        if (!editing || !event.currentTarget.contains(event.target as Node)) return;
        const link = (event.target as Element).closest?.("a[href]");
        // Shift-click adds the block to the selection, so it never follows.
        if (!link || event.metaKey || event.ctrlKey) return;
        event.preventDefault();
      }}
      onClick={(event) => {
        if (!editing || !event.currentTarget.contains(event.target as Node)) return;
        event.stopPropagation();
        props.onSelect(block.id, { toggle: event.shiftKey });
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
      {editing && block.locked && (
        <span
          title="Locked in place"
          className="absolute left-1.5 top-1.5 z-20 inline-flex h-5 w-5 items-center justify-center rounded-sm border border-border bg-[var(--surface-elevated)] text-muted-foreground shadow-sm"
        >
          <Lock className="h-3 w-3" aria-hidden />
          <span className="sr-only">Locked</span>
        </span>
      )}
      {editing && ((block.showOn && block.showOn !== "all") || block.overlap === "up") && (
        <span className="absolute right-1.5 top-1.5 z-20 flex items-center gap-1">
          {block.overlap === "up" && (
            // Drawn for real in Preview and on the page; the canvas keeps a
            // plain grid so every block stays easy to grab.
            <span
              title="Overlaps the piece above in Preview and on your page"
              className="inline-flex items-center gap-1 rounded-sm border border-border bg-[var(--surface-elevated)] px-1.5 py-0.5 text-2xs text-muted-foreground shadow-sm"
            >
              <Layers className="h-3 w-3" aria-hidden />
              Overlaps above
            </span>
          )}
          {block.showOn && block.showOn !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-[var(--surface-elevated)] px-1.5 py-0.5 text-2xs text-muted-foreground shadow-sm">
              {block.showOn === "desktop" ? (
                <Monitor className="h-3 w-3" aria-hidden />
              ) : (
                <Smartphone className="h-3 w-3" aria-hidden />
              )}
              {block.showOn === "desktop" ? "Desktop only" : "Phone only"}
            </span>
          )}
        </span>
      )}
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
              "studio-drag-handle pointer-events-none absolute -left-2.5 -top-2.5 z-20 flex h-6 w-6 items-center justify-center rounded-sm border border-[var(--user-accent-border)] bg-[var(--surface-elevated)] text-[var(--user-accent-text)] shadow-sm transition-opacity group-hover/frame:opacity-100 group-focus-visible/frame:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:-top-6 pointer-coarse:h-9 pointer-coarse:w-9 pointer-coarse:touch-none pointer-coarse:opacity-100",
              // Sits on the frame's corner, off the content: it used to cover
              // the first letters of every block title. The larger touch grip
              // rides higher so it still clears the title.
              selected ? "opacity-100" : "opacity-0",
            )}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          {selected && props.selectedBlockIds.length > 1 && (
            <span className="absolute -bottom-3 right-2 z-30 inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-[var(--user-accent-border)] bg-[var(--popover)] px-1 text-2xs font-medium tabular-nums text-[var(--user-accent-text)] shadow-sm">
              {props.selectedBlockIds.indexOf(block.id) + 1}
              <span className="sr-only"> of {props.selectedBlockIds.length} selected</span>
            </span>
          )}
          {selected && props.selectedBlockIds.length < 2 && (
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
              <IconButton
                label={block.locked ? "Unlock block" : "Lock block in place"}
                active={block.locked === true}
                onClick={() => props.onBlockAction(block.id, { locked: !block.locked })}
              >
                {block.locked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <LockOpen className="h-3.5 w-3.5" />
                )}
              </IconButton>
              <IconButton label="Duplicate block" onClick={() => props.onDuplicate(block.id)}>
                <Copy className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                label={block.locked ? "Unlock to remove" : "Remove block"}
                disabled={block.locked === true}
                onClick={() => props.onRemove(block.id)}
              >
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
