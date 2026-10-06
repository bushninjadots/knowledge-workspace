// Studio editor preview: the real public page in a device-width iframe.
// Split out of g-studio-surface.tsx.
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Preview = the real public page, rendering the saved draft, in an iframe at
 * a true device width. The editor canvas can't stand in for it: its frame
 * narrows a box, but breakpoints follow the window, so a "phone" preview used
 * to show the desktop grid. Waits for an in-flight save so it never shows a
 * draft older than the canvas; a new save reloads it.
 */
export function GStudioPreviewFrame({
  handle,
  width,
  saving,
  reloadKey,
}: {
  handle: string | null;
  width: number | undefined;
  saving: boolean;
  reloadKey: number;
}) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [reloadKey]);
  return (
    <section
      aria-label="Preview"
      className="relative flex min-h-0 min-w-0 flex-1 justify-center overflow-hidden bg-[var(--surface-sunken)] sm:px-4 sm:pt-3"
    >
      {!handle ? (
        <p className="m-auto max-w-xs text-center text-sm text-muted-foreground">
          Choose a handle in Settings to preview your public page.
        </p>
      ) : saving ? (
        <p className="m-auto text-sm text-muted-foreground" role="status">
          Saving your draft…
        </p>
      ) : (
        <div
          className="relative flex h-full w-full flex-col"
          style={{ maxWidth: width !== undefined ? width + 2 : undefined }}
        >
          {width !== undefined && (
            <span className="mb-1 self-end font-mono text-2xs text-muted-foreground">
              {width}px
            </span>
          )}
          {!loaded && (
            <p
              role="status"
              className="absolute inset-x-0 top-1/3 text-center text-sm text-muted-foreground"
            >
              Loading preview…
            </p>
          )}
          <iframe
            key={reloadKey}
            src={`/u/${encodeURIComponent(handle)}?embed=true&draft=true`}
            title="Your Studio as visitors will see it after you publish"
            onLoad={() => setLoaded(true)}
            className={cn(
              "min-h-0 w-full flex-1 bg-background sm:rounded-t-md sm:border sm:border-b-0 sm:border-border",
              !loaded && "opacity-0",
            )}
          />
        </div>
      )}
    </section>
  );
}
