import React from 'react';
import { Undo2, X } from 'lucide-react';
import { starters } from '../../data/starters';
import type { StarterId } from '../../types/studio';
import { Button } from '../common/Primitives';
import { cx } from '../../utils/format';

/**
 * "Choose how you want your Studio to feel."
 *
 * A starting direction, not a template that eats your work: applying one
 * rearranges and re-dresses what you already have, and it is one undo away.
 */
export function StarterPicker({
  currentId,
  onChoose,
  onClose,
  canUndo,
  onUndo






}: {currentId: StarterId | null;onChoose: (id: StarterId) => void;onClose: () => void;canUndo: boolean;onUndo: () => void;}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose how your Studio feels"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'color-mix(in oklab, var(--background) 82%, transparent)' }}
      onClick={onClose}>
      
      <div
        className="max-h-full w-full max-w-3xl overflow-y-auto t-scroll border border-border bg-[var(--surface-elevated)] shadow-panel"
        style={{ borderRadius: 'var(--studio-radius)' }}
        onClick={(event) => event.stopPropagation()}>
        
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="t-heading text-[18px] font-semibold text-foreground">
              Choose how you want your Studio to feel
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              A starting direction. It rearranges what you already have — nothing is deleted, and one undo puts it back.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="t-focus -mr-1 -mt-1 rounded-sm p-1 text-muted-foreground hover:text-foreground">
            
            <X className="h-4 w-4" />
          </button>
        </header>

        <ul className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {starters.map((starter) => {
            const active = starter.id === currentId;
            return (
              <li key={starter.id} className="bg-[var(--surface-elevated)]">
                <button
                  type="button"
                  onClick={() => onChoose(starter.id)}
                  aria-pressed={active}
                  className={cx(
                    't-focus flex h-full w-full flex-col gap-3 p-4 text-left transition-colors duration-140',
                    active ? 'bg-[var(--user-accent-subtle)]' : 'hover:bg-[var(--surface)]'
                  )}>
                  
                  <Sketch rows={starter.sketch} active={active} />
                  <div>
                    <p className="flex items-baseline gap-2">
                      <span className="t-heading text-[14px] font-semibold text-foreground">{starter.name}</span>
                      {active && <span className="t-label text-[var(--user-accent)]">current</span>}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-foreground">{starter.tagline}</p>
                    <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{starter.feels}</p>
                  </div>
                </button>
              </li>);

          })}
        </ul>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="text-2xs text-muted-foreground-subtle">
            You can change any of this directly on the canvas afterwards.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" disabled={!canUndo} onClick={onUndo}>
              <Undo2 className="h-3 w-3" aria-hidden /> Undo last change
            </Button>
            <Button size="sm" variant="secondary" onClick={onClose}>
              Keep what I have
            </Button>
          </div>
        </footer>
      </div>
    </div>);

}

function Sketch({ rows, active }: {rows: number[][];active: boolean;}) {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-1 border border-border bg-[var(--surface-sunken)] p-2"
      style={{ borderRadius: 'var(--studio-radius)' }}>
      
      {rows.map((row, rowIndex) =>
      <div key={rowIndex} className="flex gap-1">
          {row.map((span, spanIndex) =>
        <span
          key={`${rowIndex}-${spanIndex}`}
          className="h-3 rounded-sm"
          style={{
            flex: span,
            backgroundColor: active ?
            'var(--user-accent)' :
            rowIndex === 1 ?
            'var(--border-strong)' :
            'var(--border)'
          }} />

        )}
        </div>
      )}
    </div>);

}