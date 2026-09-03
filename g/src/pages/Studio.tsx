import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Pencil } from 'lucide-react';
import { useStudioEditor } from '../hooks/useStudioEditor';
import { useMediaQuery } from '../hooks/useMediaQuery';
import type { BlockType, StudioMode } from '../types/studio';
import { BlockPalette } from '../components/studio/BlockPalette';
import { CustomizePanel } from '../components/studio/CustomizePanel';
import { MobileEditSheet } from '../components/studio/MobileEditSheet';
import { StarterPicker } from '../components/studio/StarterPicker';
import { StudioCanvas } from '../components/studio/StudioCanvas';
import { StudioTopBar } from '../components/studio/StudioTopBar';
import { Button } from '../components/common/Primitives';
import { structureMaxWidth, studioStyle } from '../utils/studioStyle';
import { cx } from '../utils/format';

const DEVICE_WIDTH = { desktop: 0, tablet: 834, mobile: 390 } as const;

export function Studio({ initialMode = 'view' }: {initialMode?: StudioMode;}) {
  const editor = useStudioEditor();
  const isCompact = useMediaQuery('(max-width: 1023px)');
  const isTouch = useMediaQuery('(pointer: coarse)');
  const [dragType, setDragType] = useState<BlockType | null>(null);
  const [paletteTarget, setPaletteTarget] = useState('sec-building');
  const starterPrompted = useRef(false);
  const bootstrapped = useRef(false);

  const { page, mode, isEditing } = editor;
  const directManipulation = !isCompact && !isTouch;

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (initialMode !== 'view') editor.setMode(initialMode);
  }, [editor, initialMode]);

  /* First time in the canvas with no starting point chosen — offer one. */
  useEffect(() => {
    if (mode === 'edit' && !page.config.starterId && !starterPrompted.current) {
      starterPrompted.current = true;
      editor.setStarterPickerOpen(true);
    }
  }, [editor, mode, page.config.starterId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
      target && (
      target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) editor.redo();else
        editor.undo();
        return;
      }
      if (typing) return;
      if (event.key === 'Escape') {
        if (editor.selectedBlockId) editor.select(null);else
        if (mode !== 'view') editor.setMode('view');
        return;
      }
      if (event.key === 'e') editor.setMode(mode === 'edit' ? 'view' : 'edit');
      if (event.key === 'p') editor.setMode(mode === 'preview' ? 'edit' : 'preview');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editor, mode]);

  const deviceWidth = mode === 'preview' ? DEVICE_WIDTH[editor.previewDevice] : 0;
  const canvasWidth = deviceWidth || structureMaxWidth(page.config);

  return (
    <div
      data-personality={page.config.personality}
      className="flex h-full min-h-full flex-col"
      style={studioStyle(page.config, isEditing ? 'app' : 'public')}>
      
      <StudioTopBar editor={editor} compact={isCompact} />

      {mode === 'view' &&
      <div className="flex items-center gap-2 border-b border-border bg-[var(--surface)] px-3 py-1.5">
          <span className="t-label">Your Studio, as others see it</span>
          <span className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => editor.setMode('preview')}>
              <ExternalLink className="h-3 w-3" aria-hidden /> Public view
            </Button>
            <Button size="sm" variant="primary" onClick={() => editor.setMode('edit')}>
              <Pencil className="h-3 w-3" aria-hidden /> Edit Studio
            </Button>
          </span>
        </div>
      }

      <div className="flex min-h-0 flex-1">
        {isEditing && editor.customizeOpen && !isCompact &&
        <CustomizePanel
          editor={editor}
          onClose={() => editor.setCustomizeOpen(false)}
          onOpenStarters={() => editor.setStarterPickerOpen(true)} />

        }

        <main
          className={cx('min-w-0 flex-1 overflow-y-auto t-scroll', mode === 'preview' && 'bg-[var(--surface-sunken)]')}>
          
          {mode === 'preview' && deviceWidth ?
          <div className="flex justify-center py-6">
              <div
              className="overflow-hidden border border-border-strong bg-[var(--background)] shadow-panel"
              style={{ width: deviceWidth, borderRadius: 'var(--studio-radius)' }}>
              
                <StudioCanvas
                editor={editor}
                dragType={null}
                directManipulation={false}
                frameWidth={deviceWidth}
                onRequestPalette={setPaletteTarget} />
              
              </div>
            </div> :

          <StudioCanvas
            editor={editor}
            dragType={dragType}
            directManipulation={directManipulation}
            frameWidth={mode === 'preview' ? canvasWidth : undefined}
            onRequestPalette={(sectionId) => {
              setPaletteTarget(sectionId);
              editor.setPaletteOpen(true);
            }} />

          }
        </main>

        {isEditing && editor.paletteOpen && !isCompact &&
        <BlockPalette
          editor={editor}
          targetSectionId={paletteTarget}
          onTargetChange={setPaletteTarget}
          onDragTypeChange={setDragType}
          onClose={() => editor.setPaletteOpen(false)} />

        }
      </div>

      {isEditing && isCompact && <MobileEditSheet editor={editor} />}

      {editor.starterPickerOpen &&
      <StarterPicker
        currentId={page.config.starterId}
        canUndo={editor.canUndo}
        onUndo={editor.undo}
        onChoose={editor.chooseStarter}
        onClose={() => editor.setStarterPickerOpen(false)} />

      }
    </div>);

}