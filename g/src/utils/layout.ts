import { blockMap } from '../data/blockCatalog';
import type {
  BlockInstance,
  BlockType,
  GridItem,
  LayoutSection,
  PageLayout } from
'../types/studio';

export const GRID_COLS = 12;

let seq = 0;
export function newId(prefix = 'b'): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`;
}

/** Reading order of a section: top-to-bottom, then left-to-right. */
export function readingOrder(section: LayoutSection): GridItem[] {
  return [...section.grid].sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y);
}

export function gridItem(section: LayoutSection, blockId: string): GridItem | undefined {
  return section.grid.find((g) => g.i === blockId);
}

/**
 * Re-pack a section left-to-right using per-type widths, preserving the
 * current reading order. Starters use this so a preset never deletes content.
 */
export function reflowSection(
section: LayoutSection,
widths: Partial<Record<BlockType, number>>,
heights: Partial<Record<BlockType, number>> = {})
: LayoutSection {
  const order = readingOrder(section);
  let x = 0;
  let y = 0;
  let rowH = 0;
  const grid: GridItem[] = [];
  for (const item of order) {
    const block = section.blocks.find((b) => b.id === item.i);
    if (!block) continue;
    const def = blockMap[block.type];
    const w = Math.min(GRID_COLS, widths[block.type] ?? item.w);
    const h = heights[block.type] ?? item.h;
    if (x + w > GRID_COLS) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    grid.push({ i: item.i, x, y, w, h, minW: def.minW, minH: def.minH });
    x += w;
    rowH = Math.max(rowH, h);
  }
  return { ...section, grid };
}

export function createBlockInstance(type: BlockType, props: BlockInstance['props'] = {}): BlockInstance {
  return { id: newId(), type, visible: true, props };
}

/** Append a block, or insert it at a reading-order index (insertion points). */
export function insertBlock(
section: LayoutSection,
block: BlockInstance,
atIndex?: number)
: LayoutSection {
  const def = blockMap[block.type];
  const order = readingOrder(section);
  const index = atIndex === undefined ? order.length : Math.max(0, Math.min(atIndex, order.length));
  const shiftFrom = index < order.length ? order[index].y : Infinity;
  const item: GridItem = {
    i: block.id,
    x: 0,
    y: shiftFrom === Infinity ? maxBottom(section.grid) : shiftFrom,
    w: def.defaultW,
    h: def.defaultH,
    minW: def.minW,
    minH: def.minH
  };
  const grid = section.grid.map((g) => g.y >= shiftFrom ? { ...g, y: g.y + def.defaultH } : g);
  return { ...section, blocks: [...section.blocks, block], grid: [...grid, item] };
}

export function maxBottom(grid: GridItem[]): number {
  return grid.reduce((acc, g) => Math.max(acc, g.y + g.h), 0);
}

export function removeBlock(layout: PageLayout, blockId: string): PageLayout {
  return {
    sections: layout.sections.map((s) => ({
      ...s,
      blocks: s.blocks.filter((b) => b.id !== blockId),
      grid: s.grid.filter((g) => g.i !== blockId)
    }))
  };
}

export function findBlock(
layout: PageLayout,
blockId: string)
: {section: LayoutSection;block: BlockInstance;} | null {
  for (const section of layout.sections) {
    const block = section.blocks.find((b) => b.id === blockId);
    if (block) return { section, block };
  }
  return null;
}

export function mapBlock(
layout: PageLayout,
blockId: string,
fn: (block: BlockInstance) => BlockInstance)
: PageLayout {
  return {
    sections: layout.sections.map((s) => ({
      ...s,
      blocks: s.blocks.map((b) => b.id === blockId ? fn(b) : b)
    }))
  };
}

export function moveBlockToSection(
layout: PageLayout,
blockId: string,
targetSectionId: string)
: PageLayout {
  const found = findBlock(layout, blockId);
  if (!found || found.section.id === targetSectionId) return layout;
  const item = gridItem(found.section, blockId);
  const sections = layout.sections.map((s) => {
    if (s.id === found.section.id) {
      return {
        ...s,
        blocks: s.blocks.filter((b) => b.id !== blockId),
        grid: s.grid.filter((g) => g.i !== blockId)
      };
    }
    if (s.id === targetSectionId) {
      const def = blockMap[found.block.type];
      return {
        ...s,
        blocks: [...s.blocks, found.block],
        grid: [
        ...s.grid,
        {
          i: blockId,
          x: 0,
          y: maxBottom(s.grid),
          w: item?.w ?? def.defaultW,
          h: item?.h ?? def.defaultH,
          minW: def.minW,
          minH: def.minH
        }]

      };
    }
    return s;
  });
  return { sections };
}

export function moveSection(layout: PageLayout, sectionId: string, direction: -1 | 1): PageLayout {
  const index = layout.sections.findIndex((s) => s.id === sectionId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= layout.sections.length) return layout;
  const sections = [...layout.sections];
  const [removed] = sections.splice(index, 1);
  sections.splice(target, 0, removed);
  return { sections };
}

export function reorderSections(layout: PageLayout, order: string[]): PageLayout {
  const byId = new Map(layout.sections.map((s) => [s.id, s]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean) as LayoutSection[];
  const rest = layout.sections.filter((s) => !order.includes(s.id));
  return { sections: [...ordered, ...rest] };
}

export function updateSection(
layout: PageLayout,
sectionId: string,
fn: (section: LayoutSection) => LayoutSection)
: PageLayout {
  return { sections: layout.sections.map((s) => s.id === sectionId ? fn(s) : s) };
}

/** Grid rows needed to hold a measured pixel height. */
export function rowsForHeight(px: number, rowHeight: number, marginY: number): number {
  return Math.max(1, Math.ceil((px + marginY) / (rowHeight + marginY)));
}

/** Public Studio hides sections whose blocks are all hidden. */
export function shouldRenderSectionInView(section: LayoutSection): boolean {
  if (!section.visible) return false;
  return section.blocks.some((b) => b.visible);
}

export function visibleBlocks(section: LayoutSection): BlockInstance[] {
  return section.blocks.filter((b) => b.visible);
}