import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus } from 'lucide-react';
// @ts-ignore — react-grid-layout ships without bundled types
import { Responsive, WidthProvider } from 'react-grid-layout';
import { blockMap } from '../../data/blockCatalog';
import type { StudioEditor } from '../../hooks/useStudioEditor';
import type { BlockType, GridItem, LayoutSection } from '../../types/studio';
import { GRID_COLS, readingOrder, rowsForHeight, shouldRenderSectionInView } from '../../utils/layout';
import { densityMetrics } from '../../utils/studioStyle';
import { IconButton } from '../common/Primitives';
import { BlockFrame } from './BlockFrame';
import { cx } from '../../utils/format';

const ResponsiveGrid = WidthProvider(Responsive);

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS = { lg: GRID_COLS, md: GRID_COLS, sm: 8, xs: 4, xxs: 1 };
/** Only wide breakpoints write back — a phone must never flatten the desktop layout. */
const PERSISTED_BREAKPOINTS = new Set(['lg', 'md']);

function ResizeHandle(axis: string, ref: React.Ref<HTMLDivElement>) {
  const isCorner = axis === 'se';
  return (
    <div
      ref={ref}
      className={cx(
        'react-resizable-handle',
        `react-resizable-handle-${axis}`,
        'opacity-0 transition-opacity duration-140 group-hover/frame:opacity-100'
      )}>
      
      <span
        aria-hidden
        className={cx(
          'block rounded-sm border bg-[var(--surface-elevated)]',
          'border-[var(--user-accent)]',
          isCorner ? 'h-2.5 w-2.5' : axis === 'e' ? 'h-5 w-2' : 'h-2 w-5'
        )} />
      
    </div>);

}

interface SectionBandProps {
  section: LayoutSection;
  index: number;
  total: number;
  editor: StudioEditor;
  dragType: BlockType | null;
  /** Free-form drag/resize is desktop-only; touch gets explicit controls. */
  directManipulation: boolean;
  onRequestPalette: (sectionId: string) => void;
}

export function SectionBand({
  section,
  index,
  total,
  editor,
  dragType,
  directManipulation,
  onRequestPalette
}: SectionBandProps) {
  const { isEditing, page } = editor;
  const { rowHeight, gap } = densityMetrics(page.config.density);
  const breakpointRef = useRef<string>('lg');
  const [renaming, setRenaming] = useState(false);

  const blocks = useMemo(
    () => isEditing ? section.blocks : section.blocks.filter((b) => b.visible),
    [isEditing, section.blocks]
  );

  const layout = useMemo(() => {
    const ids = new Set(blocks.map((b) => b.id));
    return section.grid.
    filter((g) => ids.has(g.i)).
    map((g) => {
      const block = section.blocks.find((b) => b.id === g.i);
      const def = block ? blockMap[block.type] : undefined;
      return { ...g, minW: def?.minW ?? 2, minH: def?.minH ?? 1 };
    });
  }, [blocks, section.grid, section.blocks]);

  const handleMeasure = useCallback(
    (blockId: string, px: number) => {
      const rows = rowsForHeight(px, rowHeight, gap);
      editor.growBlock(section.id, blockId, rows);
    },
    [editor, gap, rowHeight, section.id]
  );

  const droppingItem = useMemo(() => {
    if (!dragType) return undefined;
    const def = blockMap[dragType];
    return { i: '__dropping-elem__', w: def.defaultW, h: def.defaultH };
  }, [dragType]);

  if (!isEditing && !shouldRenderSectionInView(section)) return null;

  const isSpine = section.kind === 'spine';
  const order = readingOrder(section);

  return (
    <section
      aria-label={section.title}
      className={cx('relative', !section.visible && isEditing && 'opacity-60')}
      onClick={() => isEditing && editor.select(null)}>
      
      {/* Section rail — only present while editing */}
      {isEditing ?
      <header className="mb-2 flex items-center gap-1.5">
          <span
          aria-hidden
          className="h-3.5 w-0.5 shrink-0"
          style={{ backgroundColor: isSpine ? 'var(--user-accent)' : 'var(--border-strong)' }} />
        
          {renaming ?
        <input
          autoFocus
          defaultValue={section.title}
          aria-label="Section name"
          onBlur={(event) => {
            editor.renameSection(section.id, event.target.value.trim() || section.title);
            setRenaming(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
            if (event.key === 'Escape') setRenaming(false);
          }}
          className="t-label t-focus w-40 rounded-sm border border-[var(--user-accent-border)] bg-[var(--surface-sunken)] px-1 py-0.5 outline-none" /> :


        <button
          type="button"
          onClick={() => setRenaming(true)}
          className="t-label t-focus rounded-sm px-0.5 hover:text-foreground"
          title="Rename section">
          
              {section.title}
            </button>
        }
          {isSpine && <span className="t-label text-[var(--user-accent)]">spine</span>}
          <span className="ml-1 font-mono text-3xs text-muted-foreground-subtle">
            {order.length} {order.length === 1 ? 'block' : 'blocks'}
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            <IconButton
            label="Move section up"
            disabled={index === 0}
            onClick={() => editor.nudgeSection(section.id, -1)}>
            
              <ChevronUp className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
            label="Move section down"
            disabled={index === total - 1}
            onClick={() => editor.nudgeSection(section.id, 1)}>
            
              <ChevronDown className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
            label={section.visible ? 'Hide section' : 'Show section'}
            onClick={() => editor.toggleSectionVisible(section.id)}>
            
              {section.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </IconButton>
          </div>
        </header> :

      isSpine &&
      <header className="mb-2 flex items-center gap-2">
            <span aria-hidden className="h-3 w-0.5" style={{ backgroundColor: 'var(--user-accent)' }} />
            <h2 className="t-label">{section.title}</h2>
            <span className="t-rule flex-1" />
          </header>

      }

      {blocks.length === 0 ?
      isEditing ?
      <button
        type="button"
        onClick={() => onRequestPalette(section.id)}
        className="t-focus flex w-full items-center justify-center gap-1.5 border border-dashed border-border py-8 text-xs text-muted-foreground hover:border-[var(--user-accent-border)] hover:text-[var(--user-accent)]"
        style={{ borderRadius: 'var(--studio-radius)' }}>
        
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add a block to {section.title}
          </button> :
      null :

      <ResponsiveGrid
        className="layout"
        layouts={{ lg: layout }}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={rowHeight}
        margin={[gap, gap]}
        containerPadding={[0, 0]}
        isDraggable={isEditing && directManipulation}
        isResizable={isEditing && directManipulation}
        isDroppable={isEditing && directManipulation && Boolean(dragType)}
        droppingItem={droppingItem}
        draggableHandle=".block-drag-handle"
        draggableCancel="input,textarea,button,a"
        resizeHandles={['se', 'e', 's']}
        resizeHandle={ResizeHandle}
        useCSSTransforms
        measureBeforeMount={false}
        compactType="vertical"
        onBreakpointChange={(breakpoint: string) => {
          breakpointRef.current = breakpoint;
        }}
        onDragStart={() => editor.beginInteraction('Moved a block')}
        onResizeStart={() => editor.beginInteraction('Resized a block')}
        onDrop={(_l: GridItem[], item: GridItem) => {
          if (!dragType) return;
          editor.addBlock(section.id, dragType, item?.y === 0 ? 0 : undefined);
        }}
        onLayoutChange={(next: GridItem[]) => {
          if (!PERSISTED_BREAKPOINTS.has(breakpointRef.current)) return;
          editor.applyGrid(section.id, next);
        }}>
        
          {blocks.map((block) =>
        <BlockFrame key={block.id} block={block} section={section} editor={editor} onMeasure={handleMeasure} />
        )}
        </ResponsiveGrid>
      }

      {/* Insertion point — appears naturally at the end of the section */}
      {isEditing && blocks.length > 0 &&
      <div className="group/insert relative mt-1 flex h-6 items-center justify-center">
          <span
          aria-hidden
          className="absolute inset-x-0 top-1/2 border-t border-dashed border-transparent transition-colors duration-140 group-hover/insert:border-[var(--user-accent-border)]" />
        
          <button
          type="button"
          onClick={() => onRequestPalette(section.id)}
          className="t-focus relative flex h-5 items-center gap-1 rounded-sm border border-border bg-[var(--surface-elevated)] px-1.5 font-mono text-3xs uppercase tracking-widest text-muted-foreground opacity-0 transition-opacity duration-140 group-hover/insert:opacity-100 focus-visible:opacity-100">
          
            <Plus className="h-3 w-3" aria-hidden /> Add block
          </button>
        </div>
      }
    </section>);

}