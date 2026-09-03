import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { Copy, Eye, EyeOff, GripVertical, Settings2, Trash2 } from 'lucide-react';
import { blockMap } from '../../data/blockCatalog';
import type { StudioEditor } from '../../hooks/useStudioEditor';
import type { BlockInstance, LayoutSection } from '../../types/studio';
import { BlockRenderer } from '../blocks/BlockRenderer';
import { IconButton } from '../common/Primitives';
import { BlockInspector } from './BlockInspector';
import { cx } from '../../utils/format';

interface BlockFrameProps {
  block: BlockInstance;
  section: LayoutSection;
  editor: StudioEditor;
  /** Natural content height, in pixels, reported back to the canvas. */
  onMeasure: (blockId: string, px: number) => void;
  /** Grid props injected by react-grid-layout (style, className, children …). */
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}

/**
 * The editing affordance layer. In view mode this is invisible chrome; in edit
 * mode the block reveals its boundary on hover, a grip appears, and selection
 * brings a restrained outline plus contextual actions placed on the block.
 */
export const BlockFrame = forwardRef<HTMLDivElement, BlockFrameProps>(function BlockFrame(
{ block, section, editor, onMeasure, style, className, children, ...rest },
ref)
{
  const { isEditing, selectedBlockId } = editor;
  const selected = isEditing && selectedBlockId === block.id;
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const def = blockMap[block.type];

  useEffect(() => {
    if (!selected) setInspectorOpen(false);
  }, [selected]);

  useEffect(() => {
    const node = measureRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const report = () => onMeasure(block.id, node.scrollHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => observer.disconnect();
  }, [block.id, onMeasure]);

  const hidden = !block.visible;

  return (
    <div
      ref={ref}
      style={style}
      className={cx(className, 'group/frame')}
      onClick={(event) => {
        if (!isEditing) return;
        event.stopPropagation();
        editor.select(block.id);
      }}
      {...rest}>
      
      <div
        className={cx(
          'relative h-full min-h-0 overflow-hidden transition-[box-shadow] duration-140',
          isEditing && 'cursor-default',
          hidden && 'opacity-45'
        )}
        style={{ borderRadius: 'var(--studio-radius)' }}>
        
        {/* Boundary + selection outline, drawn over the block so layout never shifts */}
        {isEditing &&
        <span
          aria-hidden
          className={cx(
            'pointer-events-none absolute inset-0 z-10 rounded-[inherit] ring-1 ring-inset transition-colors duration-140',
            selected ?
            'ring-[var(--user-accent)]' :
            'ring-transparent group-hover/frame:ring-border-strong'
          )} />

        }

        <div ref={measureRef} className="flex min-h-full [&>*]:min-w-0 [&>*]:flex-1">
          <BlockRenderer
            block={block}
            editing={isEditing}
            onPropsChange={(patch) => editor.updateBlockProps(block.id, patch)} />
          
        </div>

        {isEditing &&
        <>
            {/* Drag grip — the only thing react-grid-layout will start a drag from */}
            <button
            type="button"
            aria-label={`Move ${def.label}`}
            title="Drag to move"
            className={cx(
              'block-drag-handle t-focus absolute left-1 top-1 z-20 flex h-6 w-5 cursor-grab items-center justify-center rounded-sm border text-muted-foreground opacity-0 transition-opacity duration-140',
              'border-border bg-[var(--surface-elevated)] group-hover/frame:opacity-100 focus-visible:opacity-100 active:cursor-grabbing',
              selected && 'opacity-100'
            )}>
            
              <GripVertical className="h-3.5 w-3.5" aria-hidden />
            </button>

            {hidden &&
          <span className="absolute right-1 top-1 z-20 rounded-sm border border-border bg-[var(--surface-elevated)] px-1.5 py-0.5 font-mono text-3xs uppercase tracking-widest text-muted-foreground">
                hidden
              </span>
          }

            {/* Contextual actions sit on the selected block, not in a global bar */}
            {selected &&
          <div
            className="absolute -top-3.5 right-1 z-30 flex items-center gap-0.5 rounded-sm border border-border bg-[var(--popover)] px-1 py-0.5 shadow-panel"
            onClick={(event) => event.stopPropagation()}>
            
                <span className="t-label max-w-[110px] truncate pr-1">{def.label}</span>
                <IconButton
              label="Block settings"
              active={inspectorOpen}
              onClick={() => setInspectorOpen((open) => !open)}>
              
                  <Settings2 className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton
              label={block.visible ? 'Hide from public Studio' : 'Show in public Studio'}
              onClick={() => editor.toggleBlockVisible(block.id)}>
              
                  {block.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </IconButton>
                <IconButton label="Duplicate block" onClick={() => editor.duplicateBlock(block.id)}>
                  <Copy className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label="Remove block" tone="danger" onClick={() => editor.deleteBlock(block.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
          }

            {selected && inspectorOpen &&
          <div className="absolute right-1 top-4 z-40">
                <BlockInspector
              block={block}
              sections={editor.page.layout.sections}
              currentSectionId={section.id}
              onProps={(patch) => editor.updateBlockProps(block.id, patch)}
              onMove={(sectionId) => {
                editor.moveBlock(block.id, sectionId);
                setInspectorOpen(false);
              }} />
            
              </div>
          }
          </>
        }
      </div>
      {children}
    </div>);

});