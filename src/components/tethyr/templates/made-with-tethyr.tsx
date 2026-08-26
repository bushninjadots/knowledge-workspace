// ── Made With Tethyr ──────────────────────────────────────────────────────────
// A subtle attribution badge shown at the bottom of pages that use a community
// template. Links to the template's detail page so others can discover the
// layout. Designed to be unobtrusive — small text, muted colors, no border.

import { Link } from "@tanstack/react-router";

interface MadeWithTethyrProps {
  /** The template display name. */
  templateName: string;
  /** The template ID for linking. */
  templateId: string;
  /** The creator's handle, if available. */
  creatorHandle?: string | null;
}

export function MadeWithTethyr({ templateName, templateId, creatorHandle }: MadeWithTethyrProps) {
  return (
    <div className="mt-6 flex items-center justify-center gap-1 text-[11px] text-muted-foreground/60">
      <span>Made with</span>
      <Link
        to="/templates/$id"
        params={{ id: templateId }}
        className="underline decoration-muted-foreground/30 underline-offset-2 transition-colors hover:text-muted-foreground hover:decoration-muted-foreground/50"
      >
        {templateName}
      </Link>
      {creatorHandle && (
        <>
          <span>by</span>
          <Link
            to="/u/$handle"
            params={{ handle: creatorHandle }}
            className="underline decoration-muted-foreground/30 underline-offset-2 transition-colors hover:text-muted-foreground hover:decoration-muted-foreground/50"
          >
            @{creatorHandle}
          </Link>
        </>
      )}
      <span className="text-[10px]">• Tethyr</span>
    </div>
  );
}
