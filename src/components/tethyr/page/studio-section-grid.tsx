import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import type { LayoutBlockInstance, LayoutSection } from "@/lib/page-blocks";

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS = { lg: 12, md: 12, sm: 8, xs: 4, xxs: 1 };
const ROW_HEIGHT = 22;
const MARGIN: [number, number] = [12, 12];

interface StudioSectionGridProps {
  section: LayoutSection;
  blocks: LayoutBlockInstance[];
  renderBlock: (block: LayoutBlockInstance, index: number) => React.ReactNode;
  onChange: (blocks: LayoutBlockInstance[]) => void;
}

/**
 * Editing-only canvas adapter. Persisted page data remains the ordered block
 * list; RGL supplies the interaction layer for real drag and resize handles.
 * Legacy layouts without coordinates are converted to a sensible 12-column
 * arrangement and continue to render normally outside edit mode.
 */
export function StudioSectionGrid({
  section,
  blocks,
  renderBlock,
  onChange,
}: StudioSectionGridProps) {
  const { width, containerRef } = useContainerWidth({ initialWidth: 960 });
  const baseLayout = useMemo(() => toGridLayout(section, blocks), [section, blocks]);
  const [items, setItems] = useState<LayoutItem[]>(baseLayout);
  const readyRef = useRef(false);

  const signature = baseLayout
    .map((item) => `${item.i}:${item.x}:${item.y}:${item.w}:${item.h}`)
    .join("|");
  useEffect(() => {
    readyRef.current = false;
    setItems(baseLayout);
  }, [baseLayout, signature]);

  const layouts = useMemo(() => ({ lg: items }), [items]);

  function handleLayoutChange(layout: Layout, all: Partial<Record<string, Layout>>) {
    const nextGrid = (all.lg ?? layout) as LayoutItem[];
    const byId = new Map(nextGrid.map((item) => [item.i, item]));
    const nextBlocks = blocks
      .map((block) => {
        const item = byId.get(block.id);
        return item
          ? { ...block, position: item.y * 100 + item.x, span: item.w, height: item.h }
          : block;
      })
      .sort((a, b) => a.position - b.position)
      .map((block, index) => ({ ...block, position: index }));
    const changed = nextBlocks.some(
      (block, index) =>
        block.id !== blocks[index]?.id ||
        block.position !== blocks[index]?.position ||
        block.span !== blocks[index]?.span ||
        block.height !== blocks[index]?.height,
    );
    setItems(nextGrid);
    if (!readyRef.current) {
      readyRef.current = true;
      return;
    }
    if (changed) onChange(nextBlocks);
  }

  return (
    <div
      ref={containerRef}
      className="studio-section-grid"
      data-studio-canvas="grid"
      data-studio-rgl-section={section.id}
    >
      {width > 0 && (
        <ResponsiveGridLayout
          width={width}
          layouts={layouts}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          margin={MARGIN}
          containerPadding={[0, 0]}
          dragConfig={{ enabled: true, bounded: true, handle: ".studio-rgl-handle" }}
          resizeConfig={{ enabled: true, handles: ["se", "e", "s"] }}
          onLayoutChange={handleLayoutChange}
        >
          {blocks.map((block, index) => (
            <div key={block.id} className="min-w-0">
              {renderBlock(block, index)}
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}

function toGridLayout(section: LayoutSection, blocks: LayoutBlockInstance[]): LayoutItem[] {
  const defaultWidth = defaultSpan(section.layout);
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 1;

  return [...blocks]
    .sort((a, b) => a.position - b.position)
    .map((block) => {
      const width = Math.max(1, Math.min(12, block.span ?? defaultWidth));
      if (cursorX + width > 12) {
        cursorX = 0;
        cursorY += rowHeight;
        rowHeight = 1;
      }
      const item: LayoutItem = {
        i: block.id,
        x: cursorX,
        y: cursorY,
        w: width,
        h: Math.max(4, block.height ?? 8),
        minW: 1,
        maxW: 12,
        minH: 4,
      };
      cursorX += width;
      rowHeight = Math.max(rowHeight, 1);
      return item;
    });
}

function defaultSpan(layout: LayoutSection["layout"]): number {
  switch (layout) {
    case "three_column":
      return 4;
    case "two_column":
    case "side_by_side":
    case "split":
      return 6;
    case "sidebar_left":
    case "sidebar_right":
      return 4;
    case "feature":
    case "featured_work":
    case "image_lead":
    case "asymmetric":
      return 6;
    default:
      return 12;
  }
}
