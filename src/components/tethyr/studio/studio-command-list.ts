// ── Studio command palette entries ────────────────────────────────────────────
// Everything the command palette (Ctrl/⌘+J) can do, built from the same
// handlers the toolbar, rail and keyboard use. Pure: CreationStudio memoizes it.

import type { GStudioDevice, GStudioMode } from "@/components/tethyr/studio/g-studio-surface";
import { getAllBlocks, getBlock } from "@/lib/block-registry";
import type { StudioCommand } from "@/lib/studio-commands";
import { sectionLabel, type GridArrangement } from "@/lib/studio-grid";
import type { LayoutBlockInstance, PageLayout } from "@/lib/page-blocks";
import { dedupeSharedReadmeBlocks } from "./rail-block-palette";

export interface StudioCommandContext {
  layout: PageLayout | null;
  mode: GStudioMode;
  device: GStudioDevice;
  dirty: boolean;
  selectedBlockId: string | null;
  selectedBlockIds: string[];
  findBlock: (blockId: string) => LayoutBlockInstance | undefined;
  setMode: (mode: GStudioMode) => void;
  setDevice: (device: GStudioDevice) => void;
  setSelectedBlockIds: (ids: string[]) => void;
  setIntroStarterOpen: (open: boolean) => void;
  setAppearanceOpen: (open: boolean) => void;
  undo: () => void;
  redo: () => void;
  save: (options?: { announce?: boolean }) => Promise<void>;
  requestPublish: () => void;
  addBlock: (type: string, targetSectionId?: string) => void;
  addSection: () => void;
  updateBlock: (blockId: string, patch: Partial<LayoutBlockInstance>) => void;
  duplicateBlock: (blockId: string) => void;
  removeBlock: (blockId: string) => void;
  removeBlocks: (blockIds: string[]) => void;
  groupIntoArea: (blockIds: string[]) => void;
  arrangeBlocks: (blockIds: string[], how: GridArrangement) => void;
  applyBlockStyle: (
    blockIds: string[],
    patch: Partial<LayoutBlockInstance>,
    message?: string,
  ) => void;
}

export function buildStudioCommands({
  layout,
  mode,
  device,
  dirty,
  selectedBlockId,
  selectedBlockIds,
  findBlock,
  setMode,
  setDevice,
  setSelectedBlockIds,
  setIntroStarterOpen,
  setAppearanceOpen,
  undo,
  redo,
  save,
  requestPublish,
  addBlock,
  addSection,
  updateBlock,
  duplicateBlock,
  removeBlock,
  removeBlocks,
  groupIntoArea,
  arrangeBlocks,
  applyBlockStyle,
}: StudioCommandContext): StudioCommand[] {
  if (!layout) return [];
  const list: StudioCommand[] = [];
  const add = (command: StudioCommand) => list.push(command);
  const selected = selectedBlockId ? findBlock(selectedBlockId) : undefined;
  if (mode === "edit" && selectedBlockIds.length > 1) {
    const ids = selectedBlockIds;
    const count = `${ids.length} blocks`;
    add({
      id: "multi-group",
      label: "Group selection into a new area",
      group: "Selection",
      run: () => groupIntoArea(ids),
    });
    add({
      id: "multi-width",
      label: "Match widths",
      group: "Selection",
      keywords: "size",
      run: () => arrangeBlocks(ids, "match-width"),
    });
    add({
      id: "multi-height",
      label: "Match heights",
      group: "Selection",
      keywords: "size",
      run: () => arrangeBlocks(ids, "match-height"),
    });
    add({
      id: "multi-left",
      label: "Align left edges",
      group: "Selection",
      run: () => arrangeBlocks(ids, "align-left"),
    });
    add({
      id: "multi-top",
      label: "Align tops",
      group: "Selection",
      run: () => arrangeBlocks(ids, "align-top"),
    });
    add({
      id: "multi-row",
      label: "Put side by side",
      group: "Selection",
      keywords: "row",
      run: () => arrangeBlocks(ids, "row"),
    });
    add({
      id: "multi-hide",
      label: `Hide ${count}`,
      group: "Selection",
      run: () => applyBlockStyle(ids, { visible: false }, `Hid ${count}`),
    });
    add({
      id: "multi-show",
      label: `Show ${count}`,
      group: "Selection",
      run: () => applyBlockStyle(ids, { visible: true }, `Showing ${count}`),
    });
    add({
      id: "multi-remove",
      label: `Remove ${count}`,
      group: "Selection",
      keywords: "delete",
      shortcut: "Del",
      run: () => removeBlocks(ids),
    });
  } else if (mode === "edit" && selected) {
    const name = getBlock(selected.type)?.label ?? selected.type;
    add({
      id: "sel-duplicate",
      label: `Duplicate ${name}`,
      group: "Selection",
      keywords: "copy",
      shortcut: "Ctrl+D",
      run: () => duplicateBlock(selected.id),
    });
    add({
      id: "sel-visible",
      label: `${selected.visible === false ? "Show" : "Hide"} ${name}`,
      group: "Selection",
      run: () => updateBlock(selected.id, { visible: selected.visible === false }),
    });
    add({
      id: "sel-lock",
      label: `${selected.locked ? "Unlock" : "Lock"} ${name}`,
      group: "Selection",
      keywords: "pin",
      run: () => updateBlock(selected.id, { locked: !selected.locked }),
    });
    if (!selected.locked) {
      add({
        id: "sel-remove",
        label: `Remove ${name}`,
        group: "Selection",
        keywords: "delete",
        shortcut: "Del",
        run: () => removeBlock(selected.id),
      });
    }
  }
  if (selectedBlockIds.length > 0) {
    add({
      id: "sel-clear",
      label: "Clear selection",
      group: "Selection",
      keywords: "deselect",
      shortcut: "Esc",
      run: () => setSelectedBlockIds([]),
    });
  }
  add({ id: "undo", label: "Undo", group: "Page", shortcut: "Ctrl+Z", run: undo });
  add({ id: "redo", label: "Redo", group: "Page", shortcut: "Ctrl+Shift+Z", run: redo });
  add({
    id: "save",
    label: "Save now",
    group: "Page",
    shortcut: "Ctrl+S",
    run: () => void save(),
  });
  add({
    id: "publish",
    label: "Publish",
    group: "Page",
    keywords: "go live",
    run: requestPublish,
  });
  add({
    id: "mode",
    label: mode === "edit" ? "Preview the page" : "Back to editing",
    group: "Page",
    keywords: "edit preview",
    run: () => {
      setMode(mode === "edit" ? "preview" : "edit");
      if (mode === "edit" && dirty) void save({ announce: false });
    },
  });
  add({
    id: "device",
    label: device === "desktop" ? "Show the phone layout" : "Show the desktop layout",
    group: "Page",
    keywords: "mobile device",
    run: () => setDevice(device === "desktop" ? "mobile" : "desktop"),
  });
  if (mode === "edit") {
    add({
      id: "area",
      label: "Add an area",
      group: "Page",
      keywords: "section",
      run: addSection,
    });
  }
  add({
    id: "templates",
    label: "Browse templates",
    group: "Page",
    keywords: "starter",
    run: () => setIntroStarterOpen(true),
  });
  add({
    id: "background",
    label: "Background and appearance",
    group: "Page",
    keywords: "backdrop pattern",
    run: () => setAppearanceOpen(true),
  });
  if (mode === "edit") {
    const target = selectedBlockId
      ? layout.sections.find((section) => section.blocks.some((b) => b.id === selectedBlockId))?.id
      : undefined;
    const used = new Set(layout.sections.flatMap((section) => section.blocks.map((b) => b.type)));
    for (const block of getAllBlocks()) {
      if (block.ownerContext === "project" || !dedupeSharedReadmeBlocks(block.type, used)) continue;
      add({
        id: `add-${block.type}`,
        label: `Add ${block.label}`,
        group: "Add a block",
        keywords: block.description,
        run: () => addBlock(block.type, target),
      });
    }
  }
  for (const section of layout.sections) {
    for (const block of section.blocks) {
      add({
        id: `go-${block.id}`,
        label: `${getBlock(block.type)?.label ?? block.type} · ${sectionLabel(section)}`,
        group: "Go to a block",
        keywords: "select find",
        run: () => {
          setMode("edit");
          setSelectedBlockIds([block.id]);
          window.setTimeout(() => {
            const el = document.querySelector<HTMLElement>(
              `[data-block-id="${CSS.escape(block.id)}"]`,
            );
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
            el?.focus({ preventScroll: true });
          }, 60);
        },
      });
    }
  }
  return list;
}
