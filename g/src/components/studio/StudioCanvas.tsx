import React from 'react';
import { Plus } from 'lucide-react';
import type { StudioEditor } from '../../hooks/useStudioEditor';
import type { BlockType } from '../../types/studio';
import { SectionBand } from './SectionBand';
import { structureMaxWidth } from '../../utils/studioStyle';
import { cx } from '../../utils/format';

interface StudioCanvasProps {
  editor: StudioEditor;
  dragType: BlockType | null;
  onRequestPalette: (sectionId: string) => void;
  directManipulation: boolean;
  /** Constrain the canvas to a device width in preview mode. */
  frameWidth?: number;
}

export function StudioCanvas({
  editor,
  dragType,
  onRequestPalette,
  directManipulation,
  frameWidth
}: StudioCanvasProps) {
  const { page, isEditing } = editor;
  const sections = page.layout.sections;
  const maxWidth = frameWidth ?? structureMaxWidth(page.config);

  return (
    <div
      className={cx('mx-auto w-full px-4 pb-24 pt-5 sm:px-6', isEditing && 'pb-40')}
      style={{ maxWidth }}
      onClick={() => isEditing && editor.select(null)}>
      
      <div className="flex flex-col" style={{ gap: 'calc(var(--studio-gap) * 1.6)' }}>
        {sections.map((section, index) =>
        <React.Fragment key={section.id}>
            <SectionBand
            section={section}
            index={index}
            total={sections.length}
            editor={editor}
            dragType={dragType}
            directManipulation={directManipulation}
            onRequestPalette={onRequestPalette} />
          
          </React.Fragment>
        )}

        {isEditing &&
        <button
          type="button"
          onClick={editor.addSection}
          className="t-focus group/section flex items-center justify-center gap-1.5 border border-dashed border-border py-3 font-mono text-2xs uppercase tracking-widest text-muted-foreground hover:border-[var(--user-accent-border)] hover:text-[var(--user-accent)]"
          style={{ borderRadius: 'var(--studio-radius)' }}>
          
            <Plus className="h-3.5 w-3.5" aria-hidden /> New area
          </button>
        }
      </div>
    </div>);

}