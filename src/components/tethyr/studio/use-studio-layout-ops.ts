// ── Studio layout operations ──────────────────────────────────────────────────
// Every edit the canvas, rail, keyboard and command palette make to blocks,
// areas and their grids. Each one is a pure transformation of the current
// layout handed to `commit` (one undo step) — or, for live drag frames and
// content auto-fit, dispatched straight to the editor reducer. Extracted from
// creation-studio.tsx, which owns the document, saving and publishing.

import { useCallback, useState, type Dispatch, type MutableRefObject } from "react";
import { toast } from "sonner";
import { createBlockInstance } from "@/lib/block-registry";
import type { GStudioConfig } from "@/components/tethyr/studio/g-studio-surface";
import type {
  AreaAppearance,
  BlockConfig,
  LayoutBlockInstance,
  LayoutGridItem,
  LayoutSection,
  PageLayout,
} from "@/lib/page-blocks";
import { arrangeGrid, overlapsGridItems, type GridArrangement } from "@/lib/studio-grid";
import type { StudioEditorAction } from "@/lib/studio-editor-state";
import {
  makeId,
  blockSize,
  firstFreePosition,
  nextGridItem,
  placeDuplicateGridItem,
  normalizeGridItem,
  cloneLayout,
  sameGrid,
  preferredGridWidth,
  seedGridFromLayout,
  withFittedGrid,
} from "@/lib/studio-layout";

export interface StudioLayoutOpsInput {
  layout: PageLayout | null;
  config: GStudioConfig | null;
  /** Record one undo step (merged with the previous one when `mergeKey` matches). */
  commit: (nextLayout: PageLayout, nextConfig?: GStudioConfig, mergeKey?: string) => void;
  dispatch: Dispatch<StudioEditorAction>;
  /** Areas the creator arranged by hand; only these persist a `grid`. */
  touchedGridRef: MutableRefObject<Set<string>>;
  setSelectedBlockIds: Dispatch<React.SetStateAction<string[]>>;
  setRenameFocusId: (id: string | null) => void;
  toastUndoable: (message: string) => void;
}

export function useStudioLayoutOps({
  layout,
  config,
  commit,
  dispatch,
  touchedGridRef,
  setSelectedBlockIds,
  setRenameFocusId,
  toastUndoable,
}: StudioLayoutOpsInput) {
  const [gridInteraction, setGridInteraction] = useState(false);

  /** One style patch on several blocks, as a single undo step. */
  const applyBlockStyle = useCallback(
    (blockIds: string[], patch: Partial<LayoutBlockInstance>, message?: string) => {
      if (!layout || blockIds.length === 0) return;
      const ids = new Set(blockIds);
      commit({
        sections: layout.sections.map((section) => ({
          ...section,
          blocks: section.blocks.map((block) =>
            ids.has(block.id) ? { ...block, ...patch } : block,
          ),
        })),
      });
      if (blockIds.length > 1) {
        toastUndoable(message ?? `Style applied to ${blockIds.length} blocks`);
      }
    },
    [commit, layout, toastUndoable],
  );

  const updateBlock = useCallback(
    (blockId: string, patch: Partial<LayoutBlockInstance>) => {
      if (!layout) return;
      commit(
        {
          sections: layout.sections.map((section) => ({
            ...section,
            blocks: section.blocks.map((block) =>
              block.id === blockId ? { ...block, ...patch } : block,
            ),
          })),
        },
        undefined,
        `block:${blockId}:${Object.keys(patch).sort().join(",")}`,
      );
    },
    [commit, layout],
  );

  const updateBlockConfig = useCallback(
    (blockId: string, nextConfig: BlockConfig) => updateBlock(blockId, { config: nextConfig }),
    [updateBlock],
  );

  const addBlock = useCallback(
    (type: string, targetSectionId?: string, placement?: LayoutGridItem) => {
      if (!layout) return;
      const created = createBlockInstance(type);
      if (!created) return;
      const next = cloneLayout(layout);
      let section = next.sections.find((candidate) => candidate.id === targetSectionId);
      if (!section) section = next.sections[next.sections.length - 1];
      if (!section) {
        section = {
          id: `section-${Date.now()}`,
          position: 0,
          layout: "full",
          blocks: [],
          grid: [],
        };
        next.sections.push(section);
      }
      const block: LayoutBlockInstance = {
        id: makeId("block"),
        type: created.type,
        position: section.blocks.length,
        config: created.config,
        visible: true,
      };
      section.blocks.push(block);
      const [defaultW, defaultH, minW, minH] = blockSize(type);
      section.grid = [
        ...(section.grid ?? []),
        placement
          ? normalizeGridItem(
              { ...placement, i: block.id },
              block.id,
              defaultW,
              defaultH,
              minW,
              minH,
            )
          : nextGridItem(
              block.id,
              section.grid ?? [],
              preferredGridWidth(section.layout, section.blocks.length - 1, minW),
              defaultH,
              minW,
              minH,
            ),
      ];
      touchedGridRef.current.add(section.id);
      commit(next);
      setSelectedBlockIds([block.id]);
      // Bring the new block into view (it lands at the bottom of its area)
      // and focus it, so it's obvious where it went.
      window.setTimeout(() => {
        const el = document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(block.id)}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        el?.focus({ preventScroll: true });
      }, 60);
    },
    [commit, layout, setSelectedBlockIds, touchedGridRef],
  );

  const removeBlock = useCallback(
    (blockId: string) => {
      if (!layout) return;
      const next = cloneLayout(layout);
      for (const section of next.sections) {
        if (section.blocks.some((b) => b.id === blockId)) {
          touchedGridRef.current.add(section.id);
        }
      }
      commit({
        sections: next.sections.map((section) => ({
          ...section,
          blocks: section.blocks.filter((block) => block.id !== blockId),
          grid: section.grid?.filter((item) => item.i !== blockId),
        })),
      });
      setSelectedBlockIds([]);
      toastUndoable("Block removed");
    },
    [commit, layout, setSelectedBlockIds, toastUndoable, touchedGridRef],
  );

  const duplicateBlock = useCallback(
    (blockId: string) => {
      if (!layout) return;
      const next = cloneLayout(layout);
      for (const section of next.sections) {
        const sourceIndex = section.blocks.findIndex((block) => block.id === blockId);
        if (sourceIndex < 0) continue;
        const source = section.blocks[sourceIndex];
        const duplicate: LayoutBlockInstance = {
          ...source,
          id: makeId("block"),
          position: sourceIndex + 1,
          config: { ...source.config },
        };
        section.blocks.splice(sourceIndex + 1, 0, duplicate);
        section.blocks.forEach((block, index) => {
          block.position = index;
        });
        const sourceGrid = section.grid?.find((item) => item.i === source.id);
        section.grid = placeDuplicateGridItem(
          section.grid ?? [],
          sourceGrid,
          duplicate.id,
          blockSize(source.type),
        );
        touchedGridRef.current.add(section.id);
        commit(next);
        setSelectedBlockIds([duplicate.id]);
        return;
      }
    },
    [commit, layout, setSelectedBlockIds, touchedGridRef],
  );

  const moveBlock = useCallback(
    (blockId: string, direction: -1 | 1) => {
      if (!layout) return;
      const next = cloneLayout(layout);
      for (const section of next.sections) {
        const index = section.blocks.findIndex((block) => block.id === blockId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= section.blocks.length) continue;
        [section.blocks[index], section.blocks[target]] = [
          section.blocks[target],
          section.blocks[index],
        ];
        section.blocks.forEach((block, blockIndex) => {
          block.position = blockIndex;
        });
        // Rebuild the moved block's grid slot so the reorder is visible on the
        // canvas; other blocks keep their existing positions.
        if (section.grid && section.grid.length > 0) {
          const movedBlock = section.blocks[index];
          const [w, h, minW, minH] = blockSize(movedBlock.type);
          const others = section.grid.filter((item) => item.i !== movedBlock.id);
          const { x, y } = firstFreePosition(movedBlock.id, others, w, h);
          section.grid = [
            ...others,
            normalizeGridItem({ i: movedBlock.id, x, y, w, h }, movedBlock.id, w, h, minW, minH),
          ];
          touchedGridRef.current.add(section.id);
        }
        commit(next);
        return;
      }
    },
    [commit, layout, touchedGridRef],
  );

  const moveToSection = useCallback(
    (blockId: string, targetSectionId: string, placement?: { col: number; row: number }) => {
      if (!layout) return;
      const next = cloneLayout(layout);
      const sourceSection = next.sections.find((section) =>
        section.blocks.some((block) => block.id === blockId),
      );
      const targetSection = next.sections.find((section) => section.id === targetSectionId);
      if (!sourceSection || !targetSection || sourceSection.id === targetSection.id) return;
      const blockIndex = sourceSection.blocks.findIndex((block) => block.id === blockId);
      const [block] = sourceSection.blocks.splice(blockIndex, 1);
      if (!block) return;
      block.position = targetSection.blocks.length;
      targetSection.blocks.push(block);
      const sourceGridItem = sourceSection.grid?.find((item) => item.i === blockId);
      sourceSection.grid = sourceSection.grid?.filter((item) => item.i !== blockId);
      const [defaultW, defaultH, minW, minH] = blockSize(block.type);
      const w = Math.max(minW, Math.min(12, sourceGridItem?.w ?? defaultW));
      const h = Math.max(minH, sourceGridItem?.h ?? defaultH);
      const existing = targetSection.grid ?? [];
      const dropped =
        placement !== undefined
          ? normalizeGridItem(
              { i: block.id, x: placement.col, y: placement.row, w, h },
              block.id,
              w,
              h,
              minW,
              minH,
            )
          : nextGridItem(block.id, existing, w, h, minW, minH);
      if (existing.some((item) => overlapsGridItems(dropped, item))) {
        const { x: freeX, y: freeY } = firstFreePosition(block.id, existing, dropped.w, dropped.h);
        dropped.x = freeX;
        dropped.y = freeY;
      }
      targetSection.grid = [...existing, dropped];
      touchedGridRef.current.add(sourceSection.id);
      touchedGridRef.current.add(targetSection.id);
      next.sections.forEach((section) =>
        section.blocks.forEach((item, index) => (item.position = index)),
      );
      commit(next);
    },
    [commit, layout, touchedGridRef],
  );

  /** Remove several blocks as one undo step. Locked blocks stay put. */
  const removeBlocks = useCallback(
    (blockIds: string[]) => {
      if (!layout) return;
      const locked = new Set(
        layout.sections
          .flatMap((s) => s.blocks)
          .filter((b) => b.locked)
          .map((b) => b.id),
      );
      const ids = new Set(blockIds.filter((id) => !locked.has(id)));
      if (ids.size === 0) {
        toast("Locked blocks can't be removed — unlock them first.");
        return;
      }
      for (const section of layout.sections) {
        if (section.blocks.some((b) => ids.has(b.id))) touchedGridRef.current.add(section.id);
      }
      commit({
        sections: layout.sections.map((section) => ({
          ...section,
          blocks: section.blocks
            .filter((block) => !ids.has(block.id))
            .map((block, index) => ({ ...block, position: index })),
          grid: section.grid?.filter((item) => !ids.has(item.i)),
        })),
      });
      const kept = blockIds.length - ids.size;
      setSelectedBlockIds(blockIds.filter((id) => locked.has(id)));
      toastUndoable(
        `${ids.size} block${ids.size === 1 ? "" : "s"} removed` +
          (kept ? ` — ${kept} locked kept` : ""),
      );
    },
    [commit, layout, setSelectedBlockIds, toastUndoable, touchedGridRef],
  );

  /** Move the selected blocks into a new area placed after the first one's. */
  const groupIntoArea = useCallback(
    (blockIds: string[]) => {
      if (!layout) return;
      const next = cloneLayout(layout);
      const ids = new Set(blockIds);
      const moving: Array<{ block: LayoutBlockInstance; item?: LayoutGridItem }> = [];
      let afterIndex = -1;
      next.sections.forEach((section, sectionIndex) => {
        const taken = section.blocks.filter(
          (block) => ids.has(block.id) && !block.locked && block.type !== "profile-header",
        );
        if (taken.length === 0) return;
        if (taken.some((block) => block.id === blockIds[0]) || afterIndex < 0) {
          afterIndex = sectionIndex;
        }
        const takenIds = new Set(taken.map((block) => block.id));
        const grid = section.grid ?? [];
        moving.push(
          ...[...taken]
            .map((block) => ({ block, item: grid.find((item) => item.i === block.id) }))
            .sort(
              (a, b) => (a.item?.y ?? 0) - (b.item?.y ?? 0) || (a.item?.x ?? 0) - (b.item?.x ?? 0),
            ),
        );
        section.blocks = section.blocks.filter((block) => !takenIds.has(block.id));
        section.grid = grid.filter((item) => !takenIds.has(item.i));
        touchedGridRef.current.add(section.id);
      });
      if (moving.length === 0) {
        toast("Locked blocks and the header stay where they are.");
        return;
      }
      const id = makeId("section");
      const grid: LayoutGridItem[] = [];
      for (const { block, item } of moving) {
        const [defaultW, defaultH, minW, minH] = blockSize(block.type);
        grid.push(
          nextGridItem(block.id, grid, item?.w ?? defaultW, item?.h ?? defaultH, minW, minH),
        );
      }
      next.sections.splice(afterIndex + 1, 0, {
        id,
        position: 0,
        layout: "full",
        title: `Area ${next.sections.length + 1}`,
        visible: true,
        blocks: moving.map(({ block }, index) => ({ ...block, position: index })),
        grid,
      });
      next.sections.forEach((section, index) => {
        section.position = index;
        section.blocks.forEach((block, blockIndex) => (block.position = blockIndex));
      });
      touchedGridRef.current.add(id);
      commit(next);
      setRenameFocusId(id);
      toastUndoable(`Moved ${moving.length} blocks into a new area`);
    },
    [commit, layout, setRenameFocusId, toastUndoable, touchedGridRef],
  );

  const addSection = useCallback(() => {
    if (!layout) return;
    const next = cloneLayout(layout);
    const id = makeId("section");
    next.sections.push({
      id,
      position: next.sections.length,
      layout: "full",
      title: `Area ${next.sections.length + 1}`,
      visible: true,
      blocks: [],
      grid: [],
    });
    commit(next);
    setSelectedBlockIds([]);
    setRenameFocusId(id);
    // Keep the new area in view so the rename happens where you can see it.
    setTimeout(
      () =>
        document
          .getElementById("studio-add-section")
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      0,
    );
  }, [commit, layout, setRenameFocusId, setSelectedBlockIds]);

  const moveSection = useCallback(
    (sectionId: string, direction: -1 | 1) => {
      if (!layout) return;
      const sections = cloneLayout(layout).sections;
      const index = sections.findIndex((section) => section.id === sectionId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= sections.length) return;
      [sections[index], sections[target]] = [sections[target], sections[index]];
      commit({ sections });
    },
    [commit, layout],
  );

  const toggleSection = useCallback(
    (sectionId: string) => {
      if (!layout) return;
      commit({
        sections: layout.sections.map((section) =>
          section.id === sectionId ? { ...section, visible: section.visible === false } : section,
        ),
      });
    },
    [commit, layout],
  );

  const removeSection = useCallback(
    (sectionId: string) => {
      if (!layout) return;
      const section = layout.sections.find((candidate) => candidate.id === sectionId);
      // Only empty areas: blocks are never removed as a side effect.
      if (!section || section.blocks.length > 0) return;
      commit({
        sections: layout.sections
          .filter((candidate) => candidate.id !== sectionId)
          .map((candidate, index) => ({ ...candidate, position: index })),
      });
      toastUndoable("Area removed");
    },
    [commit, layout, toastUndoable],
  );

  const renameSection = useCallback(
    (sectionId: string, title: string) => {
      if (!layout || !title.trim()) return;
      const clean = title.trim().slice(0, 40);
      // Leaving the rename box unchanged isn't an edit (or an undo step).
      if (layout.sections.find((section) => section.id === sectionId)?.title === clean) return;
      commit({
        sections: layout.sections.map((section) =>
          section.id === sectionId ? { ...section, title: clean } : section,
        ),
      });
    },
    [commit, layout],
  );

  const setSectionLayout = useCallback(
    (sectionId: string, newLayout: LayoutSection["layout"]) => {
      if (!layout) return;
      const next = cloneLayout(layout);
      const section = next.sections.find((candidate) => candidate.id === sectionId);
      if (!section || section.layout === newLayout) return;
      section.layout = newLayout;
      section.grid = seedGridFromLayout(section, newLayout);
      section.blocks.forEach((block, index) => (block.position = index));
      touchedGridRef.current.add(sectionId);
      commit(next);
      setSelectedBlockIds([]);
      toastUndoable("Area layout changed — blocks were rearranged");
    },
    [commit, layout, setSelectedBlockIds, toastUndoable, touchedGridRef],
  );

  /** The layout with one area's grid replaced, or null when nothing changes. */
  /** `base` with one area's grid replaced, or null when nothing changes. */
  const gridOn = useCallback(
    (base: PageLayout, sectionId: string, nextGrid: LayoutGridItem[]): PageLayout | null => {
      const layout = base;
      const section = layout.sections.find((candidate) => candidate.id === sectionId);
      if (!section) return null;
      const validIds = new Set(section.blocks.map((block) => block.id));
      const normalized = nextGrid
        .filter((item) => item.i !== "__dropping-elem__" && validIds.has(item.i))
        .map((item) =>
          normalizeGridItem(item, item.i, item.w, item.h, item.minW ?? 2, item.minH ?? 2),
        );
      if (sameGrid(section.grid ?? [], normalized)) return null;
      touchedGridRef.current.add(sectionId);
      const positions = new Map(normalized.map((item, index) => [item.i, { item, index }]));
      return {
        ...layout,
        sections: layout.sections.map((candidate) =>
          candidate.id !== sectionId
            ? candidate
            : {
                ...candidate,
                grid: normalized,
                blocks: candidate.blocks.map((block) => {
                  const position = positions.get(block.id);
                  return position
                    ? {
                        ...block,
                        position: position.index,
                        span: position.item.w,
                        height: position.item.h,
                      }
                    : block;
                }),
              },
        ),
      };
    },
    [touchedGridRef],
  );
  const layoutWithGrid = useCallback(
    (sectionId: string, nextGrid: LayoutGridItem[]) =>
      layout ? gridOn(layout, sectionId, nextGrid) : null,
    [gridOn, layout],
  );

  /** Lay the selection out relative to the first block picked. */
  const arrangeBlocks = useCallback(
    (blockIds: string[], how: GridArrangement) => {
      if (!layout || blockIds.length < 2) return;
      const anchorId = blockIds[0];
      const anchor = layout.sections
        .flatMap((section) => section.grid ?? [])
        .find((item) => item.i === anchorId);
      if (!anchor) return;
      const locked = new Set(
        layout.sections
          .flatMap((s) => s.blocks)
          .filter((b) => b.locked)
          .map((b) => b.id),
      );
      const ids = new Set(blockIds.filter((id) => !locked.has(id)));
      let next: PageLayout = layout;
      let changed = false;
      for (const section of layout.sections) {
        // Tops and rows only mean something inside one area.
        const sameArea = section.grid?.some((item) => item.i === anchorId);
        if ((how === "align-top" || how === "row") && !sameArea) continue;
        const arranged = arrangeGrid(section.grid ?? [], ids, anchor, how);
        if (!arranged) continue;
        // Locked blocks only move if a selected block now sits on them.
        const updated = gridOn(next, section.id, arranged);
        if (updated) {
          next = updated;
          changed = true;
        }
      }
      if (!changed) {
        toast(how === "row" ? "Those blocks can't share one row." : "Already lined up.");
        return;
      }
      commit(next);
      toastUndoable(`Arranged ${blockIds.length} blocks`);
    },
    [commit, gridOn, layout, toastUndoable],
  );

  // Live grid updates: drag/resize frames (history was recorded when the
  // gesture began) and content auto-fit (deliberately not an undo step).
  const setSectionAppearance = useCallback(
    (sectionId: string, patch: AreaAppearance) => {
      if (!layout) return;
      commit(
        {
          sections: layout.sections.map((section) =>
            section.id === sectionId
              ? { ...section, appearance: { ...section.appearance, ...patch } }
              : section,
          ),
        },
        undefined,
        `area:${sectionId}`,
      );
    },
    [commit, layout],
  );

  // Applied to the latest layout, not the one this callback closed over: a
  // drop's snap correction arrives a tick after the drop itself, and against
  // the stale layout a snap back to the starting cell looked like "no change"
  // and was dropped — which is why Snap appeared to do nothing.
  const applyGrid = useCallback(
    (sectionId: string, nextGrid: LayoutGridItem[]) => {
      dispatch({ type: "adjust", update: (current) => gridOn(current, sectionId, nextGrid) });
    },
    [dispatch, gridOn],
  );

  // Content auto-fit: patch the working layout and the saved baseline alike,
  // so measuring heights never marks the draft dirty, autosaves, or marks an
  // area as hand-arranged (which would change how the public page lays it out).
  const fitGrid = useCallback(
    (sectionId: string, fitted: LayoutGridItem[]) => {
      dispatch({ type: "fit", sectionId, grid: fitted, apply: withFittedGrid });
    },
    [dispatch],
  );

  // Discrete grid edits (the width stepper) are their own undo step.
  const commitGrid = useCallback(
    (sectionId: string, nextGrid: LayoutGridItem[]) => {
      const next = layoutWithGrid(sectionId, nextGrid);
      if (next) commit(next);
    },
    [commit, layoutWithGrid],
  );

  const beginGridInteraction = useCallback(() => {
    if (gridInteraction || !layout || !config) return;
    setGridInteraction(true);
    dispatch({ type: "checkpoint", arranged: [...touchedGridRef.current], now: Date.now() });
  }, [config, dispatch, gridInteraction, layout, touchedGridRef]);

  const endGridInteraction = useCallback(() => setGridInteraction(false), []);

  return {
    applyBlockStyle,
    updateBlock,
    updateBlockConfig,
    addBlock,
    removeBlock,
    duplicateBlock,
    moveBlock,
    moveToSection,
    removeBlocks,
    groupIntoArea,
    addSection,
    moveSection,
    toggleSection,
    removeSection,
    renameSection,
    setSectionLayout,
    arrangeBlocks,
    setSectionAppearance,
    applyGrid,
    fitGrid,
    commitGrid,
    beginGridInteraction,
    endGridInteraction,
  };
}
