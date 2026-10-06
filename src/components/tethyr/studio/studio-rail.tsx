// Studio editor side rail: Style, Add (block palette) and Block (inspector).
// Split out of g-studio-surface.tsx.
import { Fragment, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Frame,
  FolderInput,
  Lock,
  LockOpen,
  Plus,
  Search,
  Settings2,
  Sliders,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
import { findSection, sectionLabel, type GridArrangement } from "@/lib/studio-grid";
import { ProfileMediaControls } from "./profile-media-controls";
import { BlockFields, Switch } from "./block-fields";
import { AreaInspector } from "./area-inspector";
import { BlockIcon } from "./block-icon";
import { suggestBlocks } from "@/lib/block-suggestions";
import { Choice, IconButton, WidthStepper } from "./studio-controls";
import { GCustomizePanel } from "./g-customize-panel";
import type { GStudioSurfaceProps } from "./g-studio-surface";

/** Palette groups, in the order a Studio usually reads: who you are, what
 *  you've made, what you know, who you build with, then free-form content. */
export const BLOCK_CATEGORY_ORDER: BlockCategory[] = [
  "identity",
  "work",
  "skills",
  "network",
  "content",
  "media",
  "people",
  "project",
  "community",
  "utility",
];
export const BLOCK_CATEGORY_LABELS: Record<BlockCategory, string> = {
  identity: "About you",
  work: "Work & proof",
  skills: "Skills",
  network: "Network",
  content: "Text & layout",
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
/** The look a block carries (not its content or place). */
const STYLE_KEYS = [
  "frameBorder",
  "frameInset",
  "frameShape",
  "frameRadius",
  "frameFill",
  "frameShadow",
  "frameAlign",
  "titleStyle",
] as const;
const STYLE_CLIPBOARD_KEY = "studio-block-style";

function readStyleClipboard(): Partial<LayoutBlockInstance> | null {
  try {
    const raw = window.localStorage.getItem(STYLE_CLIPBOARD_KEY);
    return raw ? (JSON.parse(raw) as Partial<LayoutBlockInstance>) : null;
  } catch {
    return null;
  }
}

/** Copy a block's look and paste it onto others, or make a whole area (or
 *  the whole Studio) match it in one step. */
function StyleClipboard({ block, ...props }: GStudioSurfaceProps & { block: LayoutBlockInstance }) {
  const [copied, setCopied] = useState<Partial<LayoutBlockInstance> | null>(readStyleClipboard);
  const style = () =>
    Object.fromEntries(STYLE_KEYS.map((key) => [key, block[key]])) as Partial<LayoutBlockInstance>;
  const area = findSection(props.layout, block.id);
  const button =
    "rounded-sm border border-border px-2 py-1 text-2xs text-foreground outline-none hover:border-[var(--user-accent-border)] hover:bg-[var(--surface-sunken)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] disabled:opacity-50";
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      <button
        type="button"
        className={button}
        onClick={() => {
          const next = style();
          setCopied(next);
          try {
            window.localStorage.setItem(STYLE_CLIPBOARD_KEY, JSON.stringify(next));
          } catch {
            // Storage unavailable: the copy lasts this visit.
          }
          toast("Style copied — select another block and paste it.");
        }}
      >
        Copy style
      </button>
      <button
        type="button"
        className={button}
        disabled={!copied}
        onClick={() => copied && props.onApplyBlockStyle([block.id], copied)}
      >
        Paste style
      </button>
      <button
        type="button"
        className={button}
        disabled={!area || area.blocks.length < 2}
        onClick={() =>
          area &&
          props.onApplyBlockStyle(
            area.blocks.map((b) => b.id),
            style(),
          )
        }
      >
        Match this area
      </button>
      <button
        type="button"
        className={button}
        onClick={() =>
          props.onApplyBlockStyle(
            props.layout.sections.flatMap((section) =>
              section.blocks.filter((b) => b.type !== "profile-header").map((b) => b.id),
            ),
            style(),
          )
        }
      >
        Match all blocks
      </button>
    </div>
  );
}

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
      <StyleClipboard block={block} {...props} />
      <p className="t-label mb-1">Shape</p>
      <p className="mb-2 text-2xs leading-snug text-muted-foreground-subtle">
        Choose the silhouette of this block&apos;s surface. Curved shapes move the content in so it
        stays inside the curve.
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
            Corner radius <span>{radius === undefined ? "Auto" : `${radius}px`}</span>
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

      <div className="mt-4 border-t border-border pt-3">
        <p className="t-label mb-1">Fill</p>
        <p className="mb-2 text-2xs leading-snug text-muted-foreground-subtle">
          This block&apos;s background. A picked colour brings readable text with it.
        </p>
        <div
          role="radiogroup"
          aria-label="Block fill"
          className="flex flex-wrap items-center gap-1.5"
        >
          {(
            [
              ["", "Theme", "var(--studio-card-fill, var(--surface-elevated))"],
              ["none", "None", "transparent"],
              [
                "tint",
                "Tint",
                "color-mix(in oklab, var(--foreground) 8%, var(--surface-elevated))",
              ],
              [
                "accent",
                "Accent",
                "color-mix(in oklab, var(--user-accent) 22%, var(--surface-elevated))",
              ],
              [
                "gradient",
                "Gradient",
                "linear-gradient(135deg, color-mix(in oklab, var(--user-accent) 45%, var(--surface-elevated)), var(--surface-elevated))",
              ],
            ] as Array<[string, string, string]>
          ).map(([value, label, swatch]) => {
            const active = (block.frameFill ?? "") === value;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={active}
                title={label}
                onClick={() => props.onBlockAction(block.id, { frameFill: value || undefined })}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-sm border px-1.5 text-2xs",
                  active
                    ? "border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)] text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className="h-3.5 w-3.5 rounded-[3px] border border-border"
                  style={{
                    background:
                      value === "none"
                        ? "repeating-linear-gradient(45deg, transparent 0 3px, var(--border) 3px 4px)"
                        : swatch,
                  }}
                />
                {label}
              </button>
            );
          })}
          <label
            title="Any colour"
            className={cn(
              "relative flex h-7 cursor-pointer items-center gap-1.5 rounded-sm border px-1.5 text-2xs",
              /^#/.test(block.frameFill ?? "")
                ? "border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)] text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              aria-hidden
              className="h-3.5 w-3.5 rounded-[3px] border border-border"
              style={{
                background: /^#/.test(block.frameFill ?? "")
                  ? block.frameFill
                  : "conic-gradient(#f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f87171)",
              }}
            />
            Colour
            <input
              type="color"
              aria-label="Custom block fill colour"
              value={/^#/.test(block.frameFill ?? "") ? block.frameFill : "#3f8f8a"}
              onChange={(event) => props.onBlockAction(block.id, { frameFill: event.target.value })}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
        <div className="mt-3">
          <Choice
            label="Shadow"
            value={block.frameShadow ?? "theme"}
            options={[
              ["theme", "Theme"],
              ["none", "None"],
              ["soft", "Soft"],
              ["lifted", "Lifted"],
            ]}
            onChange={(value) =>
              props.onBlockAction(block.id, {
                frameShadow: value === "theme" ? undefined : (value as "none" | "soft" | "lifted"),
              })
            }
          />
          <Choice
            label="Text alignment"
            value={block.frameAlign ?? "start"}
            options={[
              ["start", "Left"],
              ["center", "Centred"],
            ]}
            onChange={(value) =>
              props.onBlockAction(block.id, {
                frameAlign: value === "center" ? "center" : undefined,
              })
            }
          />
          {def?.title && (
            <Choice
              label="Title style"
              value={block.titleStyle ?? "studio"}
              options={[
                ["studio", "Studio"],
                ["label", "Label"],
                ["heading", "Heading"],
                ["display", "Display"],
              ]}
              onChange={(value) =>
                props.onBlockAction(block.id, {
                  titleStyle:
                    value === "studio" ? undefined : (value as "label" | "heading" | "display"),
                })
              }
            />
          )}
          <Choice
            label="Show on"
            hint="Hide a block on phones or on bigger screens. The editor always shows it."
            value={block.showOn ?? "all"}
            options={[
              ["all", "Everywhere"],
              ["desktop", "Desktop"],
              ["mobile", "Phone"],
            ]}
            onChange={(value) =>
              props.onBlockAction(block.id, {
                showOn: value === "all" ? undefined : (value as "desktop" | "mobile"),
              })
            }
          />
          <Choice
            label="On phones"
            hint="Two half-width blocks sit side by side on a phone."
            value={block.phoneWidth ?? "full"}
            options={[
              ["full", "Full width"],
              ["half", "Half width"],
            ]}
            onChange={(value) =>
              props.onBlockAction(block.id, { phoneWidth: value === "half" ? "half" : undefined })
            }
          />
          <Choice
            label="Phone position"
            value={block.phoneOrder ?? "placed"}
            options={[
              ["placed", "As placed"],
              ["first", "First"],
              ["last", "Last"],
            ]}
            onChange={(value) =>
              props.onBlockAction(block.id, {
                phoneOrder: value === "placed" ? undefined : (value as "first" | "last"),
              })
            }
          />
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-foreground">Lock in place</span>
            <Switch
              label="Lock this block in place"
              checked={block.locked === true}
              onChange={(checked) =>
                props.onBlockAction(block.id, { locked: checked || undefined })
              }
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 border-t border-border pt-3">
        <Frame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--user-accent-text)]" aria-hidden />
        <div>
          <p className="text-xs font-medium text-foreground">Outline for this block</p>
          <p className="mt-0.5 text-2xs leading-snug text-muted-foreground-subtle">
            Follow uses the page&rsquo;s Borders setting. Pick another only to make this block
            different.
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
            ["frame", "Solid"],
            ["none", "None"],
            ["dashed", "Dashed"],
            ["dotted", "Dotted"],
            ["double", "Double"],
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

export type RailTab = "style" | "add" | "block" | "area";

const RAIL_TABS: Array<[RailTab, string]> = [
  ["style", "Style"],
  ["add", "Add"],
  ["block", "Block"],
  ["area", "Area"],
];

export function GStudioRail(
  props: GStudioSurfaceProps & { tab: RailTab; onTabChange: (tab: RailTab | null) => void },
) {
  const { tab, onTabChange } = props;
  const editingArea = props.layout.sections.find((s) => s.id === props.editingAreaId);
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
          {RAIL_TABS.filter(([value]) => value !== "area" || !!editingArea).map(
            ([value, label]) => (
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
            ),
          )}
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
            onOpenLayouts={props.onOpenTemplates}
          />
        ) : tab === "add" ? (
          <GBlockPalette {...props} />
        ) : tab === "area" && editingArea ? (
          <AreaInspector
            section={editingArea}
            onChange={(patch) => props.onSectionAppearanceChange(editingArea.id, patch)}
          />
        ) : props.selectedBlockIds.length > 1 ? (
          <MultiBlockInspector {...props} />
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

/** Blocks added since the editor audit, flagged "New" in the palette. */
const NEW_BLOCKS = new Set([
  "quote",
  "call-to-action",
  "highlights",
  "timeline",
  "faq",
  "featured-link",
  "services",
  "callout",
]);

function GBlockPalette(props: GStudioSurfaceProps) {
  const [query, setQuery] = useState("");
  const [inView] = useState(sectionInView);
  const { data: me } = useCurrentUser();
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
  const suggestions = useMemo(
    () =>
      suggestBlocks(props.layout, {
        projectCount: me?.projects.length ?? 0,
        skillCount: (me?.teachIds.length ?? 0) + (me?.learnIds.length ?? 0),
        hasBio: !!me?.profile?.bio?.trim(),
        linkCount: me?.profile?.portfolio_links?.length ?? 0,
        toolCount:
          (me?.profile?.favourite_tools?.length ?? 0) + (me?.profile?.software_stack?.length ?? 0),
        yearsExperience: me?.profile?.years_experience ?? null,
        availability: me?.profile?.availability ?? null,
      }).filter((s) => getBlock(s.type)),
    [me, props.layout],
  );
  const blockItem = (def: BlockDefinition, reason?: string) => (
    <button
      key={`${reason ? "suggested-" : ""}${def.type}`}
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", def.type);
        event.dataTransfer.effectAllowed = "copy";
        props.onDragTypeChange(def.type);
      }}
      onDragEnd={() => props.onDragTypeChange(null)}
      onClick={() => props.onAdd(def.type, target)}
      title={`Add ${def.label} — or drag it onto the canvas`}
      className="group/item flex w-full cursor-pointer items-start gap-2.5 rounded-md border border-transparent px-2 py-2 text-left outline-none transition-colors hover:border-border hover:bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]"
    >
      <BlockIcon name={def.icon} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          {def.label}
          {NEW_BLOCKS.has(def.type) && (
            <span className="rounded-full bg-[var(--user-accent-subtle)] px-1.5 text-[10px] font-medium leading-4 text-[var(--user-accent-text)]">
              New
            </span>
          )}
          {usedTypes.has(def.type) && (
            <span className="text-[10px] font-normal text-muted-foreground">· on page</span>
          )}
        </span>
        <span className="mt-0.5 block text-2xs leading-snug text-muted-foreground">
          {reason ?? def.description}
        </span>
      </span>
      <Plus
        aria-hidden
        className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-visible/item:opacity-100"
      />
    </button>
  );
  const group = (title: string, children: React.ReactNode, accent?: boolean) => (
    <section className="mt-3 first:mt-0">
      <h3
        className={cn(
          "t-label mb-1 flex items-center gap-1 px-2",
          accent && "text-[var(--user-accent-text)]",
        )}
      >
        {accent && <Sparkles className="h-3 w-3" aria-hidden />}
        {title}
      </h3>
      {children}
    </section>
  );
  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="space-y-2 border-b border-border px-3 py-2.5">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search blocks"
            aria-label="Search blocks"
            className="w-full rounded-sm border border-border bg-[var(--surface-sunken)] py-1.5 pl-7 pr-2 text-xs outline-none focus-visible:border-[var(--user-accent-border)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]"
          />
        </div>
        <label className="flex items-center gap-2">
          <span className="shrink-0 text-2xs text-muted-foreground">Add to</span>
          {/* Studio chrome keeps its compact sunken control instead of the app field grammar. */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <select
            value={target ?? ""}
            onChange={(event) => props.onPaletteTargetChange(event.target.value)}
            className="min-w-0 flex-1 rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1 text-xs"
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {sectionLabel(section)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-2.5">
        {query.trim() ? (
          blocks.length > 0 ? (
            blocks.map((def) => blockItem(def))
          ) : (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No blocks match “{query.trim()}”.
            </p>
          )
        ) : (
          <>
            {suggestions.length > 0 &&
              group(
                "Suggested for you",
                suggestions.map((s) => blockItem(getBlock(s.type)!, s.reason)),
                true,
              )}
            {BLOCK_CATEGORY_ORDER.map((category) => {
              const categoryBlocks = blocks.filter((b) => b.category === category);
              if (categoryBlocks.length === 0) return null;
              return (
                <Fragment key={category}>
                  {group(
                    BLOCK_CATEGORY_LABELS[category],
                    categoryBlocks.map((def) => blockItem(def)),
                  )}
                </Fragment>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

const ARRANGEMENTS: Array<{ how: GridArrangement; label: string; oneArea?: boolean }> = [
  { how: "match-width", label: "Match widths" },
  { how: "match-height", label: "Match heights" },
  { how: "align-left", label: "Align left edges" },
  { how: "align-top", label: "Align tops", oneArea: true },
  { how: "row", label: "Side by side", oneArea: true },
];

/** The Block tab while several blocks are selected: changes that apply to
 *  all of them at once, each a single undo step. "First" means the block
 *  picked first, which the layout tools line the others up against. */
function MultiBlockInspector(props: GStudioSurfaceProps) {
  const [copied] = useState<Partial<LayoutBlockInstance> | null>(readStyleClipboard);
  const ids = props.selectedBlockIds;
  const all = props.layout.sections.flatMap((section) =>
    section.blocks.map((block) => ({ block, section })),
  );
  const picked = ids
    .map((id) => all.find((entry) => entry.block.id === id))
    .filter((entry): entry is (typeof all)[number] => !!entry);
  const blocks = picked.map((entry) => entry.block);
  const first = blocks[0];
  const oneArea = new Set(picked.map((entry) => entry.section.id)).size === 1;
  const allHidden = blocks.every((block) => block.visible === false);
  const allLocked = blocks.every((block) => block.locked === true);
  const count = `${blocks.length} blocks`;
  const button =
    "rounded-sm border border-border px-2 py-1 text-2xs text-foreground outline-none hover:border-[var(--user-accent-border)] hover:bg-[var(--surface-sunken)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent";
  if (!first) return null;
  const firstStyle = Object.fromEntries(
    STYLE_KEYS.map((key) => [key, first[key]]),
  ) as Partial<LayoutBlockInstance>;
  return (
    <div className="p-3">
      <header className="flex items-start gap-2.5 border-b border-border pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">{count} selected</h2>
          <p className="mt-0.5 text-2xs leading-snug text-muted-foreground">
            Shift-click a block to add or drop it. Changes apply to all of them.
          </p>
        </div>
        <IconButton label="Clear selection (Esc)" onClick={() => props.onSelect(null)}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </header>
      <ol className="space-y-0.5 border-b border-border py-2" aria-label="Selected blocks">
        {picked.map(({ block, section }, index) => (
          <li key={block.id} className="flex items-center gap-2 text-xs">
            <span className="w-4 text-right text-2xs tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-foreground">
              {getBlock(block.type)?.label ?? block.type}
              <span className="text-muted-foreground"> · {sectionLabel(section)}</span>
            </span>
            <IconButton
              label={`Drop ${getBlock(block.type)?.label ?? block.type} from the selection`}
              onClick={() => props.onSelect(block.id, { toggle: true })}
            >
              <X className="h-3 w-3" />
            </IconButton>
          </li>
        ))}
      </ol>
      <section className="border-b border-border py-3">
        <p className="t-label mb-2">Show and lock</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={button}
            onClick={() =>
              props.onApplyBlockStyle(
                ids,
                { visible: allHidden },
                `${allHidden ? "Showing" : "Hid"} ${count}`,
              )
            }
          >
            {allHidden ? (
              <Eye className="mr-1 inline h-3 w-3" aria-hidden />
            ) : (
              <EyeOff className="mr-1 inline h-3 w-3" aria-hidden />
            )}
            {allHidden ? "Show all" : "Hide all"}
          </button>
          <button
            type="button"
            className={button}
            onClick={() =>
              props.onApplyBlockStyle(
                ids,
                { locked: !allLocked },
                `${allLocked ? "Unlocked" : "Locked"} ${count}`,
              )
            }
          >
            {allLocked ? (
              <LockOpen className="mr-1 inline h-3 w-3" aria-hidden />
            ) : (
              <Lock className="mr-1 inline h-3 w-3" aria-hidden />
            )}
            {allLocked ? "Unlock all" : "Lock all"}
          </button>
        </div>
      </section>
      <section className="border-b border-border py-3">
        <p className="t-label mb-2">Look</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={button}
            onClick={() => props.onApplyBlockStyle(ids, firstStyle)}
          >
            Match the first block&rsquo;s style
          </button>
          <button
            type="button"
            className={button}
            disabled={!copied}
            title={copied ? undefined : "Copy a block's style first"}
            onClick={() => copied && props.onApplyBlockStyle(ids, copied)}
          >
            Paste copied style
          </button>
        </div>
      </section>
      <section className="border-b border-border py-3">
        <p className="t-label mb-1">Layout</p>
        <p className="mb-2 text-2xs leading-snug text-muted-foreground">
          Lines the others up against block 1. Blocks in the way move down.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ARRANGEMENTS.map(({ how, label, oneArea: needsOneArea }) => (
            <button
              key={how}
              type="button"
              className={button}
              disabled={needsOneArea && !oneArea}
              title={needsOneArea && !oneArea ? "Pick blocks from one area" : undefined}
              onClick={() => props.onArrangeBlocks(ids, how)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <div className="flex flex-col gap-1.5 pt-3">
        <Button
          variant="outline"
          size="sm"
          className="justify-center"
          onClick={() => props.onGroupIntoArea(ids)}
        >
          <FolderInput className="h-3 w-3" /> Group into a new area
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="justify-center text-destructive hover:text-destructive"
          onClick={() => props.onRemoveBlocks(ids)}
        >
          <Trash2 className="h-3 w-3" /> Remove {count}
        </Button>
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
      <header className="flex items-start gap-2.5 border-b border-border pb-3">
        <BlockIcon name={def.icon} />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">{def.label}</h2>
          <p className="mt-0.5 text-2xs leading-snug text-muted-foreground">{def.description}</p>
        </div>
        <IconButton label="Deselect block (Esc)" onClick={onClose}>
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
      <BlockFields
        definition={def}
        config={block.config}
        onChange={(config) => props.onUpdateBlockConfig(block.id, config)}
      />
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
