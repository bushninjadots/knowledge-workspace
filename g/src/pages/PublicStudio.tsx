import React from 'react';
import { Handshake, MessageSquare } from 'lucide-react';
import { profile } from '../data/profile';
import { useStudioEditor } from '../hooks/useStudioEditor';
import { StudioCanvas } from '../components/studio/StudioCanvas';
import { Button, Chip } from '../components/common/Primitives';
import { studioStyle } from '../utils/studioStyle';

/**
 * The public Studio at /u/:handle — the same layout and personality the owner
 * arranged, with no editing chrome at all. This is what PREVIEW shows.
 */
export function PublicStudio() {
  const editor = useStudioEditor();

  return (
    <div
      data-personality={editor.page.config.personality}
      className="flex h-full min-h-full flex-col"
      style={studioStyle(editor.page.config, 'public')}>
      
      <header className="sticky top-0 z-30 border-b border-border bg-[var(--surface-elevated)]">
        <div className="flex h-11 items-center gap-2 px-3">
          <span className="font-mono text-2xs font-semibold uppercase tracking-[0.18em] text-foreground">Tethyr</span>
          <span className="text-muted-foreground-subtle" aria-hidden>
            /
          </span>
          <span className="truncate font-mono text-2xs text-muted-foreground">u/{profile.handle}</span>
          <Chip token="trust" dot>
            Public Studio
          </Chip>
          <span className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="secondary">
              <MessageSquare className="h-3 w-3" aria-hidden /> Message
            </Button>
            <Button size="sm" variant="primary">
              <Handshake className="h-3 w-3" aria-hidden /> Offer to help
            </Button>
          </span>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto t-scroll">
        <StudioCanvas editor={editor} dragType={null} directManipulation={false} onRequestPalette={() => undefined} />
      </main>
    </div>);

}