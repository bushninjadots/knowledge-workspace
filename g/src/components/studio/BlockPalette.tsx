import React, { useState } from 'react';
import { GripHorizontal, X } from 'lucide-react';
import { blockCatalog, categoryHints, categoryLabels, categoryOrder } from '../../data/blockCatalog';
import type { StudioEditor } from '../../hooks/useStudioEditor';
import type { BlockType } from '../../types/studio';
import { IconButton, Rule } from '../common/Primitives';
import { cx } from '../../utils/format';

interface BlockPaletteProps {
  editor: StudioEditor;
  targetSectionId: string;
  onTargetChange: (sectionId: string) => void;
  onDragTypeChange: (type: BlockType | null) => void;
  onClose: () => void;
}

/**
 * Add blocks by dragging them onto the canvas, or by clicking to drop them
 * into the chosen area. No permanent toolbar — the palette is a drawer.
 */
export function BlockPalette({
  editor,
  targetSectionId,
  onTargetChange,
  onDragTypeChange,
  onClose
}: BlockPaletteProps) {
  const [query, setQuery] = useState('');
  const sections = editor.page.layout.sections;
  const filtered = blockCatalog.filter((def) =>
  (def.label + def.description).toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <aside
      aria-label="Add blocks"
      className="flex h-full w-[300px] flex-col border-l border-border bg-[var(--surface-elevated)]">
      
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="t-label">Add to Studio</h2>
        <IconButton label="Close palette" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </header>

      <div className="space-y-2 border-b border-border px-3 py-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search blocks"
          aria-label="Search blocks"
          className="t-focus w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs outline-none placeholder:text-muted-foreground-subtle focus:border-[var(--user-accent-border)]" />
        
        <label className="block">
          <span className="t-label">Drop into</span>
          <select
            value={targetSectionId}
            onChange={(event) => onTargetChange(event.target.value)}
            className="t-focus mt-1 w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs outline-none focus:border-[var(--user-accent-border)]">
            
            {sections.map((section) =>
            <option key={section.id} value={section.id}>
                {section.title}
              </option>
            )}
          </select>
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto t-scroll px-3 py-2">
        {categoryOrder.map((category) => {
          const items = filtered.filter((def) => def.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category} className="mb-4">
              <p className="t-label">{categoryLabels[category]}</p>
              <p className="mb-2 text-2xs leading-snug text-muted-foreground-subtle">{categoryHints[category]}</p>
              <ul className="space-y-1">
                {items.map((def) =>
                <li key={def.type}>
                    <button
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', def.type);
                      event.dataTransfer.effectAllowed = 'copy';
                      onDragTypeChange(def.type);
                    }}
                    onDragEnd={() => onDragTypeChange(null)}
                    onClick={() => editor.addBlock(targetSectionId, def.type)}
                    className={cx(
                      't-focus group/item flex w-full cursor-grab items-start gap-2 rounded-sm border border-border bg-[var(--surface)] px-2 py-1.5 text-left',
                      'hover:border-[var(--user-accent-border)] hover:bg-[var(--user-accent-subtle)] active:cursor-grabbing'
                    )}>
                    
                      <GripHorizontal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground-subtle" aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-foreground">{def.label}</span>
                        <span className="block text-2xs leading-snug text-muted-foreground-subtle">
                          {def.description}
                        </span>
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-3xs text-muted-foreground-subtle">
                        {def.defaultW}×{def.defaultH}
                      </span>
                    </button>
                  </li>
                )}
              </ul>
            </div>);

        })}
        {filtered.length === 0 &&
        <p className="py-6 text-center text-xs text-muted-foreground-subtle">No blocks match “{query}”.</p>
        }
      </div>

      <Rule />
      <p className="px-3 py-2 text-2xs leading-snug text-muted-foreground-subtle">
        Drag a block onto the canvas to place it exactly, or click to drop it into the chosen area.
      </p>
    </aside>);

}