import { useMemo } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { STARTERS, starterPreviewLayout, type Starter } from "@/data/starters";
import { PageLayoutRenderer } from "@/components/tethyr/page/page-layout";
import type { BlockContext } from "@/lib/page-blocks";
import { useCurrentUser } from "@/hooks/use-current-user";
import "@/components/tethyr/blocks/register-all";

// Backward-compatible aliases so existing consumers keep importing from here.
export type StudioStarter = Starter;
type StudioStarterId = Starter["id"];
const STUDIO_STARTERS: StudioStarter[] = STARTERS;

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
  onUndo,
}: {
  currentId: StudioStarterId | null;
  onChoose: (starter: StudioStarter) => void;
  onClose: () => void;
  canUndo: boolean;
  onUndo: () => void;
}) {
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        aria-label="Choose how your Studio feels"
        className="max-w-3xl gap-0 overflow-y-auto rounded-lg sm:rounded-lg border-card-border bg-surface-elevated p-0 shadow-xl card"
      >
        <header className="flex items-start justify-between gap-4 border-b border-card-border px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Choose how you want your Studio to feel
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              A starting direction. It rearranges what you already have — nothing is deleted, and
              one undo puts it back. Each preview below renders your live work in that direction.
            </p>
          </div>
        </header>

        <ul className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3 card">
          {STUDIO_STARTERS.map((starter) => {
            const active = starter.id === currentId;
            return (
              <li key={starter.id} className="bg-surface-elevated">
                <button
                  type="button"
                  onClick={() => onChoose(starter)}
                  aria-pressed={active}
                  className={`flex h-full w-full flex-col gap-3 p-4 text-left transition-colors ${active ? "bg-primary/10" : "hover:bg-surface"}`}
                >
                  <StarterPreview starter={starter} active={active} />
                  <span>
                    <span className="flex items-baseline gap-2 font-display text-sm font-semibold text-foreground">
                      {starter.name}
                      {active && (
                        <span className="text-[10px] uppercase tracking-wider text-primary">
                          Current
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs font-medium text-foreground">
                      {starter.tagline}
                    </span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                      {starter.feels}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t [border-color:var(--card-border-color,var(--border))] px-5 py-3 card">
          <span className="text-[11px] text-muted-foreground">
            You can change any of this directly on the canvas afterwards.
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={!canUndo} onClick={onUndo}>
              <Undo2 className="mr-1 h-3 w-3" />
              Undo last change
            </Button>
            <Button size="sm" variant="secondary" onClick={onClose}>
              Keep what I have
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

/** A scaled live preview of the member's work in a starter's direction. */
function StarterPreview({ starter, active }: { starter: StudioStarter; active: boolean }) {
  const { data: me } = useCurrentUser();
  const ownerId = me?.userId ?? "";
  const layout = useMemo(() => starterPreviewLayout(starter), [starter]);
  const context = useMemo<BlockContext>(
    () => ({
      ownerId,
      ownerType: "profile",
      pageId: `profile:${ownerId}`,
      isEditing: false,
      isOwner: false,
      quickEdit: false,
    }),
    [ownerId],
  );

  return (
    <div
      aria-hidden
      className="overflow-hidden [border-color:var(--card-border-color,var(--border))] bg-background card"
      style={active ? { boxShadow: "0 0 0 1px var(--user-accent)" } : undefined}
    >
      <div className="flex items-center gap-1.5 border-b [border-color:var(--border)] px-2 py-1.5">
        <span
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: active ? "var(--user-accent)" : "var(--border-strong)",
          }}
        />
        <span className="h-2 w-2 rounded-full bg-border" />
        <span className="h-2 w-2 rounded-full bg-border" />
      </div>
      {ownerId ? (
        <div className="pointer-events-none select-none overflow-hidden" style={{ height: 150 }}>
          <div className="w-[512px] origin-top-left" style={{ transform: "scale(0.5)" }}>
            <PageLayoutRenderer layout={layout} context={context} />
          </div>
        </div>
      ) : (
        <Sketch rows={starter.sketch} active={active} />
      )}
    </div>
  );
}

/** Small wireframe fallback preview of a starter's rhythm. */
function Sketch({ rows, active }: { rows: number[][]; active: boolean }) {
  return (
    <div aria-hidden className="flex flex-col gap-1 p-2">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1">
          {row.map((span, spanIndex) => (
            <span
              key={`${rowIndex}-${spanIndex}`}
              className="h-3 rounded-sm"
              style={{
                flex: span,
                backgroundColor: active
                  ? "var(--user-accent)"
                  : rowIndex === 1
                    ? "var(--border-strong)"
                    : "var(--border)",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
