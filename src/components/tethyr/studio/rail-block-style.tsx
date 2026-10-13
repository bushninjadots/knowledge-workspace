// ── Studio rail: a block's frame and style ───────────────────────────────────────
// The Block tab's look controls: shape presets, surface role, copy/paste style,
// and the frame section (border, fill, padding) for the selected block.

import { useState } from "react";
import { Frame, Sliders } from "lucide-react";
import { toast } from "sonner";
import { getBlock } from "@/lib/block-registry";
import type { LayoutBlockInstance } from "@/lib/page-blocks";
import { cn } from "@/lib/utils";
import {
  BlockFrameBorder,
  BLOCK_INSET_DEFAULT_PX,
  BLOCK_INSET_MAX,
  BLOCK_INSET_MIN,
  BLOCK_RADIUS_MAX,
  BLOCK_RADIUS_MIN,
} from "@/lib/studio-block-frame";
import type { BlockShape } from "@/lib/page-blocks";
import { findSection } from "@/lib/studio-grid";
import { Switch } from "./block-fields";
import { Choice } from "./studio-controls";
import type { GStudioSurfaceProps } from "./g-studio-surface";

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

/** Tiny preview of a shape silhouette at 28×20. A box with the shape's own
 *  CSS border-radius, so organic/blob/leaf curves show truly — an SVG <rect>
 *  can't take those values (it drew them square and logged errors). */
function ShapeThumbnail({ radius, active }: { radius: string; active: boolean }) {
  return (
    <span className="flex h-5 w-7 shrink-0 items-center justify-center" aria-hidden>
      <span
        className="block h-4 w-6"
        style={{
          borderRadius: radius,
          background: active ? "var(--user-accent-subtle)" : "var(--surface-sunken)",
          border: `0.8px solid ${active ? "var(--user-accent)" : "var(--border-strong)"}`,
        }}
      />
    </span>
  );
}

/** Per-block frame controls in the inspector: shape, border on/off (plus
 *  "follow appearance"), inner spacing, and corner radius. Writes the block's
 *  `frameBorder`/`frameInset`/`frameShape`/`frameRadius` fields; the shared
 *  `.studio-block` utility renders them on every surface (editor, owner view,
 *  public page). */
/** The look a block carries (not its content or place). */
export const STYLE_KEYS = [
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

export function readStyleClipboard(): Partial<LayoutBlockInstance> | null {
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

/** A block's surface as one choice. Each role sets the block's own fill,
 *  outline, shadow and inner spacing together; "Profile style" clears them so
 *  the block follows the page's Surfaces and Borders again. */
const SURFACE_ROLES: Array<{
  id: string;
  label: string;
  patch: Pick<LayoutBlockInstance, "frameFill" | "frameBorder" | "frameShadow" | "frameInset">;
}> = [
  {
    id: "profile",
    label: "Profile style",
    patch: {
      frameFill: undefined,
      frameBorder: undefined,
      frameShadow: undefined,
      frameInset: undefined,
    },
  },
  {
    id: "open",
    label: "Open",
    patch: { frameFill: "none", frameBorder: "none", frameShadow: undefined, frameInset: 0 },
  },
  {
    id: "minimal",
    label: "Minimal",
    patch: { frameFill: "none", frameBorder: "none", frameShadow: undefined, frameInset: 10 },
  },
  {
    id: "framed",
    label: "Framed",
    patch: {
      frameFill: undefined,
      frameBorder: "frame",
      frameShadow: "none",
      frameInset: undefined,
    },
  },
  {
    id: "raised",
    label: "Raised",
    patch: {
      frameFill: undefined,
      frameBorder: "none",
      frameShadow: "lifted",
      frameInset: undefined,
    },
  },
  {
    id: "inset",
    label: "Inset",
    patch: { frameFill: "tint", frameBorder: "none", frameShadow: "none", frameInset: undefined },
  },
  {
    id: "accent",
    label: "Accent",
    patch: {
      frameFill: "accent",
      frameBorder: "none",
      frameShadow: undefined,
      frameInset: undefined,
    },
  },
  {
    id: "feature",
    label: "Feature",
    patch: { frameFill: "gradient", frameBorder: "none", frameShadow: "soft", frameInset: 28 },
  },
];

function surfaceRole(block: LayoutBlockInstance): string {
  const same = (patch: (typeof SURFACE_ROLES)[number]["patch"]) =>
    (Object.keys(patch) as Array<keyof typeof patch>).every(
      (key) => (block[key] ?? undefined) === (patch[key] ?? undefined),
    );
  return SURFACE_ROLES.find((role) => same(role.patch))?.id ?? "custom";
}

function SurfaceRoles({ block, ...props }: GStudioSurfaceProps & { block: LayoutBlockInstance }) {
  const current = surfaceRole(block);
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p className="t-label">Surface</p>
        <span className="text-2xs text-muted-foreground" aria-live="polite">
          {current === "profile"
            ? "Using profile style"
            : current === "custom"
              ? "Customized below"
              : "This block only"}
        </span>
      </div>
      <div role="radiogroup" aria-label="Block surface" className="grid grid-cols-4 gap-1">
        {SURFACE_ROLES.map((role) => (
          <button
            key={role.id}
            type="button"
            role="radio"
            aria-checked={current === role.id}
            onClick={() => props.onBlockAction(block.id, role.patch)}
            className={cn(
              "rounded-sm border px-1 py-1.5 text-2xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]",
              current === role.id
                ? "border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)] text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {role.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BlockFrameSection({
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
      {!flush && <SurfaceRoles block={block} {...props} />}
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
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs text-foreground">Overlap the piece above</span>
            <Switch
              label="Overlap the piece above"
              checked={block.overlap === "up"}
              onChange={(checked) =>
                props.onBlockAction(block.id, { overlap: checked ? "up" : undefined })
              }
            />
          </div>
          <p className="mb-3 text-2xs leading-snug text-muted-foreground">
            Layers this block over the edge of whatever sits above it, collage-style. Shows in
            Preview and on your page; phones stack as usual.
          </p>
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
