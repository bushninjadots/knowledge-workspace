import { useMemo, useState, type CSSProperties } from "react";
import {
  BookOpen,
  Check,
  Clock,
  Compass,
  Copy,
  Focus,
  Grid2X2,
  LayoutTemplate,
  Plus,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  STARTERS,
  starterPreviewConfig,
  starterPreviewLayout,
  type Starter,
} from "@/data/starters";
import {
  useDeleteTemplate,
  useMyTemplates,
  usePublicTemplates,
  type CommunityTemplate,
} from "@/hooks/use-templates";
import { PageLayoutRenderer } from "@/components/tethyr/page/page-layout";
import type { BlockContext } from "@/lib/page-blocks";
import { useCurrentUser } from "@/hooks/use-current-user";
import { studioBackgroundVars, studioSurfaceStyle } from "@/lib/studio-config";
import { sanitizeTemplateSections } from "@/lib/template-apply";
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
 * How a community template enters the member's Studio — the two actions every
 * template row offers, matching the "both actions" product decision.
 */
type TemplateAction = "apply" | "save";

interface StarterPickerProps {
  currentId: StudioStarterId | null;
  onChoose: (starter: StudioStarter) => void;
  onClose: () => void;
  canUndo: boolean;
  onUndo: () => void;
  /** Optional "Start from scratch" action — surfaces the reset that already
   *  lives in the Customize panel footer, next to the templates it belongs with. */
  onStartFromScratch?: () => void;
  /** True when shown automatically on first run (not from the Templates button). */
  firstRun?: boolean;
  /** Apply a community template's sections to the live Studio (one undo). */
  onUseTemplate?: (template: CommunityTemplate) => void;
  /** Fork a template into the member's private stash (My templates). */
  onSaveTemplate?: (template: CommunityTemplate) => void;
  /** Apply one of the member's own saved templates/forks. */
  onUseMyTemplate?: (template: CommunityTemplate) => void;
  /** Ids of templates queued for forking (shows the busy state on Save). */
  savingTemplateIds?: ReadonlySet<string>;
  /** Ids known to be forked by the member already. */
  savedTemplateIds?: ReadonlySet<string>;
  /** Act on a community template ("apply" | "save") — one callback so the
   *  rows stay dumb about what each action means. */
  onTemplateAction?: (action: TemplateAction, template: CommunityTemplate) => void;
}

/**
 * "Choose how you want your Studio to feel."
 *
 * One dialog, two layers of the same decision:
 *  • Directions — built-in starters. Each preview renders the member's real
 *    content dressed in the starter's actual surface treatment.
 *  • Community directions — templates published by other members. Structure
 *    only, forked into the member's account, applied through the same
 *    non-destructive commit path as the starters.
 */
export function StarterPicker({
  currentId,
  onChoose,
  onClose,
  canUndo,
  onUndo,
  onStartFromScratch,
  firstRun = false,
  onUseTemplate,
  onSaveTemplate,
  onUseMyTemplate,
  savingTemplateIds,
  savedTemplateIds,
  onTemplateAction,
}: StarterPickerProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "popular">("newest");
  const signedIn = useIsSignedIn();
  const templates = usePublicTemplates({ search, sort });
  const mine = useMyTemplates(signedIn);

  const mineRows = useMemo(() => mine.data ?? [], [mine.data]);
  const savedIds = useMemo(() => {
    const ids = new Set(savedTemplateIds ?? []);
    for (const row of mineRows) {
      ids.add(row.id);
      // A fork marks its parent template as saved — the public row for the
      // parent must show "Saved" rather than offering a duplicate fork.
      if (row.forkedFromId) ids.add(row.forkedFromId);
    }
    return ids;
  }, [mineRows, savedTemplateIds]);

  const publicRows = (templates.data ?? []).filter((row) => !savedIds.has(row.id));

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        aria-label="Choose how your Studio feels"
        className="flex max-h-[85vh] w-full max-w-4xl flex-col gap-0 overflow-hidden rounded-lg sm:rounded-lg border-card-border bg-surface-elevated p-0 shadow-xl card"
      >
        <header className="shrink-0 border-b border-card-border px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">
                {firstRun
                  ? "Choose how you want your Studio to feel"
                  : "Templates — a starting direction for your Studio"}
              </h2>
              <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                <LayoutTemplate
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground-subtle"
                  aria-hidden
                />
                <span>
                  A starting direction. It rearranges what you already have — nothing is deleted,
                  and one undo puts it back.
                </span>
              </p>
            </div>
            {signedIn && (
              <div className="hidden shrink-0 sm:block">
                <label className="relative block">
                  <Search
                    className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground-subtle"
                    aria-hidden
                  />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search community"
                    aria-label="Search community templates"
                    className="h-8 w-44 rounded-md pl-7 text-xs"
                  />
                </label>
              </div>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* ── Built-in directions ─────────────────────────────────────── */}
          <section aria-label="Built-in directions">
            <ul className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
              {onStartFromScratch && (
                <li>
                  <button
                    type="button"
                    onClick={onStartFromScratch}
                    className="flex h-full w-full flex-col items-start gap-3 rounded-lg border border-card-border p-3 text-left outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <span
                      aria-hidden
                      className="flex h-[150px] w-full items-center justify-center rounded-md border border-dashed [border-color:var(--border)] bg-background"
                    >
                      <span className="flex flex-col items-center gap-1.5 text-muted-foreground-subtle">
                        <Plus className="h-5 w-5" />
                        <span className="font-mono text-3xs uppercase tracking-widest">
                          Blank canvas
                        </span>
                      </span>
                    </span>
                    <span>
                      <span className="block font-display text-sm font-semibold text-foreground">
                        Start from scratch
                      </span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                        Clear the canvas back to the default Studio. Your content stays — only the
                        arrangement resets, and one undo puts it back.
                      </span>
                    </span>
                  </button>
                </li>
              )}
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
                      className={`group flex h-full w-full flex-col gap-3 rounded-lg border p-3 text-left outline-none transition-[border-color,background-color,transform] hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                        active
                          ? "border-[var(--starter-accent)] bg-[var(--starter-tint)]"
                          : "border-card-border bg-surface-elevated hover:border-[var(--starter-accent)]/60 hover:bg-surface"
                      }`}
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
                      <span className="mt-auto block border-t border-current/10 pt-2 text-[11px] leading-relaxed text-muted-foreground">
                        <span
                          className="font-mono text-3xs uppercase tracking-widest"
                          style={{ color: detail.accent }}
                        >
                          {detail.label}
                        </span>{" "}
                        — {starter.remixNote}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ── Community directions ────────────────────────────────────── */}
          {signedIn && (
            <section aria-label="Community directions" className="border-t border-card-border">
              <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
                <h3 className="t-label">Community directions</h3>
                <div className="flex items-center gap-1" role="group" aria-label="Sort templates">
                  <SortButton
                    label="Newest"
                    active={sort === "newest"}
                    onClick={() => setSort("newest")}
                  />
                  <SortButton
                    label="Most used"
                    active={sort === "popular"}
                    onClick={() => setSort("popular")}
                  />
                </div>
              </div>

              {templates.isLoading ? (
                <TemplateRowsSkeleton />
              ) : templates.isError ? (
                <p className="px-5 pb-4 text-xs text-muted-foreground">
                  Community templates could not be loaded.
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 pl-1 text-xs"
                    onClick={() => void templates.refetch()}
                  >
                    Try again
                  </Button>
                </p>
              ) : publicRows.length === 0 && mineRows.length === 0 ? (
                <p className="px-5 pb-4 text-xs text-muted-foreground-subtle">
                  {search
                    ? "No community templates match that search."
                    : "No community templates yet — publish yours with “Save as template” in the canvas menu."}
                </p>
              ) : (
                <>
                  {mineRows.length > 0 && (
                    <div className="px-5">
                      <p className="t-label mb-1.5 text-muted-foreground-subtle">My templates</p>
                      <ul className="flex gap-2 overflow-x-auto pb-2">
                        {mineRows.map((template) => (
                          <MyTemplateChip
                            key={template.id}

                            template={template}
                            onUse={onUseMyTemplate}
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                  {publicRows.length > 0 && (
                    <ul className="px-5 pb-4">
                      {publicRows.map((template) => (
                        <TemplateRow
                          key={template.id}
                          template={template}
                          saved={savedIds.has(template.id)}
                          saving={savingTemplateIds?.has(template.id) ?? false}
                          onUse={
                            onUseTemplate ??
                            (onTemplateAction
                              ? (template) => onTemplateAction("apply", template)
                              : undefined)
                          }
                          onSave={
                            onSaveTemplate ??
                            (onTemplateAction
                              ? (template) => onTemplateAction("save", template)
                              : undefined)
                          }
                        />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t [border-color:var(--card-border-color,var(--border))] px-5 py-3 card">
          <span className="text-[11px] text-muted-foreground">
            {firstRun
              ? "You can change any of this directly on the canvas afterwards."
              : "Every template keeps your content — only the arrangement and styling change."}
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

// ── Previews ─────────────────────────────────────────────────────────────────

/** A scaled live preview of the member's work, dressed in the starter's
 *  actual surface treatment (fonts, density, radius, backgrounds). */
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
        <div
          className="pointer-events-none select-none overflow-hidden"
          style={{ height: 150, ...previewSurfaceStyle(starter) }}
        >
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

/**
 * The starter's real surface CSS custom properties for the preview frame —
 * the same mapping the public Studio view applies, so each preview shows its
 * typography, density rhythm, and corner treatment instead of a generic one.
 */
function previewSurfaceStyle(starter: Starter): React.CSSProperties {
  const config = starterPreviewConfig(starter);
  const style = studioSurfaceStyle(config);
  // Backgrounds: the config's publicBackground picks the preview's backdrop —
  // the same shared mapping the public page applies, so Paper/Surface/Sunken
  // differences are visible between directions and never drift from reality.
  return {
    ...style,
    ...studioBackgroundVars(config, "public"),
    backgroundColor: "var(--studio-bg)",
  };
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

// ── Community template rows ──────────────────────────────────────────────────

function TemplateRow({
  template,
  saved,
  saving,
  onUse,
  onSave,
}: {
  template: CommunityTemplate;
  saved: boolean;
  saving: boolean;
  onUse?: (template: CommunityTemplate) => void;
  onSave?: (template: CommunityTemplate) => void;
}) {
  const sanitized = useMemo(
    () => sanitizeTemplateSections(template.rawSections),
    [template.rawSections],
  );
  const creator =
    template.creatorDisplayName ?? (template.creatorHandle ? `@${template.creatorHandle}` : null);

  return (
    <li className="border-b border-border/60 last:border-b-0">
      <div className="flex items-center gap-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2 truncate text-sm font-medium text-foreground">
            <span className="truncate">{template.name}</span>
            {template.category && (
              <span className="shrink-0 rounded-full border border-border px-1.5 py-px font-mono text-3xs uppercase tracking-widest text-muted-foreground-subtle">
                {template.category}
              </span>
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground-subtle">
            {creator && <span className="truncate">by {creator}</span>}
            <span className="inline-flex items-center gap-0.5" title="Times used">
              <Check className="h-3 w-3" aria-hidden /> {template.usageCount}
            </span>
            <span className="inline-flex items-center gap-0.5" title="Times forked">
              <Copy className="h-3 w-3" aria-hidden /> {template.forkCount}
            </span>
            <span className="hidden items-center gap-0.5 sm:inline-flex" title="Sections included">
              {sanitized.length} section{sanitized.length === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onSave && !template.isMine && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-2xs"
              disabled={saved || saving}
              onClick={() => onSave(template)}
            >
              {saved ? "Saved" : saving ? "Saving…" : "Save"}
            </Button>
          )}
          {onUse && (
            <Button size="sm" className="h-7 px-2 text-2xs" onClick={() => onUse(template)}>
              Try in Studio
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function MyTemplateChip({
  template,
  onUse,
}: {
  template: CommunityTemplate;
  onUse?: (template: CommunityTemplate) => void;
}) {
  const deleteTemplate = useDeleteTemplate();
  // Published templates can be unpublished; private forks only offer apply.
  const canUnpublish = template.forkedFromId === null;
  return (
    <li className="shrink-0">
      <div
        className={`flex h-7 items-center rounded-full border border-border bg-[var(--surface-elevated)] transition-colors focus-within:ring-2 focus-within:ring-[var(--user-accent,var(--ring))] focus-within:ring-offset-1 ${
          canUnpublish ? "pr-1" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => onUse?.(template)}
          title={template.description ?? template.name}
          className="flex h-full items-center gap-1.5 rounded-full px-2.5 text-2xs text-foreground outline-none"
        >
          <Clock className="h-3 w-3 text-muted-foreground-subtle" aria-hidden />
          <span className="max-w-[160px] truncate">{template.name}</span>
        </button>
        {canUnpublish && (
          <button
            type="button"
            aria-label={`Unpublish ${template.name}`}
            title="Unpublish"
            disabled={deleteTemplate.isPending}
            onClick={() => deleteTemplate.mutate({ layoutId: template.id })}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground-subtle outline-none hover:bg-[var(--surface-sunken)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]"
          >
            <Trash2 className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}

function SortButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-sm px-1.5 py-0.5 font-mono text-3xs uppercase tracking-widest outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1 ${
        active ? "bg-[var(--surface-sunken)] text-foreground" : "text-muted-foreground-subtle"
      }`}
    >
      {label}
    </button>
  );
}

function TemplateRowsSkeleton() {
  return (
    <div className="space-y-2 px-5 pb-4" aria-hidden>
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-3">
          <div className="h-3.5 w-40 animate-pulse rounded-sm bg-border" />
          <div className="h-3 w-24 animate-pulse rounded-sm bg-border" />
        </div>
      ))}
    </div>
  );
}

/** Cheap signed-in probe so the community section only renders when it can act. */
function useIsSignedIn(): boolean {
  const { data: me } = useCurrentUser();
  return Boolean(me?.userId);
}
