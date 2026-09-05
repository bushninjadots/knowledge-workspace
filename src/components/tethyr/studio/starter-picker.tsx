import { Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STARTERS, type Starter } from "@/data/starters";

// Backward-compatible aliases so existing consumers keep importing from here.
export type StudioStarter = Starter;
type StudioStarterId = Starter["id"];
export const STUDIO_STARTERS: StudioStarter[] = STARTERS;

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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose how your Studio feels"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-surface-elevated shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Choose how you want your Studio to feel
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              A starting direction. It rearranges what you already have — nothing is deleted, and
              one undo puts it back.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close starter picker"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <ul className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
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
                  <Sketch rows={starter.sketch} active={active} />
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

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
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
      </div>
    </div>
  );
}

/** Small wireframe preview of a starter's rhythm. */
function Sketch({ rows, active }: { rows: number[][]; active: boolean }) {
  return (
    <div aria-hidden className="flex flex-col gap-1 border border-border bg-background p-2">
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
