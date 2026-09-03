import React, { useState } from 'react';
import {
  Eye,
  History,
  Layers,
  Monitor,
  Pencil,
  Redo2,
  Smartphone,
  Sliders,
  Sparkles,
  Tablet,
  Undo2,
  Upload } from
'lucide-react';
import type { StudioEditor } from '../../hooks/useStudioEditor';
import type { PreviewDevice, StudioMode } from '../../types/studio';
import { Button, Chip, IconButton, Segmented } from '../common/Primitives';
import { cx, shortDate } from '../../utils/format';

/**
 * VIEW → EDIT → PREVIEW lives here and nowhere else. Everything else on the
 * bar is contextual to the current mode; the canvas stays the editor.
 */
export function StudioTopBar({ editor, compact }: {editor: StudioEditor;compact: boolean;}) {
  const { page, mode } = editor;
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-[var(--surface-elevated)]">
      <div className="flex h-11 items-center gap-2 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-2xs font-semibold uppercase tracking-[0.18em] text-foreground">Tethyr</span>
          <span className="text-muted-foreground-subtle" aria-hidden>
            /
          </span>
          <span className="t-heading truncate text-[13px] font-semibold text-foreground">Studio</span>
          {!compact &&
          <span className="truncate font-mono text-2xs text-muted-foreground-subtle">
              tethyr.to/u/ivomarchetti
            </span>
          }
          {page.status === 'published' ?
          <Chip token={editor.hasUnpublishedChanges ? 'caution' : 'trust'} dot>
              {editor.hasUnpublishedChanges ? 'Unpublished changes' : `Live · v${page.publishedVersion}`}
            </Chip> :

          <Chip token="caution" dot>
              Draft
            </Chip>
          }
        </div>

        <div className="mx-auto">
          <Segmented<StudioMode>
            ariaLabel="Studio mode"
            value={mode}
            onChange={editor.setMode}
            options={[
            { value: 'view', label: compact ? '' : 'View', srLabel: 'View', icon: <Layers className="h-3.5 w-3.5" /> },
            { value: 'edit', label: compact ? '' : 'Edit', srLabel: 'Edit', icon: <Pencil className="h-3.5 w-3.5" /> },
            {
              value: 'preview',
              label: compact ? '' : 'Preview',
              srLabel: 'Preview',
              icon: <Eye className="h-3.5 w-3.5" />
            }]
            } />
          
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {mode === 'edit' &&
          <>
              <div className="flex items-center gap-0.5 border-r border-border pr-1.5">
                <IconButton label="Undo" disabled={!editor.canUndo} onClick={editor.undo}>
                  <Undo2 className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label="Redo" disabled={!editor.canRedo} onClick={editor.redo}>
                  <Redo2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
              {!compact &&
            <>
                  <Button
                size="sm"
                variant={editor.customizeOpen ? 'accent' : 'ghost'}
                onClick={() => editor.setCustomizeOpen(!editor.customizeOpen)}>
                
                    <Sliders className="h-3 w-3" aria-hidden /> Customize
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => editor.setStarterPickerOpen(true)}>
                    <Sparkles className="h-3 w-3" aria-hidden /> Feel
                  </Button>
                  <Button
                size="sm"
                variant={editor.paletteOpen ? 'accent' : 'secondary'}
                onClick={() => editor.setPaletteOpen(!editor.paletteOpen)}>
                
                    Add block
                  </Button>
                </>
            }
            </>
          }

          {mode === 'preview' &&
          <Segmented<PreviewDevice>
            size="sm"
            ariaLabel="Preview device"
            value={editor.previewDevice}
            onChange={editor.setPreviewDevice}
            options={[
            { value: 'desktop', label: '', srLabel: 'Desktop', icon: <Monitor className="h-3.5 w-3.5" /> },
            { value: 'tablet', label: '', srLabel: 'Tablet', icon: <Tablet className="h-3.5 w-3.5" /> },
            { value: 'mobile', label: '', srLabel: 'Phone', icon: <Smartphone className="h-3.5 w-3.5" /> }]
            } />

          }

          <div className="relative">
            <IconButton
              label="Version history"
              active={historyOpen}
              onClick={() => setHistoryOpen((open) => !open)}>
              
              <History className="h-3.5 w-3.5" />
            </IconButton>
            {historyOpen &&
            <div
              className="absolute right-0 top-8 z-50 w-[280px] border border-border bg-[var(--popover)] p-2 shadow-panel"
              style={{ borderRadius: 'var(--studio-radius)' }}>
              
                <p className="t-label mb-1.5">Published versions</p>
                <ul className="divide-y divide-border">
                  {page.versions.map((version) =>
                <li key={version.version} className="flex items-center gap-2 py-1.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs text-foreground">{version.label}</span>
                        <span className="font-mono text-2xs text-muted-foreground-subtle">
                          v{version.version} · {shortDate(version.publishedAt)}
                        </span>
                      </span>
                      <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      editor.rollback(version.version);
                      setHistoryOpen(false);
                    }}>
                    
                        Restore
                      </Button>
                    </li>
                )}
                </ul>
              </div>
            }
          </div>

          <Button
            size="sm"
            aria-label="Publish Studio"
            variant={editor.hasUnpublishedChanges ? 'primary' : 'secondary'}
            disabled={!editor.hasUnpublishedChanges}
            onClick={editor.publish}>
            
            <Upload className="h-3 w-3" aria-hidden /> {compact ? '' : 'Publish'}
          </Button>
        </div>
      </div>

      {/* A single quiet status line instead of a permanent toolbar */}
      {mode === 'edit' &&
      <div className="flex h-6 items-center gap-2 border-t border-border bg-[var(--surface)] px-3">
          <span className="t-label">Editing</span>
          <span className="text-2xs text-muted-foreground-subtle">
            Drag the grip to move · pull an edge to resize · click a block for its actions
          </span>
          {editor.lastAction &&
        <span className={cx('ml-auto font-mono text-2xs text-muted-foreground')}>{editor.lastAction}</span>
        }
        </div>
      }
    </header>);

}