// Studio editor side rail: Style, Add (block palette) and Block (inspector).
// Split out of g-studio-surface.tsx.
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Frame,
  GripHorizontal,
  Settings2,
  Sliders,
  Trash2,
  X,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { getAllBlocks, getBlock } from "@/lib/block-registry";
import type { BlockCategory, BlockDefinition, LayoutBlockInstance } from "@/lib/page-blocks";
import { cn } from "@/lib/utils";
import {
  BlockFrameBorder,
  BLOCK_INSET_DEFAULT_PX,
  BLOCK_INSET_MAX,
  BLOCK_INSET_MIN,
  BLOCK_RADIUS_MAX,
  BLOCK_RADIUS_MIN,
} from "@/lib/studio-config";
import type { BlockShape } from "@/lib/page-blocks";
import { findSection, sectionLabel } from "@/lib/studio-grid";
import { BlockGlyph } from "./block-glyph";
import { ProfileMediaControls } from "./profile-media-controls";
import { IconButton, WidthStepper } from "./studio-controls";
import { GCustomizePanel } from "./g-customize-panel";
import type { GStudioSurfaceProps } from "./g-studio-surface";

export const BLOCK_CATEGORY_ORDER: BlockCategory[] = [
  "content",
  "media",
  "people",
  "project",
  "community",
  "utility",
];
export const BLOCK_CATEGORY_LABELS: Record<BlockCategory, string> = {
  content: "Content",
  media: "Media",
  people: "People",
  project: "Projects",
  community: "Community",
  utility: "Utility",
};

/** Shape presets shown as mini wireframe previews in the inspector. Each
 *  entry pairs a BlockShape value with a tiny SVG that renders the actual
 *  border-radius so the creator sees the real silhouette, not an abstraction. */
const SHAPE_PRESETS: Array<{ value: BlockShape; label: string; radius: string }> = [
  { value: "default", label: "Theme", radius: "3px" },
  { value: "square", label: "Sharp", radius: "0px" },
  { value: "rounded", label: "Round", radius: "5px" },
  { value: "soft", label: "Soft", radius: "9px" },
  { value: "pill", label: "Pill", radius: "9999px" },
  { value: "organic", label: "Organic", radius: "42% 58% 58% 42% / 42% 42% 58% 58%" },
  { value: "blob", label: "Blob", radius: "63% 37% 30% 70% / 60% 30% 70% 40%" },
  { value: "leaf", label: "Leaf", radius: "0 50% 50% 0" },
];

/** Shapes that support a per-block radius slider. */
const RADIUS_SHAPES = new Set<BlockShape>(["rounded", "soft"]);

/** Tiny SVG preview of a shape silhouette at 28×20. */
function ShapeThumbnail({ radius, active }: { radius: string; active: boolean }) {
  return (
    <svg width={28} height={20} viewBox="0 0 28 20" className="shrink-0" aria-hidden>
      <rect
        x={2}
        y={2}
        width={24}
        height={16}
        rx={radius}
        ry={radius}
        fill={active ? "var(--user-accent-subtle)" : "var(--surface-sunken)"}
        stroke={active ? "var(--user-accent)" : "var(--border-strong)"}
        strokeWidth={0.8}
      />
    </svg>
  );
}

/** Per-block frame controls in the inspector: shape, border on/off (plus
 *  "follow appearance"), inner spacing, and corner radius. Writes the block's
 *  `frameBorder`/`frameInset`/`frameShape`/`frameRadius` fields; the shared
 *  `.studio-block` utility renders them on every surface (editor, owner view,
 *  public page). */
function BlockFrameSection({
  block,
  ...props
}: GStudioSurfaceProps & { block: LayoutBlockInstance }) {
  const def = getBlock(block.type);
  const flush = def?.containerless || block.type === "profile-header";
  const inset = typeof block.frameInset === "number" ? block.frameInset : undefined;
  const shape = block.frameShape ?? "default";
  const radius = typeof block.frameRadius === "number" ? block.frameRadius : undefined;
  const showRadiusSlider = RADIUS_SHAPES.has(shape);

  return (
    <div className="border-t border-border py-3">
      <div className="mb-3 flex items-start gap-2">
        <Sliders
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--user-accent-text)]"
          aria-hidden
        />
        <div>
          <p className="text-xs font-medium text-foreground">Block appearance</p>
          <p className="mt-0.5 text-2xs leading-snug text-muted-foreground-subtle">
            Change this block only. Anything set to Theme follows your Studio appearance settings.
          </p>
        </div>
      </div>
      <p className="t-label mb-1">Shape</p>
      <p className="mb-2 text-2xs leading-snug text-muted-foreground-subtle">
        Choose the silhouette of this block&apos;s surface.
      </p>
      <div role="radiogroup" aria-label="Block shape" className="grid grid-cols-4 gap-1">
        {SHAPE_PRESETS.map((preset) => {
          const active = shape === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={preset.label}
              onClick={() =>
                props.onBlockAction(block.id, {
                  frameShape: preset.value === "default" ? undefined : preset.value,
                  // Clear per-block radius when switching to a shape that
                  // doesn't use it, so stale values don't linger.
                  frameRadius:
                    preset.value !== "default" && RADIUS_SHAPES.has(preset.value)
                      ? (block.frameRadius ?? (preset.value === "soft" ? 20 : 8))
                      : undefined,
                })
              }
              className={cn(
                "flex flex-col items-center gap-1 rounded-sm border p-1.5 transition-colors",
                active
                  ? "border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)]"
                  : "border-transparent hover:border-border hover:bg-[var(--surface-sunken)]",
              )}
            >
              <ShapeThumbnail radius={preset.radius} active={active} />
              <span
                className={cn(
                  "text-2xs leading-none",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>
      {showRadiusSlider && (
        <label className="mt-2.5 block">
          <span className="mb-1 flex items-center justify-between font-mono text-3xs uppercase tracking-widest text-muted-foreground-subtle">
            Corner radius <span>{radius ?? "auto"}px</span>
          </span>
          <input
            type="range"
            min={BLOCK_RADIUS_MIN}
            max={BLOCK_RADIUS_MAX}
            step={2}
            value={radius ?? (shape === "soft" ? 20 : 8)}
            aria-label="Corner radius in pixels"
            onChange={(event) =>
              props.onBlockAction(block.id, { frameRadius: Number(event.target.value) })
            }
            className="studio-slider w-full"
          />
          <button
            type="button"
            onClick={() => props.onBlockAction(block.id, { frameRadius: undefined })}
            disabled={radius === undefined}
            className="mt-1 text-2xs text-muted-foreground-subtle underline-offset-2 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
          >
            Reset radius
          </button>
        </label>
      )}
      {shape !== "default" && (
        <button
          type="button"
          onClick={() =>
            props.onBlockAction(block.id, { frameShape: undefined, frameRadius: undefined })
          }
          className="mt-2 text-2xs text-muted-foreground-subtle underline-offset-2 hover:text-foreground hover:underline"
        >
          Reset to theme shape
        </button>
      )}

      <div className="mt-4 flex items-start gap-2 border-t border-border pt-3">
        <Frame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--user-accent-text)]" aria-hidden />
        <div>
          <p className="text-xs font-medium text-foreground">Outline for this block</p>
          <p className="mt-0.5 text-2xs leading-snug text-muted-foreground-subtle">
            Theme uses the single global Card outline setting. Choose On or Off only to make this
            block different.
          </p>
        </div>
      </div>
      <div
        role="radiogroup"
        aria-label="Card border for this block"
        className="grid grid-cols-3 gap-1 border border-border bg-[var(--surface-sunken)] p-0.5"
      >
        {(
          [
            ["default", "Follow"],
            ["frame", "On"],
            ["none", "Off"],
          ] as Array<[BlockFrameBorder, string]>
        ).map(([option, text]) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={(block.frameBorder ?? "default") === option}
            onClick={() => props.onBlockAction(block.id, { frameBorder: option })}
            className={cn(
              "rounded-sm px-1 py-1.5 text-2xs",
              (block.frameBorder ?? "default") === option
                ? "bg-[var(--surface-elevated)] text-foreground"
                : "text-muted-foreground",
            )}
          >
            {text}
          </button>
        ))}
      </div>
      {flush && (block.frameBorder ?? "default") === "default" && (
        <p className="mt-1.5 text-2xs leading-snug text-muted-foreground-subtle">
          This block is full-bleed — it starts with no outline, like the published page.
        </p>
      )}
      {!flush && (
        <label className="mt-2.5 block">
          <span className="mb-1 flex items-center justify-between font-mono text-3xs uppercase tracking-widest text-muted-foreground-subtle">
            Inner spacing <span>{inset ?? `${BLOCK_INSET_DEFAULT_PX}px · theme`}</span>
          </span>
          <span className="mb-1 block text-2xs leading-snug text-muted-foreground-subtle">
            Space between this block&apos;s content and its edge.
          </span>
          <input
            type="range"
            min={BLOCK_INSET_MIN}
            max={BLOCK_INSET_MAX}
            step={2}
            value={inset ?? BLOCK_INSET_DEFAULT_PX}
            aria-label="Inner spacing in pixels"
            onChange={(event) =>
              props.onBlockAction(block.id, { frameInset: Number(event.target.value) })
            }
            className="studio-slider w-full"
          />
          <button
            type="button"
            onClick={() => props.onBlockAction(block.id, { frameInset: undefined })}
            disabled={inset === undefined}
            className="mt-1 text-2xs text-muted-foreground-subtle underline-offset-2 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
          >
            Reset to theme spacing
          </button>
        </label>
      )}
    </div>
  );
}

export type RailTab = "style" | "add" | "block";

const RAIL_TABS: Array<[RailTab, string]> = [
  ["style", "Style"],
  ["add", "Add"],
  ["block", "Block"],
];

export function GStudioRail(
  props: GStudioSurfaceProps & { tab: RailTab; onTabChange: (tab: RailTab | null) => void },
) {
  const { tab, onTabChange } = props;
  const block = props.layout.sections
    .flatMap((section) => section.blocks)
    .find((item) => item.id === props.selectedBlockId);
  return (
    <aside
      aria-label="Studio panels"
      className="hidden h-full min-h-0 w-72 shrink-0 flex-col border-l border-border bg-[var(--surface-elevated)] lg:flex"
    >
      <header className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
        <div role="tablist" aria-label="Studio panels" className="flex flex-1 gap-0.5">
          {RAIL_TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`studio-rail-tab-${value}`}
              aria-selected={tab === value}
              aria-controls="studio-rail-panel"
              onClick={() => onTabChange(value)}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]",
                tab === value
                  ? "bg-[var(--user-accent-subtle)] font-medium text-[var(--user-accent-text)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <IconButton label="Close panel" onClick={() => onTabChange(null)}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </header>
      <div
        role="tabpanel"
        id="studio-rail-panel"
        aria-labelledby={`studio-rail-tab-${tab}`}
        className={cn("min-h-0 flex-1", tab === "style" ? "flex flex-col" : "overflow-y-auto")}
      >
        {tab === "style" ? (
          <GCustomizePanel
            config={props.config}
            layout={props.layout}
            onChange={props.onCustomizeChange}
            themeId={props.themeId}
            onThemeChange={props.onThemeChange}
            cardBorders={props.cardBorders}
            cardBorderColor={props.cardBorderColor}
            onCardBordersChange={props.onCardBordersChange}
            onCardBorderColorChange={props.onCardBorderColorChange}
            onToggleSection={props.onToggleSection}
            onBlockAction={props.onBlockAction}
            onSelect={props.onSelect}
            selectedBlockId={props.selectedBlockId}
            onCompleteProfile={props.onCompleteProfile}
            onOpenAppearance={props.onOpenAppearance}
          />
        ) : tab === "add" ? (
          <GBlockPalette {...props} />
        ) : (
          <GBlockInspector {...props} block={block} onClose={() => props.onSelect(null)} />
        )}
      </div>
    </aside>
  );
}

/**
 * "About / README" (project-about) and "README" (profile-readme) both write the
 * same `profiles.readme` document. On a studio page only one should be offered:
 * the one already in the layout wins, the other is hidden.
 */
export function dedupeSharedReadmeBlocks(blockType: string, usedTypes: Set<string>): boolean {
  if (blockType === "profile-readme") return !usedTypes.has("project-about");
  if (blockType === "project-about") return !usedTypes.has("profile-readme");
  return true;
}

/** The first area whose bottom is below the top of the visible canvas. */
function sectionInView(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const top = document.getElementById("studio-canvas")?.getBoundingClientRect().top ?? 0;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-section-id]"))) {
    if (el.getBoundingClientRect().bottom > top + 80) return el.dataset.sectionId;
  }
  return undefined;
}

function GBlockPalette(props: GStudioSurfaceProps) {
  const [query, setQuery] = useState("");
  const [inView] = useState(sectionInView);
  const sections = props.layout.sections;
  const selectedSectionId = props.selectedBlockId
    ? findSection(props.layout, props.selectedBlockId)?.id
    : undefined;
  const target = props.paletteTarget || selectedSectionId || inView || sections[0]?.id;
  const usedTypes = useMemo(
    () => new Set(sections.flatMap((s) => s.blocks.map((b) => b.type))),
    [sections],
  );
  const blocks = useMemo(
    () =>
      getAllBlocks()
        .filter((block) => block.ownerContext !== "project")
        .filter((block) => dedupeSharedReadmeBlocks(block.type, usedTypes))
        .filter((block) =>
          `${block.label} ${block.description}`.toLowerCase().includes(query.toLowerCase()),
        ),
    [query, usedTypes],
  );
  const blockItem = (def: BlockDefinition) => (
    <button
      key={def.type}
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", def.type);
        event.dataTransfer.effectAllowed = "copy";
        props.onDragTypeChange(def.type);
      }}
      onDragEnd={() => props.onDragTypeChange(null)}
      onClick={() => props.onAdd(def.type, target)}
      className="group/item mb-1 flex w-full cursor-grab items-center gap-2 border border-border bg-[var(--surface)] px-2 py-1.5 text-left hover:border-[var(--user-accent-border)]"
    >
      <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-sm border border-border/60 bg-[var(--surface-sunken)] py-0.5">
        <BlockGlyph type={def.type} category={def.category} />
      </span>
      <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground-subtle" />
      <span className="min-w-0">
        <span className="block text-xs font-medium text-foreground">{def.label}</span>
        <span className="block text-2xs text-muted-foreground-subtle">{def.description}</span>
      </span>
    </button>
  );
  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="space-y-2 border-b border-border px-3 py-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search blocks"
          aria-label="Search blocks"
          className="w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs outline-none"
        />
        <label className="block">
          <span className="t-label">Add to area</span>
          {/* Studio chrome keeps its compact sunken control instead of the app field grammar. */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <select
            value={target ?? ""}
            onChange={(event) => props.onPaletteTargetChange(event.target.value)}
            className="mt-1 w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs"
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {sectionLabel(section)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {query.trim() ? (
          blocks.map((def) => blockItem(def))
        ) : (
          <>
            {BLOCK_CATEGORY_ORDER.map((category) => {
              const categoryBlocks = blocks.filter((b) => b.category === category);
              if (categoryBlocks.length === 0) return null;
              return (
                <div key={category}>
                  <p className="t-label mb-1 mt-3 text-2xs text-[var(--user-accent-text)] first:mt-0">
                    {BLOCK_CATEGORY_LABELS[category]}
                  </p>
                  {categoryBlocks.map((def) => blockItem(def))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

export function GBlockInspector({
  block,
  onClose,
  ...props
}: GStudioSurfaceProps & { block?: LayoutBlockInstance; onClose: () => void }) {
  const def = block ? getBlock(block.type) : undefined;
  const { data: me, refresh: refreshMe } = useCurrentUser();
  if (!block || !def)
    return (
      <div className="p-4">
        <p className="t-label">Block inspector</p>
        <div className="mt-10 text-center">
          <Settings2 className="mx-auto h-6 w-6 text-muted-foreground/50" />
          <p className="mt-3 text-xs text-muted-foreground">
            Select a block on the canvas to inspect it.
          </p>
        </div>
      </div>
    );
  return (
    <div className="p-3">
      <header className="flex items-start justify-between gap-2 border-b border-border pb-3">
        <div>
          <p className="t-label">Block inspector</p>
          <h2 className="mt-1 text-sm font-semibold text-foreground">{def.label}</h2>
          <p className="mt-1 text-2xs text-muted-foreground">{def.description}</p>
        </div>
        <IconButton label="Close inspector" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </header>
      {/* The header's photo and banner upload here, the same controls the
          project editor's inspector has, instead of only a URL box. */}
      {block.type === "profile-header" && me && (
        <div className="border-b border-border py-3">
          <ProfileMediaControls
            ownerId={props.userId}
            avatarUrl={me.avatarSigned}
            bannerUrl={me.bannerSigned}
            onSaved={() => void refreshMe()}
          />
        </div>
      )}
      <div className="space-y-3 py-3">
        {(def.fields ?? []).map((field) => {
          const value = block.config[field.key] ?? def.defaults[field.key];
          const update = (v: unknown) =>
            props.onUpdateBlockConfig(block.id, { ...block.config, [field.key]: v });

          if (field.type === "toggle") {
            return (
              <label
                key={field.key}
                className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
              >
                {field.label}
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) => update(event.target.checked)}
                  className="h-6 w-6 rounded-sm accent-[var(--user-accent,var(--primary))]"
                />
              </label>
            );
          }

          if (field.type === "select") {
            return (
              <label key={field.key} className="block text-xs text-muted-foreground">
                {field.label}
                {/* Studio chrome keeps its compact sunken control instead of the app field grammar. */}
                {/* eslint-disable-next-line no-restricted-syntax */}
                <select
                  className="mt-1 w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs"
                  value={String(value ?? "")}
                  onChange={(event) => update(event.target.value)}
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          if (field.type === "range") {
            const raw = typeof value === "number" ? value : Number(value);
            const num = Number.isNaN(raw) ? (field.min ?? 0) : raw;
            return (
              <label key={field.key} className="block text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  {field.label}
                  <span className="font-mono text-2xs text-muted-foreground">{num}</span>
                </div>
                <input
                  type="range"
                  min={field.min ?? 0}
                  max={field.max ?? 100}
                  step={field.step ?? 1}
                  value={num}
                  onChange={(event) => update(Number(event.target.value))}
                  className="mt-1 w-full accent-[var(--user-accent,var(--primary))]"
                />
              </label>
            );
          }

          if (field.type === "color") {
            return (
              <label
                key={field.key}
                className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
              >
                {field.label}
                <div className="flex items-center gap-1.5">
                  {value ? (
                    <button
                      type="button"
                      onClick={() => update("")}
                      className="text-2xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Reset
                    </button>
                  ) : (
                    <span className="text-2xs text-muted-foreground">Theme</span>
                  )}
                  <input
                    type="color"
                    aria-label={field.label}
                    value={String(value || "#808080")}
                    onChange={(event) => update(event.target.value)}
                    className="h-6 w-8 cursor-pointer rounded-sm border border-border bg-transparent p-0.5"
                  />
                </div>
              </label>
            );
          }

          if (field.type === "image") {
            return (
              <div key={field.key} className="text-xs text-muted-foreground">
                <span className="mb-1 block">{field.label}</span>
                {typeof value === "string" && value.startsWith("http") && (
                  <div className="relative mb-1.5 overflow-hidden rounded-sm border border-border/50">
                    <img src={value} alt="" className="h-16 w-full object-cover" />
                  </div>
                )}
                <input
                  aria-label={field.label}
                  className="w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs"
                  placeholder={field.placeholder ?? "https://…"}
                  value={String(value ?? "")}
                  onChange={(event) => update(event.target.value)}
                />
              </div>
            );
          }

          if (field.type === "textarea") {
            return (
              <label key={field.key} className="block text-xs text-muted-foreground">
                {field.label}
                <textarea
                  className="mt-1 min-h-16 w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs"
                  value={String(value ?? "")}
                  onChange={(event) => update(event.target.value)}
                />
              </label>
            );
          }

          // text (default)
          return (
            <label key={field.key} className="block text-xs text-muted-foreground">
              {field.label}
              <input
                className="mt-1 w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs"
                placeholder={field.placeholder}
                value={String(value ?? "")}
                onChange={(event) => update(event.target.value)}
              />
            </label>
          );
        })}
      </div>
      <BlockFrameSection block={block} {...props} />
      <div className="border-t border-border pt-3">
        <p className="t-label mb-2">Actions</p>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 justify-center"
            onClick={() => props.onMove(block.id, -1)}
          >
            <ChevronUp className="h-3 w-3" /> Move up
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 justify-center"
            onClick={() => props.onMove(block.id, 1)}
          >
            <ChevronDown className="h-3 w-3" /> Move down
          </Button>
          <IconButton label="Duplicate block" onClick={() => props.onDuplicate(block.id)}>
            <Copy className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Remove block" onClick={() => props.onRemove(block.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
        <div className="mt-2 flex">
          <WidthStepper
            block={block}
            section={
              findSection(props.layout, block.id) ?? {
                id: "",
                position: 0,
                layout: "full",
                blocks: [],
              }
            }
            onResize={props.onResizeBlock}
          />
        </div>
      </div>
      <div className="mt-3 border-t border-border pt-3">
        <p className="t-label mb-2">Area</p>
        {props.layout.sections.map((section) => (
          <button
            key={section.id}
            type="button"
            disabled={section.id === findSection(props.layout, block.id)?.id}
            onClick={() => props.onMoveToSection(block.id, section.id)}
            className="flex w-full items-center justify-between px-1.5 py-1 text-left text-xs text-muted-foreground hover:bg-[var(--surface-sunken)] disabled:text-[var(--user-accent-text)]"
          >
            <span>{sectionLabel(section)}</span>
            {section.id === findSection(props.layout, block.id)?.id && (
              <span className="t-label">current</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
