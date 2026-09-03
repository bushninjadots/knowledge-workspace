import React from 'react';
import { Eye, EyeOff, RotateCcw, Sparkles, X } from 'lucide-react';
import { blockMap } from '../../data/blockCatalog';
import { starterMap } from '../../data/starters';
import type { StudioEditor } from '../../hooks/useStudioEditor';
import type { AccentMode, BackgroundId, DensityId, PersonalityId, RadiusId, StructureId } from '../../types/studio';
import { Button, IconButton, Rule, Segmented } from '../common/Primitives';
import { BANNER_ACCENT } from '../../utils/studioStyle';
import { cx } from '../../utils/format';

const ACCENT_SWATCHES = ['#3f8f8a', '#2f6fd0', '#7a4ecf', '#b4632a', '#2f7d4a', '#1f2328'];

/**
 * One coherent customization model. Five decisions, in the order a person
 * actually thinks about them — not six competing configuration systems.
 */
export function CustomizePanel({
  editor,
  onClose,
  onOpenStarters




}: {editor: StudioEditor;onClose: () => void;onOpenStarters: () => void;}) {
  const { config } = editor.page;
  const starter = config.starterId ? starterMap[config.starterId] : null;

  return (
    <aside
      aria-label="Customize Studio"
      className="flex h-full w-[300px] flex-col border-r border-border bg-[var(--surface-elevated)]">
      
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="t-label">Customize</h2>
        <IconButton label="Close customize" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto t-scroll">
        <div className="border-b border-border px-3 py-2.5">
          <p className="t-label mb-1">Starting point</p>
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 text-xs text-foreground">
              {starter ? starter.name : 'Custom'}
              <span className="block truncate text-2xs text-muted-foreground-subtle">
                {starter ? starter.tagline : 'Built from your own choices'}
              </span>
            </p>
            <Button size="sm" variant="ghost" onClick={onOpenStarters}>
              <Sparkles className="h-3 w-3" aria-hidden /> Change
            </Button>
          </div>
        </div>

        <Group title="Structure" hint="How the Studio is arranged.">
          <Segmented<StructureId>
            full
            ariaLabel="Structure"
            value={config.structure}
            onChange={(structure) => editor.setConfig({ structure })}
            options={[
            { value: 'single', label: 'Column' },
            { value: 'sidebar', label: 'Balanced' },
            { value: 'wide', label: 'Wide' }]
            } />
          
          <p className="mt-1.5 text-2xs text-muted-foreground-subtle">
            {config.structure === 'single' ?
            'One narrow column. Everything reads in order.' :
            config.structure === 'sidebar' ?
            'A medium measure that lets blocks sit side by side.' :
            'Full width — room for three columns of signals.'}
          </p>
        </Group>

        <Group title="Personality" hint="Typography, density and visual character.">
          <Segmented<PersonalityId>
            full
            ariaLabel="Personality"
            value={config.personality}
            onChange={(personality) => editor.setConfig({ personality })}
            options={[
            { value: 'modern', label: 'Modern' },
            { value: 'editorial', label: 'Editorial' },
            { value: 'technical', label: 'Technical' }]
            } />
          
          <div className="mt-2 space-y-2">
            <Sub label="Density">
              <Segmented<DensityId>
                full
                size="sm"
                ariaLabel="Density"
                value={config.density}
                onChange={(density) => editor.setConfig({ density })}
                options={[
                { value: 'compact', label: 'Compact' },
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'spacious', label: 'Spacious' }]
                } />
              
            </Sub>
            <Sub label="Corners">
              <Segmented<RadiusId>
                full
                size="sm"
                ariaLabel="Corner radius"
                value={config.radius}
                onChange={(radius) => editor.setConfig({ radius })}
                options={[
                { value: 'sharp', label: 'Sharp' },
                { value: 'soft', label: 'Soft' }]
                } />
              
            </Sub>
          </div>
        </Group>

        <Group title="Accent" hint="Your identity colour, used only where it means something.">
          <Segmented<AccentMode>
            full
            ariaLabel="Accent source"
            value={config.accentMode}
            onChange={(accentMode) => editor.setConfig({ accentMode })}
            options={[
            { value: 'auto', label: 'From banner' },
            { value: 'custom', label: 'Pick' },
            { value: 'none', label: 'None' }]
            } />
          
          {config.accentMode === 'auto' &&
          <p className="mt-2 flex items-center gap-2 text-2xs text-muted-foreground-subtle">
              <span
              className="h-4 w-4 shrink-0 rounded-sm border border-border"
              style={{ backgroundColor: BANNER_ACCENT }}
              aria-hidden />
            
              Derived from your banner image.
            </p>
          }
          {config.accentMode === 'custom' &&
          <div className="mt-2 flex flex-wrap gap-1.5">
              {ACCENT_SWATCHES.map((swatch) =>
            <button
              key={swatch}
              type="button"
              aria-label={`Accent ${swatch}`}
              aria-pressed={config.accentColor.toLowerCase() === swatch}
              onClick={() => editor.setConfig({ accentColor: swatch })}
              className={cx(
                't-focus h-6 w-6 rounded-sm border-2',
                config.accentColor.toLowerCase() === swatch ? 'border-foreground' : 'border-border'
              )}
              style={{ backgroundColor: swatch }} />

            )}
            </div>
          }
        </Group>

        <Group title="Background" hint="The app shell and the public Studio can differ.">
          <Sub label="While editing">
            <BackgroundChoice
              value={config.appBackground}
              onChange={(appBackground) => editor.setConfig({ appBackground })} />
            
          </Sub>
          <Sub label="Public Studio">
            <BackgroundChoice
              value={config.publicBackground}
              onChange={(publicBackground) => editor.setConfig({ publicBackground })} />
            
          </Sub>
        </Group>

        <Group title="Content" hint="What appears. Hiding never deletes.">
          <ul className="space-y-2">
            {editor.page.layout.sections.map((section) =>
            <li key={section.id}>
                <div className="flex items-center gap-1.5">
                  <button
                  type="button"
                  onClick={() => editor.toggleSectionVisible(section.id)}
                  aria-label={section.visible ? `Hide ${section.title}` : `Show ${section.title}`}
                  className="t-focus flex min-w-0 flex-1 items-center gap-1.5 rounded-sm px-1 py-0.5 text-left hover:bg-[var(--surface-sunken)]">
                  
                    {section.visible ?
                  <Eye className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden /> :

                  <EyeOff className="h-3 w-3 shrink-0 text-muted-foreground-subtle" aria-hidden />
                  }
                    <span
                    className={cx(
                      'truncate text-xs',
                      section.visible ? 'text-foreground' : 'text-muted-foreground-subtle line-through'
                    )}>
                    
                      {section.title}
                    </span>
                  </button>
                </div>
                <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
                  {section.blocks.map((block) =>
                <li key={block.id}>
                      <button
                    type="button"
                    onClick={() => {
                      editor.select(block.id);
                      editor.toggleBlockVisible(block.id);
                    }}
                    className="t-focus flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left hover:bg-[var(--surface-sunken)]">
                    
                        {block.visible ?
                    <Eye className="h-3 w-3 shrink-0 text-muted-foreground-subtle" aria-hidden /> :

                    <EyeOff className="h-3 w-3 shrink-0 text-muted-foreground-subtle" aria-hidden />
                    }
                        <span
                      className={cx(
                        'truncate text-2xs',
                        block.visible ? 'text-muted-foreground' : 'text-muted-foreground-subtle line-through'
                      )}>
                      
                          {block.props.title ?? blockMap[block.type].label}
                        </span>
                      </button>
                    </li>
                )}
                </ul>
              </li>
            )}
          </ul>
        </Group>
      </div>

      <Rule />
      <div className="px-3 py-2">
        <Button size="sm" variant="ghost" onClick={editor.reset} className="w-full">
          <RotateCcw className="h-3 w-3" aria-hidden /> Reset to default Studio
        </Button>
      </div>
    </aside>);

}

function BackgroundChoice({ value, onChange }: {value: BackgroundId;onChange: (next: BackgroundId) => void;}) {
  return (
    <Segmented<BackgroundId>
      full
      size="sm"
      ariaLabel="Background"
      value={value}
      onChange={onChange}
      options={[
      { value: 'default', label: 'Paper' },
      { value: 'surface', label: 'Surface' },
      { value: 'sunken', label: 'Sunken' }]
      } />);


}

function Group({ title, hint, children }: {title: string;hint: string;children: React.ReactNode;}) {
  return (
    <section className="border-b border-border px-3 py-3">
      <h3 className="t-label">{title}</h3>
      <p className="mb-2 text-2xs leading-snug text-muted-foreground-subtle">{hint}</p>
      {children}
    </section>);

}

function Sub({ label, children }: {label: string;children: React.ReactNode;}) {
  return (
    <div className="mt-2">
      <p className="mb-1 font-mono text-3xs uppercase tracking-widest text-muted-foreground-subtle">{label}</p>
      {children}
    </div>);

}