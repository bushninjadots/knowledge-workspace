import React from 'react';
import { blockMap } from '../../data/blockCatalog';
import type { BlockInstance, LayoutSection, ProjectFilter, ProjectPresentation } from '../../types/studio';
import { Rule, Segmented, SwitchRow } from '../common/Primitives';

/**
 * Contextual inspector — appears next to the selected block, never as a
 * permanent sidebar. It only exposes what this block type actually has.
 */
export function BlockInspector({
  block,
  sections,
  currentSectionId,
  onProps,
  onMove






}: {block: BlockInstance;sections: LayoutSection[];currentSectionId: string;onProps: (patch: Partial<BlockInstance['props']>) => void;onMove: (sectionId: string) => void;}) {
  const def = blockMap[block.type];
  return (
    <div
      className="w-[260px] border border-border bg-[var(--popover)] p-2.5 shadow-panel"
      style={{ borderRadius: 'var(--studio-radius)' }}
      onClick={(event) => event.stopPropagation()}>
      
      <p className="t-label mb-2">{def.label}</p>

      {block.type === 'profile-projects' &&
      <div className="space-y-2.5">
          <Field label="Shelf">
            <Segmented<ProjectFilter>
            full
            size="sm"
            ariaLabel="Which projects"
            value={(block.props.filter ?? 'building') as ProjectFilter}
            onChange={(filter) => onProps({ filter })}
            options={[
            { value: 'building', label: 'Building' },
            { value: 'contributing', label: 'Contributing' },
            { value: 'created', label: 'Created' }]
            } />
          
          </Field>
          <Field label="Presentation">
            <div className="grid grid-cols-2 gap-1">
              {(
            [
            { value: 'spotlight', label: 'Spotlight' },
            { value: 'minimal-list', label: 'List' },
            { value: 'editorial-grid', label: 'Grid' },
            { value: 'horizontal-scroll', label: 'Shelf' }] as
            Array<{value: ProjectPresentation;label: string;}>).
            map((option) => {
              const active = (block.props.presentation ?? 'minimal-list') === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onProps({ presentation: option.value })}
                  aria-pressed={active}
                  className={[
                  't-focus rounded-sm border px-2 py-1 text-2xs font-medium',
                  active ?
                  'border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)] text-[var(--user-accent)]' :
                  'border-border text-muted-foreground hover:text-foreground'].
                  join(' ')}>
                  
                    {option.label}
                  </button>);

            })}
            </div>
          </Field>
          <SwitchRow
          label="Collaboration signals"
          hint="Open roles, needs, collaborators"
          checked={block.props.showSignals ?? true}
          onChange={(showSignals) => onProps({ showSignals })} />
        
        </div>
      }

      {block.type !== 'profile-header' &&
      <>
          <Rule className="my-2" />
          <Field label="Label">
            <input
            type="text"
            value={block.props.title ?? ''}
            placeholder={def.label}
            aria-label="Block label"
            onChange={(event) => onProps({ title: event.target.value })}
            className="t-focus w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-1.5 py-1 text-xs text-foreground outline-none focus:border-[var(--user-accent-border)]" />
          
          </Field>
        </>
      }

      <Rule className="my-2" />
      <Field label="Area">
        <div className="space-y-0.5">
          {sections.map((section) =>
          <button
            key={section.id}
            type="button"
            onClick={() => onMove(section.id)}
            disabled={section.id === currentSectionId}
            className={[
            't-focus flex w-full items-center justify-between rounded-sm px-1.5 py-1 text-left text-xs',
            section.id === currentSectionId ?
            'bg-[var(--user-accent-subtle)] text-[var(--user-accent)]' :
            'text-muted-foreground hover:bg-[var(--surface-sunken)] hover:text-foreground'].
            join(' ')}>
            
              <span className="truncate">{section.title}</span>
              {section.kind === 'spine' && <span className="t-label shrink-0">spine</span>}
            </button>
          )}
        </div>
      </Field>
    </div>);

}

function Field({ label, children }: {label: string;children: React.ReactNode;}) {
  return (
    <div>
      <p className="t-label mb-1">{label}</p>
      {children}
    </div>);

}