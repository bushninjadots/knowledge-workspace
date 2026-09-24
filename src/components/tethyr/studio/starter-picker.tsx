import { useMemo, type CSSProperties } from "react";
import { BookOpen, Compass, Focus, Grid2X2, LayoutTemplate, Undo2 } from "lucide-react";
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

const STARTER_DETAILS: Record<
  StudioStarterId,
  {
    icon: typeof Focus;
    accent: string;
    tint: string;
    label: string;
  }
> = {
  focused: { icon: Focus, accent: "#d97706", tint: "#fff7ed", label: "Clarity" },
  editorial: { icon: BookOpen, accent: "#7c3aed", tint: "#f5f3ff", label: "Narrative" },
  "project-first": { icon: Grid2X2, accent: "#0891b2", tint: "#ecfeff", label: "Momentum" },
  minimal: { icon: LayoutTemplate, accent: "#475569", tint: "#f8fafc", label: "Essentials" },
  experimental: { icon: Compass, accent: "#db2777", tint: "#fdf2f8", label: "Uncharted" },
};

function starterDetail(starter: StudioStarter) {
  return STARTER_DETAILS[starter.id];
}

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

        <ul className="grid gap-3 bg-background/50 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {STUDIO_STARTERS.map((starter) => {
            const active = starter.id === currentId;
            const detail = starterDetail(starter);
            const Icon = detail.icon;
            return (
              <li key={starter.id}>
                <button
                  type="button"
                  onClick={() => onChoose(starter)}
                  aria-pressed={active}
                  className={`group flex h-full w-full flex-col gap-3 rounded-lg border p-3 text-left transition-[border-color,background-color,transform] hover:-translate-y-0.5 ${active ? "border-[var(--starter-accent)] bg-[var(--starter-tint)]" : "border-card-border bg-surface-elevated hover:border-[var(--starter-accent)]/60 hover:bg-surface"}`}
                  style={
                    {
                      "--starter-accent": detail.accent,
                      "--starter-tint": `color-mix(in oklab, ${detail.accent} 12%, var(--background))`,
                    } as CSSProperties
                  }
                >
                  <StarterPreview starter={starter} active={active} accent={detail.accent} />
                  <span className="flex items-start gap-2.5">
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-md"
                      style={{ backgroundColor: `${detail.accent}18`, color: detail.accent }}
                    >
                      <Icon aria-hidden data-icon="" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-display text-sm font-semibold text-foreground">
                        {starter.name}
                        {active && (
                          <span
                            className="text-[10px] uppercase tracking-wider"
                            style={{ color: detail.accent }}
                          >
                            Current
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs font-medium text-foreground">
                        {starter.tagline}
                      </span>
                    </span>
                  </span>
                  <span className="mt-auto block text-[11px] leading-relaxed text-muted-foreground">
                    {starter.feels}
                  </span>
                  <span className="flex items-center justify-between border-t border-current/10 pt-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    <span>{detail.label}</span>
                    <span className="text-muted-foreground/60">Apply direction</span>
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
function StarterPreview({
  starter,
  active,
  accent,
}: {
  starter: StudioStarter;
  active: boolean;
  accent: string;
}) {
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
      style={
        {
          borderColor: active ? accent : "var(--card-border-color,var(--border))",
          boxShadow: active ? `0 0 0 1px ${accent}` : undefined,
        } as CSSProperties
      }
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
