import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Sliders, Sparkles, Trash2, X } from 'lucide-react';
import { blockCatalog, blockMap, categoryLabels, categoryOrder } from '../../data/blockCatalog';
import type { StudioEditor } from '../../hooks/useStudioEditor';
import type { BlockType, DensityId, PersonalityId, StructureId } from '../../types/studio';
import { Button, IconButton, Segmented } from '../common/Primitives';
import { cx } from '../../utils/format';

type Tab = 'arrange' | 'add' | 'feel';

/**
 * A deliberate mobile editing model. Free-form drag and pixel resizing are a
 * lie on touch, so mobile gets honest controls instead: ordered lists with
 * explicit move/hide/remove, a width stepper, and a bottom editing surface.
 * The public Studio still renders the real layout.
 */
export function MobileEditSheet({ editor }: {editor: StudioEditor;}) {
  const [tab, setTab] = useState<Tab>('arrange');
  const [open, setOpen] = useState(true);
  const { page } = editor;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-sm border border-border bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium text-foreground shadow-panel">
        
        Edit Studio
      </button>);

  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 max-h-[62vh] border-t border-border bg-[var(--surface-elevated)] shadow-panel">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span aria-hidden className="mx-auto h-1 w-9 rounded-full bg-border-strong sm:hidden" />
        <div className="flex flex-1 items-center gap-1">
          <TabButton active={tab === 'arrange'} onClick={() => setTab('arrange')}>
            Arrange
          </TabButton>
          <TabButton active={tab === 'add'} onClick={() => setTab('add')}>
            <Plus className="h-3 w-3" aria-hidden /> Add
          </TabButton>
          <TabButton active={tab === 'feel'} onClick={() => setTab('feel')}>
            <Sliders className="h-3 w-3" aria-hidden /> Feel
          </TabButton>
        </div>
        <IconButton label="Close editing surface" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      <div className="max-h-[48vh] overflow-y-auto t-scroll px-3 py-2">
        {tab === 'arrange' &&
        <>
          <p className="mb-2 text-2xs leading-snug text-muted-foreground-subtle">
            Move, hide and remove blocks here. Widths apply to the wide layout — on a phone the public Studio always
            stacks in this order.
          </p>
          <ul className="space-y-3">
            {page.layout.sections.map((section, index) =>
            <li key={section.id}>
                <div className="flex items-center gap-1">
                  <span className="t-label min-w-0 flex-1 truncate">{section.title}</span>
                  <IconButton
                  label="Move section up"
                  disabled={index === 0}
                  onClick={() => editor.nudgeSection(section.id, -1)}>
                  
                    <ChevronUp className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                  label="Move section down"
                  disabled={index === page.layout.sections.length - 1}
                  onClick={() => editor.nudgeSection(section.id, 1)}>
                  
                    <ChevronDown className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                  label={section.visible ? 'Hide section' : 'Show section'}
                  onClick={() => editor.toggleSectionVisible(section.id)}>
                  
                    {section.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </IconButton>
                </div>
                <ul className="mt-1 divide-y divide-border border-y border-border">
                  {section.blocks.map((block) =>
                <li key={block.id} className="flex items-center gap-2 py-2">
                      <button
                    type="button"
                    onClick={() => editor.select(block.id)}
                    className={cx(
                      't-focus min-w-0 flex-1 rounded-sm px-1 py-0.5 text-left text-xs',
                      editor.selectedBlockId === block.id ?
                      'bg-[var(--user-accent-subtle)] text-[var(--user-accent)]' :
                      'text-foreground'
                    )}>
                    
                        <span className="block truncate">{block.props.title ?? blockMap[block.type].label}</span>
                      </button>
                      <WidthStepper editor={editor} sectionId={section.id} blockId={block.id} />
                      <IconButton
                    label={block.visible ? 'Hide block' : 'Show block'}
                    onClick={() => editor.toggleBlockVisible(block.id)}>
                    
                        {block.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </IconButton>
                      <IconButton label="Remove block" tone="danger" onClick={() => editor.deleteBlock(block.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </li>
                )}
                </ul>
              </li>
            )}
          </ul>
          </>
        }

        {tab === 'add' &&
        <div className="space-y-3">
            <label className="block">
              <span className="t-label">Add to</span>
              <select
              aria-label="Target area"
              id="mobile-target-area"
              className="t-focus mt-1 w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1.5 text-xs outline-none">
              
                {page.layout.sections.map((section) =>
              <option key={section.id} value={section.id}>
                    {section.title}
                  </option>
              )}
              </select>
            </label>
            {categoryOrder.map((category) =>
          <div key={category}>
                <p className="t-label mb-1">{categoryLabels[category]}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {blockCatalog.
              filter((def) => def.category === category).
              map((def) =>
              <button
                key={def.type}
                type="button"
                onClick={() => {
                  const select = document.getElementById('mobile-target-area') as HTMLSelectElement | null;
                  const target = select?.value ?? page.layout.sections[0]?.id;
                  if (target) editor.addBlock(target, def.type as BlockType);
                }}
                className="t-focus rounded-sm border border-border px-2 py-2 text-left text-xs text-foreground hover:border-[var(--user-accent-border)]">
                
                        {def.label}
                      </button>
              )}
                </div>
              </div>
          )}
          </div>
        }

        {tab === 'feel' &&
        <div className="space-y-3 pb-2">
            <div>
              <p className="t-label mb-1">Structure</p>
              <Segmented<StructureId>
              full
              ariaLabel="Structure"
              value={page.config.structure}
              onChange={(structure) => editor.setConfig({ structure })}
              options={[
              { value: 'single', label: 'Column' },
              { value: 'sidebar', label: 'Balanced' },
              { value: 'wide', label: 'Wide' }]
              } />
            
            </div>
            <div>
              <p className="t-label mb-1">Personality</p>
              <Segmented<PersonalityId>
              full
              ariaLabel="Personality"
              value={page.config.personality}
              onChange={(personality) => editor.setConfig({ personality })}
              options={[
              { value: 'modern', label: 'Modern' },
              { value: 'editorial', label: 'Editorial' },
              { value: 'technical', label: 'Technical' }]
              } />
            
            </div>
            <div>
              <p className="t-label mb-1">Density</p>
              <Segmented<DensityId>
              full
              ariaLabel="Density"
              value={page.config.density}
              onChange={(density) => editor.setConfig({ density })}
              options={[
              { value: 'compact', label: 'Compact' },
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'spacious', label: 'Spacious' }]
              } />
            
            </div>
            <Button variant="ghost" size="sm" onClick={() => editor.setStarterPickerOpen(true)} className="w-full">
              <Sparkles className="h-3 w-3" aria-hidden /> Choose a starting feel
            </Button>
          </div>
        }
      </div>
    </div>);

}

function TabButton({
  active,
  onClick,
  children




}: {active: boolean;onClick: () => void;children: React.ReactNode;}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        't-focus flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium',
        active ? 'bg-[var(--user-accent-subtle)] text-[var(--user-accent)]' : 'text-muted-foreground'
      )}>
      
      {children}
    </button>);

}

/** Honest touch resizing: a width stepper in grid columns, not a fake handle. */
function WidthStepper({
  editor,
  sectionId,
  blockId




}: {editor: StudioEditor;sectionId: string;blockId: string;}) {
  const section = editor.page.layout.sections.find((s) => s.id === sectionId);
  const item = section?.grid.find((g) => g.i === blockId);
  if (!item) return null;
  const setWidth = (w: number) => {
    editor.beginInteraction('Resized a block');
    editor.applyGrid(
      sectionId,
      (section?.grid ?? []).map((g) => g.i === blockId ? { ...g, w: Math.max(item.minW ?? 2, Math.min(12, w)) } : g)
    );
  };
  return (
    <span className="flex shrink-0 items-center gap-0.5 rounded-sm border border-border">
      <IconButton label="Narrower" onClick={() => setWidth(item.w - 2)} disabled={item.w <= (item.minW ?? 2)}>
        <span aria-hidden className="text-xs">
          −
        </span>
      </IconButton>
      <span className="w-6 text-center font-mono text-2xs text-muted-foreground">{item.w}</span>
      <IconButton label="Wider" onClick={() => setWidth(item.w + 2)} disabled={item.w >= 12}>
        <span aria-hidden className="text-xs">
          +
        </span>
      </IconButton>
    </span>);

}