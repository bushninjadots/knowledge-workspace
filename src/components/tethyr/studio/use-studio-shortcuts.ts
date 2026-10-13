// ── Studio keyboard shortcuts ─────────────────────────────────────────────────
// Save (Ctrl/⌘+S, works mid-typing), the command palette (Ctrl/⌘+J), undo and
// redo, Escape to clear the selection, duplicate (Ctrl/⌘+D), Delete, and
// arrow keys to nudge (Shift+arrows to resize) the selected block on its grid.
// Extracted from creation-studio.tsx.

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { GStudioMode } from "@/components/tethyr/studio/g-studio-surface";
import type { LayoutBlockInstance, LayoutGridItem, PageLayout } from "@/lib/page-blocks";
import { overlapsGridItems } from "@/lib/studio-grid";
import { blockSize, cloneLayout } from "@/lib/studio-layout";

export function useStudioShortcuts({
  layout,
  mode,
  selectedBlockId,
  selectedBlockIds,
  setSelectedBlockIds,
  setCommandsOpen,
  saveRef,
  touchedGridRef,
  commit,
  undo,
  redo,
  findBlock,
  duplicateBlock,
  removeBlock,
  removeBlocks,
}: {
  layout: PageLayout | null;
  mode: GStudioMode;
  selectedBlockId: string | null;
  selectedBlockIds: string[];
  setSelectedBlockIds: Dispatch<SetStateAction<string[]>>;
  setCommandsOpen: Dispatch<SetStateAction<boolean>>;
  saveRef: MutableRefObject<() => void>;
  touchedGridRef: MutableRefObject<Set<string>>;
  commit: (nextLayout: PageLayout) => void;
  undo: () => void;
  redo: () => void;
  findBlock: (blockId: string) => LayoutBlockInstance | undefined;
  duplicateBlock: (blockId: string) => void;
  removeBlock: (blockId: string) => void;
  removeBlocks: (blockIds: string[]) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      const mod = event.metaKey || event.ctrlKey;
      // Save works from anywhere, mid-typing included (it's what people try).
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveRef.current();
        return;
      }
      if (mod && event.key.toLowerCase() === "j") {
        event.preventDefault();
        // Inside another dialog it only closes the palette, never stacks one.
        const inDialog = !!target?.closest?.('[role="dialog"]');
        setCommandsOpen((open) => (inDialog ? false : !open));
        return;
      }
      if (editable || target?.closest?.('[role="dialog"]')) return;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if (event.key === "Escape") {
        setSelectedBlockIds([]);
      } else if (mod && event.key.toLowerCase() === "d" && mode === "edit" && selectedBlockId) {
        event.preventDefault();
        duplicateBlock(selectedBlockId);
      } else if (
        !mod &&
        mode === "edit" &&
        selectedBlockId &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        if (selectedBlockIds.length > 1) return removeBlocks(selectedBlockIds);
        // Locked blocks ignore the keyboard's destructive and moving keys.
        if (findBlock(selectedBlockId)?.locked) return;
        removeBlock(selectedBlockId);
      } else if (
        !mod &&
        mode === "edit" &&
        layout &&
        selectedBlockId &&
        selectedBlockIds.length === 1 &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        const section = layout.sections.find((candidate) =>
          candidate.blocks.some((block) => block.id === selectedBlockId),
        );
        const item = section?.grid?.find((gridItem) => gridItem.i === selectedBlockId);
        if (!section || !item || findBlock(selectedBlockId)?.locked) return;
        event.preventDefault();
        const dx = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        const dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
        let candidate: LayoutGridItem;
        if (event.shiftKey) {
          // Shift+arrows resize from the bottom-right corner instead.
          const [, , minW, minH] = blockSize(findBlock(selectedBlockId)?.type ?? "");
          const w = Math.max(item.minW ?? minW, Math.min(12 - item.x, item.w + dx));
          const h = Math.max(item.minH ?? minH, item.h + dy);
          if (w === item.w && h === item.h) return;
          candidate = { ...item, w, h };
        } else {
          const x = Math.max(0, Math.min(12 - item.w, item.x + dx));
          const y = Math.max(0, item.y + dy);
          if (x === item.x && y === item.y) return;
          candidate = { ...item, x, y };
        }
        const others = (section.grid ?? []).filter((gridItem) => gridItem.i !== item.i);
        if (others.some((other) => overlapsGridItems(candidate, other))) return;
        const next = cloneLayout(layout);
        const targetSection = next.sections.find((s) => s.id === section.id);
        if (!targetSection) return;
        targetSection.grid = (targetSection.grid ?? []).map((gridItem) =>
          gridItem.i === item.i ? candidate : gridItem,
        );
        touchedGridRef.current.add(section.id);
        commit(next);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    commit,
    duplicateBlock,
    findBlock,
    layout,
    mode,
    redo,
    removeBlock,
    removeBlocks,
    saveRef,
    selectedBlockId,
    selectedBlockIds,
    setCommandsOpen,
    setSelectedBlockIds,
    touchedGridRef,
    undo,
  ]);
}
