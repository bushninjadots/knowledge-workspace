// Studio "Style" panel — theme, presets, and page-level appearance
// settings, shared by the desktop panel and the mobile edit sheet.
//
// Split out of g-studio-surface.tsx.
import { useEffect, useState } from "react";
import { Eye, EyeOff, Frame, LayoutGrid, Palette, Plus } from "lucide-react";
import {
  BORDER_SWATCHES,
  CARD_BORDER_OPTIONS,
  type CardBorderPreference,
} from "@/lib/background-themes";
import { useThemePresets, presetSwatch, type ThemePreset } from "@/hooks/use-theme";
import { DEFAULT_THEME_ID } from "@/lib/constants";
import { getBlock } from "@/lib/block-registry";
import type { LayoutBlockInstance, PageLayout } from "@/lib/page-blocks";
import { cn } from "@/lib/utils";
import { CARD_FILL_SWATCHES, RADIUS_MAX, RADIUS_MIN } from "@/lib/studio-config";
import { FONT_OPTIONS } from "@/lib/fonts";
import { resolveTitles } from "@/lib/visual-language";
import { starterMap } from "@/data/starters";
import { LayoutPreview } from "./layout-preview";
import { FineTune, GroupHeading, LanguagePicker, LookOptions } from "./look-controls";
import { sectionLabel } from "@/lib/studio-grid";
import { IconButton, Choice } from "./studio-controls";
import type { GStudioConfig } from "./g-studio-surface";

const ACCENT_SWATCHES: Array<[hex: string, name: string]> = [
  ["#3f8f8a", "Teal"],
  ["#2f6fd0", "Blue"],
  ["#7a4ecf", "Violet"],
  ["#b4632a", "Copper"],
  ["#2f7d4a", "Green"],
  ["#1f2328", "Ink"],
];

/** Theme preset picker shared by the desktop Customize panel and the mobile
 *  Style sheet. "Default" clears the page theme back to the Tethyr base;
 *  every curated theme applies its full token palette across the Studio. */
export function ThemeSection({
  themeId,
  onThemeChange,
}: {
  themeId: string | null;
  onThemeChange: (themeId: string | null) => void;
}) {
  const { data: presets = [] } = useThemePresets();
  const current = themeId && themeId.length > 0 ? themeId : DEFAULT_THEME_ID;
  const pick = (preset: ThemePreset | null) => onThemeChange(preset ? preset.id : null);

  return (
    <div className="mb-4 shrink-0">
      <p className="t-label mb-1.5">Profile theme</p>
      <p className="mb-1.5 text-2xs leading-snug text-muted-foreground-subtle">
        Palette, faces, corners and depth for your public profile.
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <ThemePick
          name="Default"
          swatch={presetSwatchForDefault(presets)}
          active={current === DEFAULT_THEME_ID}
          onClick={() => pick(null)}
        />
        {presets
          .filter((preset) => preset.id !== DEFAULT_THEME_ID)
          .map((preset) => (
            <ThemePick
              key={preset.id}
              name={preset.name}
              swatch={presetSwatch(preset)}
              active={current === preset.id}
              onClick={() => pick(preset)}
            />
          ))}
      </div>
      <p className="mt-2 text-2xs leading-snug text-muted-foreground-subtle">
        Tethyr&rsquo;s own look — for you, while you work — is{" "}
        <a
          href="/settings#site-appearance"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Site appearance in Settings
        </a>
        .
      </p>
    </div>
  );
}

function ThemePick({
  name,
  swatch,
  active,
  onClick,
}: {
  name: string;
  swatch: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={name}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1",
        active
          ? "border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)]"
          : "border-border hover:border-[var(--user-accent-border)]",
      )}
    >
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-full border border-border/60"
        style={{ backgroundColor: swatch }}
      />
      <span className="min-w-0 truncate text-2xs text-foreground">{name}</span>
    </button>
  );
}

// Typeface choices: "" keeps the theme's own face; the rest are the shared
// font catalog the published page loads.
const FONT_CHOICES: Array<[string, string]> = [
  ["", "Theme’s face"],
  ...FONT_OPTIONS.map((option) => [option.id, option.label] as [string, string]),
];

/** Hand-picked faces: fine-tuning under Typography. A type pairing sets
 *  these; picking one here overrides the pairing for that role only. */
export function TypeSection({
  config,
  onChange,
}: {
  config: GStudioConfig;
  onChange: (patch: Partial<GStudioConfig>) => void;
}) {
  return (
    <>
      <Choice
        label="Heading font"
        value={config.headingFont ?? ""}
        options={[["", "Pairing’s"], ...FONT_CHOICES.slice(1)]}
        onChange={(value) =>
          onChange({
            headingFont: value ? (value as GStudioConfig["headingFont"]) : null,
            fontModel: 2,
          })
        }
      />
      <Choice
        label="Body font"
        value={config.bodyFont ?? ""}
        options={[["", "Pairing’s"], ...FONT_CHOICES.slice(1)]}
        onChange={(value) =>
          onChange({ bodyFont: value ? (value as GStudioConfig["bodyFont"]) : null })
        }
      />
    </>
  );
}

/** Swatch for the "Default" tile: mirror the Tethyr Default theme's primary
 *  when present, else the neutral base. */
function presetSwatchForDefault(presets: ThemePreset[]): string {
  const tethyr = presets.find((p) => p.id === DEFAULT_THEME_ID);
  return tethyr ? presetSwatch(tethyr) : "#3f8f8a";
}

/** Advanced appearance settings (density → content tree) shared by the
 *  desktop Customize panel and the mobile Style tab — one list, so phone
 *  parity is structural instead of a hand-maintained promise. */
export type StyleSectionProps = {
  config: GStudioConfig;
  layout: PageLayout;
  onChange: (patch: Partial<GStudioConfig>) => void;
  themeId: string | null;
  onThemeChange: (themeId: string | null) => void;
  cardBorders: CardBorderPreference;
  cardBorderColor: string;
  onCardBordersChange: (cardBorders: CardBorderPreference) => void;
  onCardBorderColorChange: (color: string) => void;
  onToggleSection: (id: string) => void;
  onBlockAction: (id: string, patch: Partial<LayoutBlockInstance>) => void;
  onSelect: (id: string | null) => void;
  selectedBlockId: string | null;
  onCompleteProfile?: () => void;
  /** Opens the shared background/appearance dialog (banner → Appearance). */
  onOpenAppearance?: () => void;
  /** Opens the layout picker. */
  onOpenLayouts?: () => void;
};

const STYLE_TABS = [
  ["identity", "Identity"],
  ["style", "Look"],
  ["layout", "Layout"],
  ["outline", "Outline"],
] as const;
type StyleTab = (typeof STYLE_TABS)[number][0];
const STUDIO_STYLE_TAB_KEY = "studio-style-tab";

/**
 * The Studio's style settings in four layers: Identity (what the space feels
 * like: visual language, header, typography, colour, background), Look (how
 * that looks: surfaces, borders, dividers, grid, shapes, images, rhythm,
 * details, motion), Layout (width and density) and Outline (every area and
 * block). Lower-level controls sit under each group's "Fine tune". Shared by
 * the desktop rail and the phone sheet, so both always offer the same settings.
 */
export function GStyleSections({
  config,
  layout,
  onChange,
  themeId,
  onThemeChange,
  cardBorders,
  cardBorderColor,
  onCardBordersChange,
  onCardBorderColorChange,
  onToggleSection,
  onBlockAction,
  onSelect,
  selectedBlockId,
  onOpenAppearance,
  onOpenLayouts,
}: StyleSectionProps) {
  const [tab, setTab] = useState<StyleTab>("identity");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STUDIO_STYLE_TAB_KEY);
      if (STYLE_TABS.some(([value]) => value === saved)) setTab(saved as StyleTab);
      // Tabs from before the visual language: Look/Type → Identity, Cards → Style.
      else if (saved === "look" || saved === "type") setTab("identity");
      else if (saved === "cards") setTab("style");
    } catch {
      // Storage unavailable: start on Look.
    }
  }, []);
  const choose = (next: StyleTab) => {
    setTab(next);
    try {
      window.localStorage.setItem(STUDIO_STYLE_TAB_KEY, next);
    } catch {
      // Storage unavailable: the choice lasts for this visit.
    }
  };
  // The shared card outline (member appearance) and card fill: fine-tuning
  // under Borders and Surfaces.
  const CARD_OUTLINE_CONTROLS = (
    <div className="mb-4">
      <div className="mb-2 flex items-start gap-2">
        <Frame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--user-accent-text)]" aria-hidden />
        <div>
          <p className="text-xs font-medium text-foreground">Card outlines</p>
          <p className="mt-0.5 text-2xs leading-snug text-muted-foreground">
            One default for every card and panel. Per-block overrides live in the block inspector
            and are optional.
          </p>
        </div>
      </div>
      <Choice
        label="Outline style"
        hint="Theme is quiet · Accent follows your Studio accent · Colour pins one · None hides outlines. Part of your profile, so visitors see a change as soon as it saves, without publishing."
        value={cardBorders}
        options={CARD_BORDER_OPTIONS.map((option) => [option.id, option.label])}
        onChange={(value) => {
          const next = value as CardBorderPreference;
          onCardBordersChange(next);
          // Picking "Colour" must show a colour straight away — with none set
          // the resolver falls back to the accent and the choice reads broken.
          if (next === "custom" && !cardBorderColor) onCardBorderColorChange(BORDER_SWATCHES[0]);
        }}
      />
      <Choice
        label="Line weight"
        hint="How strong the shared outline appears"
        value={config.cardBorderWidth ?? "thin"}
        options={[
          ["thin", "Thin"],
          ["medium", "Medium"],
          ["thick", "Thick"],
        ]}
        onChange={(value) =>
          onChange({ cardBorderWidth: value as GStudioConfig["cardBorderWidth"] })
        }
      />
      {cardBorders === "custom" && (
        <div className="mb-1" role="group" aria-label="Card outline colour">
          <p className="t-label mb-1.5">Outline colour</p>
          <div className="flex flex-wrap gap-1.5">
            {BORDER_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Card border ${swatch}`}
                aria-pressed={cardBorderColor.toLowerCase() === swatch}
                onClick={() => onCardBorderColorChange(swatch)}
                className={cn(
                  "h-6 w-6 rounded-sm border-2",
                  cardBorderColor.toLowerCase() === swatch ? "border-foreground" : "border-border",
                )}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
  const CARD_FILL_CONTROLS = (
    <div className="mb-4">
      <p className="t-label mb-1.5">Card fill</p>
      <p className="mb-1.5 text-2xs leading-snug text-muted-foreground-subtle">
        Colour and translucency of every block surface
      </p>
      <div className="flex flex-wrap gap-1.5">
        {CARD_FILL_SWATCHES.map((swatch) => (
          <button
            key={swatch.value || "auto"}
            type="button"
            title={swatch.label}
            aria-label={`Card fill ${swatch.label}`}
            aria-pressed={(config.cardColor ?? "").toLowerCase() === swatch.value}
            onClick={() => onChange({ cardColor: swatch.value })}
            className={cn(
              "h-6 w-6 rounded-sm border-2 text-3xs",
              (config.cardColor ?? "").toLowerCase() === swatch.value
                ? "border-foreground"
                : "border-border",
            )}
            style={
              swatch.value
                ? { backgroundColor: swatch.value }
                : { backgroundColor: "var(--surface-elevated)" }
            }
          >
            {swatch.value ? "" : "A"}
          </button>
        ))}
      </div>
      <label className="mt-2 block">
        <span className="mb-1 flex items-center justify-between">
          <span className="t-label">Opacity</span>
          <span className="t-label tabular-nums">{config.cardOpacity}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={config.cardOpacity}
          onChange={(event) => onChange({ cardOpacity: Number(event.target.value) })}
          aria-label="Card fill opacity"
          className="studio-slider w-full"
        />
      </label>
    </div>
  );
  return (
    // The group tabs sit above the scrolling settings (not inside them), so
    // nothing ever scrolls underneath them.
    <div className="flex h-full min-h-0 flex-col">
      <p className="shrink-0 border-b border-border bg-[var(--surface-elevated)] px-3 pt-2 text-2xs leading-snug text-muted-foreground">
        <span className="font-medium text-foreground">Profile appearance</span> — applies only to
        your public profile.
      </p>
      <div
        role="tablist"
        aria-label="Style settings"
        className="flex shrink-0 gap-0.5 border-b border-border bg-[var(--surface-elevated)] px-3 py-2"
      >
        {STYLE_TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => choose(value)}
            className={cn(
              "flex-1 rounded-sm px-1 py-1 text-2xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] pointer-coarse:py-2.5",
              tab === value
                ? "bg-[var(--surface-sunken)] font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        aria-label={STYLE_TABS.find(([v]) => v === tab)?.[1]}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
      >
        {tab === "identity" && (
          <>
            <LanguagePicker config={config} onChange={onChange} />
            <GroupHeading
              config={config}
              group="header"
              onChange={onChange}
              hint="How your name, photo and banner meet visitors."
            />
            <LookOptions config={config} setting="header" onChange={onChange} label="Header" />
            <GroupHeading config={config} group="typography" onChange={onChange} />
            <LookOptions
              config={config}
              setting="typePairing"
              onChange={onChange}
              label="Type pairing"
              columns={4}
            />
            <p className="t-label mb-1.5">Scale</p>
            <LookOptions
              config={config}
              setting="typeScale"
              onChange={onChange}
              label="Type scale"
              columns={4}
            />
            <FineTune>
              <TypeSection config={config} onChange={onChange} />
              <Choice
                label="Block titles"
                hint="How every block's title is set. Rename or hide one in its own settings."
                value={resolveTitles(config)}
                options={[
                  ["label", "Label"],
                  ["heading", "Heading"],
                  ["hidden", "Hidden"],
                ]}
                onChange={(value) =>
                  onChange({ blockTitles: value as GStudioConfig["blockTitles"] })
                }
              />
            </FineTune>
            <GroupHeading
              config={config}
              group="colour"
              onChange={onChange}
              hint="The atmosphere sets the page's light, ink and surfaces; accent sets where your colour shows."
            />
            <LookOptions
              config={config}
              setting="atmosphere"
              onChange={onChange}
              label="Atmosphere"
            />
            <p className="t-label mb-1.5">Accent</p>
            <LookOptions
              config={config}
              setting="accent"
              onChange={onChange}
              label="Accent behaviour"
            />
            <Choice
              label="Light & dark"
              hint="Follow each visitor shows your profile in their light or dark mode. Always as designed keeps your theme's own mode — a dark theme stays dark."
              value={config.colorMode ?? "visitor"}
              options={[
                ["visitor", "Follow each visitor"],
                ["theme", "Always as designed"],
              ]}
              onChange={(value) => onChange({ colorMode: value === "theme" ? "theme" : undefined })}
            />
            <Choice
              label="Accent colour"
              hint={
                config.accentMode === "dual"
                  ? "Pick an interactive colour; the banner colour tints the background"
                  : config.accentMode === "none"
                    ? "No colour accent — the theme carries the Studio"
                    : undefined
              }
              value={config.accentMode}
              options={[
                ["custom", "Pick"],
                ["dual", "Banner + colour"],
                ["none", "None"],
              ]}
              onChange={(value) => onChange({ accentMode: value as GStudioConfig["accentMode"] })}
            />
            {(config.accentMode === "custom" || config.accentMode === "dual") && (
              <div className="mt-1.5 mb-4 flex flex-wrap items-center gap-1.5">
                {ACCENT_SWATCHES.map(([swatch, name]) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`${name} accent`}
                    title={name}
                    aria-pressed={config.accentColor.toLowerCase() === swatch}
                    onClick={() => onChange({ accentColor: swatch })}
                    className={cn(
                      "h-6 w-6 rounded-sm border-2 pointer-coarse:h-10 pointer-coarse:w-10",
                      config.accentColor.toLowerCase() === swatch
                        ? "border-foreground"
                        : "border-border",
                    )}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
                {/* Any colour works: text drawn in the accent is derived from it at a
              readable contrast, and buttons pick their own label colour. */}
                <label
                  title="Choose any colour"
                  className={cn(
                    "relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm border-2 border-dashed pointer-coarse:h-10 pointer-coarse:w-10",
                    ACCENT_SWATCHES.some(([swatch]) => swatch === config.accentColor.toLowerCase())
                      ? "border-border text-muted-foreground"
                      : "border-foreground text-foreground",
                  )}
                  style={
                    ACCENT_SWATCHES.some(([swatch]) => swatch === config.accentColor.toLowerCase())
                      ? undefined
                      : { backgroundColor: config.accentColor }
                  }
                >
                  <Plus className="h-3 w-3 mix-blend-difference" aria-hidden />
                  <input
                    type="color"
                    aria-label="Custom accent colour"
                    value={config.accentColor.toLowerCase()}
                    onChange={(event) =>
                      onChange({ accentColor: event.target.value.toLowerCase() })
                    }
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
            )}
            <div className="mb-4">
              <p className="t-label mb-1.5">Background</p>
              <p className="mb-2 text-2xs leading-snug text-muted-foreground-subtle">
                Colour, pattern, or image for your app and your public Studio. Saved to your profile
                straight away, so visitors see it without publishing.
              </p>
              {onOpenAppearance ? (
                <button
                  type="button"
                  onClick={onOpenAppearance}
                  className="flex w-full items-center justify-center gap-1.5 rounded-sm border border-border px-2 py-1.5 text-2xs text-foreground transition-lift hover:bg-[var(--surface-sunken)]"
                >
                  <Palette className="h-3 w-3" aria-hidden />
                  Edit background
                </button>
              ) : null}
            </div>
            <ThemeSection themeId={themeId} onThemeChange={onThemeChange} />
          </>
        )}
        {tab === "style" && (
          <>
            <GroupHeading
              config={config}
              group="surfaces"
              onChange={onChange}
              hint="What blocks sit on — a card, or straight on the page."
            />
            <LookOptions config={config} setting="surface" onChange={onChange} label="Surfaces" />
            <FineTune>
              <Choice
                label="Shadow"
                hint="Depth under every block. A block can choose its own in its settings."
                value={config.cardShadow ?? "none"}
                options={[
                  ["none", "Flat"],
                  ["soft", "Soft"],
                  ["lifted", "Lifted"],
                ]}
                onChange={(value) => onChange({ cardShadow: value as GStudioConfig["cardShadow"] })}
              />
              {CARD_FILL_CONTROLS}
            </FineTune>
            <GroupHeading
              config={config}
              group="borders"
              onChange={onChange}
              hint="The line around blocks. A block can pick its own in its settings."
            />
            <LookOptions
              config={config}
              setting="borders"
              onChange={onChange}
              label="Borders"
              columns={4}
            />
            <FineTune>{CARD_OUTLINE_CONTROLS}</FineTune>
            <GroupHeading
              config={config}
              group="dividers"
              onChange={onChange}
              hint="Between areas. An area's own divider (Area settings) replaces this one."
            />
            <LookOptions config={config} setting="dividers" onChange={onChange} label="Dividers" />
            <p className="t-label mb-1.5">Between areas</p>
            <LookOptions
              config={config}
              setting="transitions"
              onChange={onChange}
              label="Between areas"
            />
            <GroupHeading
              config={config}
              group="grid"
              onChange={onChange}
              hint="A visible structure behind the page. The editor's own guides are separate."
            />
            <LookOptions config={config} setting="grid" onChange={onChange} label="Grid" />
            <GroupHeading config={config} group="shapes" onChange={onChange} />
            <LookOptions
              config={config}
              setting="shapes"
              onChange={onChange}
              label="Shapes"
              columns={4}
            />
            <FineTune>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="t-label">Corners</p>
                <span className="t-label tabular-nums">{config.radius}px</span>
              </div>
              <input
                type="range"
                min={RADIUS_MIN}
                max={RADIUS_MAX}
                step={1}
                value={config.radius}
                aria-label="Corner radius in pixels"
                onChange={(event) => onChange({ radius: Number(event.target.value) })}
                className="studio-slider w-full"
              />
            </FineTune>
            <GroupHeading config={config} group="images" onChange={onChange} />
            <LookOptions config={config} setting="images" onChange={onChange} label="Images" />
            <GroupHeading
              config={config}
              group="rhythm"
              onChange={onChange}
              hint="The room between areas. Density (Layout) sets the room between blocks."
            />
            <LookOptions config={config} setting="rhythm" onChange={onChange} label="Rhythm" />
            <GroupHeading
              config={config}
              group="details"
              onChange={onChange}
              hint="Section numbers and small marks."
            />
            <LookOptions config={config} setting="details" onChange={onChange} label="Details" />
            <GroupHeading
              config={config}
              group="motion"
              onChange={onChange}
              hint="How blocks arrive as visitors scroll. Off for anyone who prefers reduced motion."
            />
            <LookOptions config={config} setting="motion" onChange={onChange} label="Motion" />
          </>
        )}
        {tab === "layout" && (
          <>
            <section className="mb-5" aria-labelledby="composition-heading">
              <p id="composition-heading" className="t-label mb-1.5">
                Composition
              </p>
              <p className="mb-2 text-2xs leading-snug text-muted-foreground-subtle">
                <span className="font-medium text-foreground">
                  {config.starterId ? starterMap[config.starterId]?.name : "Your own arrangement"}
                </span>{" "}
                — how your page is arranged. Changing it moves blocks into place; your look stays.
              </p>
              <LayoutPreview
                layout={layout}
                config={config}
                height={120}
                className="mb-2 border border-border"
              />
              {onOpenLayouts && (
                <button
                  type="button"
                  onClick={onOpenLayouts}
                  className="flex w-full items-center justify-center gap-1.5 rounded-sm border border-border px-2 py-1.5 text-2xs text-foreground outline-none hover:bg-[var(--surface-sunken)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))]"
                >
                  <LayoutGrid className="h-3 w-3" aria-hidden />
                  Browse layouts
                </button>
              )}
            </section>
            <Choice
              label="Structure"
              hint="How wide your Studio reads"
              value={config.structure}
              options={[
                ["single", "Column"],
                ["sidebar", "Balanced"],
                ["wide", "Wide"],
                ["full", "Full"],
              ]}
              onChange={(value) => onChange({ structure: value as GStudioConfig["structure"] })}
            />
            <Choice
              label="Density"
              hint="Spacing rhythm between blocks"
              value={config.density}
              options={[
                ["compact", "Compact"],
                ["comfortable", "Comfortable"],
                ["spacious", "Spacious"],
              ]}
              onChange={(value) => onChange({ density: value as GStudioConfig["density"] })}
            />
          </>
        )}
        {tab === "outline" && (
          <div>
            <p className="mb-2 text-2xs leading-snug text-muted-foreground">
              Every area and block on the page. Select one to edit it, or hide it from visitors.
            </p>
            <ul className="space-y-2">
              {layout.sections.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => onToggleSection(section.id)}
                    aria-label={
                      section.visible === false
                        ? `Show ${sectionLabel(section)}`
                        : `Hide ${sectionLabel(section)}`
                    }
                    className="flex min-w-0 w-full items-center gap-1.5 rounded-sm px-1 py-1 text-left hover:bg-[var(--surface-sunken)]"
                  >
                    {section.visible === false ? (
                      <EyeOff className="h-3 w-3 shrink-0 text-muted-foreground-subtle" />
                    ) : (
                      <Eye className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                    <span
                      className={cn(
                        "truncate text-xs",
                        section.visible === false
                          ? "text-muted-foreground-subtle line-through"
                          : "text-foreground",
                      )}
                    >
                      {sectionLabel(section)}
                    </span>
                  </button>
                  <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
                    {section.blocks.map((block) => (
                      <li key={block.id} className="group/block flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => onSelect(block.id)}
                          aria-current={selectedBlockId === block.id ? "true" : undefined}
                          className={cn(
                            "min-w-0 flex-1 truncate rounded-sm px-1 py-1 text-left hover:bg-[var(--surface-sunken)]",
                            selectedBlockId === block.id &&
                              "bg-[var(--user-accent-subtle)] text-[var(--user-accent-text)]",
                          )}
                        >
                          <span
                            className={cn(
                              "truncate text-2xs",
                              block.visible === false
                                ? "text-muted-foreground-subtle line-through"
                                : "text-muted-foreground",
                            )}
                          >
                            {getBlock(block.type)?.label ?? block.type}
                          </span>
                        </button>
                        <IconButton
                          label={
                            block.visible === false
                              ? `Show ${getBlock(block.type)?.label ?? block.type}`
                              : `Hide ${getBlock(block.type)?.label ?? block.type}`
                          }
                          className="h-5 w-5 opacity-0 group-hover/block:opacity-100 focus-visible:opacity-100"
                          onClick={() =>
                            onBlockAction(block.id, { visible: block.visible === false })
                          }
                        >
                          {block.visible === false ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/** Body of the rail's Style tab; the rail owns the frame, tabs and close. */
export function GCustomizePanel(props: StyleSectionProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <GStyleSections {...props} />
    </div>
  );
}
