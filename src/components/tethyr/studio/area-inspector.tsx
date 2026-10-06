// ── Area inspector ────────────────────────────────────────────────────────────
// The rail's Area tab: everything about how one area presents itself — its
// title, background (tint, accent, gradient or image; panel or edge to edge),
// its own accent colour, the gap / alignment / width of its blocks, a divider
// and the room after it. Rendered identically by components/tethyr/page/
// area-frame.tsx in the editor, the owner view and the public page.

import { useId } from "react";
import type { AreaAppearance, LayoutSection } from "@/lib/page-blocks";
import { sectionLabel } from "@/lib/studio-grid";
import { cn } from "@/lib/utils";
import { Choice } from "./studio-controls";
import { Switch } from "./block-fields";

const ACCENTS: Array<[string, string]> = [
  ["#3f8f8a", "Teal"],
  ["#2f6fd0", "Blue"],
  ["#7a4ecf", "Violet"],
  ["#b4632a", "Copper"],
  ["#2f7d4a", "Green"],
  ["#c2410c", "Orange"],
];

export function AreaInspector({
  section,
  onChange,
}: {
  section: LayoutSection;
  onChange: (patch: AreaAppearance) => void;
}) {
  const a = section.appearance ?? {};
  const imageId = useId();
  const titled = !!section.title?.trim() && !/^area\s+\d+$/i.test(section.title.trim());
  const background = a.background ?? "none";
  return (
    <div className="p-3">
      <header className="border-b border-border pb-3">
        <p className="t-label">Area</p>
        <h2 className="mt-1 text-sm font-semibold text-foreground">{sectionLabel(section)}</h2>
        <p className="mt-0.5 text-2xs leading-snug text-muted-foreground">
          How this area sits on the page. Rename it from its header on the canvas.
        </p>
      </header>

      <section className="border-b border-border py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-foreground">
            {titled ? "Show the title on the page" : "Name the area to show a title"}
          </span>
          <Switch
            label="Show the area title on the page"
            checked={titled && a.showTitle !== false}
            onChange={(checked) => titled && onChange({ showTitle: checked })}
          />
        </div>
      </section>

      <section className="border-b border-border py-3">
        <Choice
          label="Background"
          value={background}
          options={[
            ["none", "None"],
            ["tint", "Tint"],
            ["accent", "Accent"],
            ["gradient", "Gradient"],
            ["image", "Image"],
          ]}
          onChange={(value) => onChange({ background: value as AreaAppearance["background"] })}
        />
        {background === "image" && (
          <div className="mb-4">
            <label htmlFor={imageId} className="mb-1 block text-xs font-medium text-foreground">
              Image link
            </label>
            <input
              id={imageId}
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={a.imageUrl ?? ""}
              onChange={(event) => onChange({ imageUrl: event.target.value })}
              className="w-full rounded-sm border border-border bg-[var(--surface-sunken)] px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]"
            />
            <p className="mt-1 text-2xs text-muted-foreground">
              A soft wash goes over the image so blocks stay readable.
            </p>
          </div>
        )}
        {background !== "none" && (
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs text-foreground">Edge to edge</span>
            <Switch
              label="Background runs edge to edge"
              checked={a.bleed === true}
              onChange={(checked) => onChange({ bleed: checked })}
            />
          </div>
        )}
      </section>

      <section className="border-b border-border py-3">
        <p className="t-label mb-1.5">Accent colour</p>
        <p className="mb-2 text-2xs leading-snug text-muted-foreground">
          Buttons, guides and highlights inside this area use it.
        </p>
        <div role="radiogroup" aria-label="Area accent colour" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={!a.accent}
            onClick={() => onChange({ accent: undefined })}
            className={cn(
              "h-7 rounded-sm border px-2 text-2xs",
              !a.accent
                ? "border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)] text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            Studio
          </button>
          {ACCENTS.map(([hex, name]) => (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={a.accent === hex}
              aria-label={`${name} accent`}
              title={name}
              onClick={() => onChange({ accent: hex })}
              className={cn(
                "h-7 w-7 rounded-sm border-2",
                a.accent === hex ? "border-foreground" : "border-border",
              )}
              style={{ backgroundColor: hex }}
            />
          ))}
          <label
            title="Any colour"
            className="relative h-7 w-7 cursor-pointer rounded-sm border-2 border-dashed border-border"
            style={
              a.accent && !ACCENTS.some(([hex]) => hex === a.accent)
                ? { backgroundColor: a.accent, borderStyle: "solid" }
                : undefined
            }
          >
            <input
              type="color"
              aria-label="Custom area accent colour"
              value={a.accent ?? "#3f8f8a"}
              onChange={(event) => onChange({ accent: event.target.value })}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
      </section>

      <section className="border-b border-border py-3">
        <Choice
          label="Gap between blocks"
          value={a.gap ?? "normal"}
          options={[
            ["tight", "Tight"],
            ["normal", "Normal"],
            ["roomy", "Roomy"],
          ]}
          onChange={(value) => onChange({ gap: value as AreaAppearance["gap"] })}
        />
        <Choice
          label="Blocks in a row"
          hint="How blocks of different heights line up on the page."
          value={a.align ?? "start"}
          options={[
            ["start", "Top"],
            ["center", "Middle"],
            ["stretch", "Same height"],
          ]}
          onChange={(value) => onChange({ align: value as AreaAppearance["align"] })}
        />
        <Choice
          label="Width"
          value={a.width ?? "full"}
          options={[
            ["full", "Full"],
            ["narrow", "Narrow"],
          ]}
          onChange={(value) => onChange({ width: value as AreaAppearance["width"] })}
        />
      </section>

      <section className="py-3">
        <Choice
          label="Divider after"
          value={a.divider ?? "none"}
          options={[
            ["none", "None"],
            ["line", "Line"],
            ["dots", "Dots"],
            ["fade", "Fade"],
          ]}
          onChange={(value) => onChange({ divider: value as AreaAppearance["divider"] })}
        />
        <Choice
          label="Space after"
          value={a.spacing ?? "normal"}
          options={[
            ["tight", "Tight"],
            ["normal", "Normal"],
            ["loose", "Generous"],
          ]}
          onChange={(value) => onChange({ spacing: value as AreaAppearance["spacing"] })}
        />
      </section>
    </div>
  );
}
