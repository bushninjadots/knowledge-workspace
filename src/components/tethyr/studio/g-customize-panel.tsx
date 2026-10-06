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
import { useTheme as useAppTheme } from "@/lib/theme";
import { DEFAULT_THEME_ID } from "@/lib/constants";
import { getBlock } from "@/lib/block-registry";
import type { LayoutBlockInstance, PageLayout } from "@/lib/page-blocks";
import { cn } from "@/lib/utils";
import {
  CARD_FILL_SWATCHES,
  RADIUS_MAX,
  RADIUS_MIN,
  personalityPatch,
  type PersonalityId,
} from "@/lib/studio-config";
import { FONT_OPTIONS } from "@/lib/fonts";
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
  const { themePreset: siteWidePreset, setThemePreset } = useAppTheme();
  const current = themeId && themeId.length > 0 ? themeId : DEFAULT_THEME_ID;
  const pick = (preset: ThemePreset | null) => onThemeChange(preset ? preset.id : null);

  return (
    <div className="mb-4 shrink-0">
      <p className="t-label mb-1.5">Theme</p>
      <p className="mb-1.5 text-2xs leading-snug text-muted-foreground-subtle">
        A premade look — colours and type — applied across your Studio.
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
      {/* Its own labelled group: this reaches beyond the Studio into the whole
          app, so it must not read as part of the Studio-only tile grid. */}
      <div className="mt-3 border-t border-border/60 pt-3">
        <p className="t-label mb-1.5">App-wide</p>
        <p className="mb-1.5 text-2xs leading-snug text-muted-foreground-subtle">
          Apply this theme to every page of the app, including the navigation.
        </p>
        <button
          type="button"
          onClick={() => setThemePreset(current === DEFAULT_THEME_ID ? null : current)}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-2xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1",
            siteWidePreset && siteWidePreset === current
              ? "border-[var(--user-accent-border)] bg-[var(--user-accent-subtle)] text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutGrid className="h-3 w-3" aria-hidden />
          {siteWidePreset && siteWidePreset === current ? "Applied site-wide" : "Apply site-wide"}
        </button>
      </div>
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

/** Every font decision in one place, shared by the desktop panel and the
 *  mobile Style sheet. Personality sets the heading scale and fills in its
 *  paired heading face; the Headings and Body pickers are what the page
 *  actually renders, so there is nothing hidden to override. */
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
        label="Personality"
        hint="Heading size and character. Picking one sets its heading face below: Editorial uses Space Grotesk, Technical uses JetBrains Mono, Modern uses the theme's."
        value={config.personality}
        options={[
          ["modern", "Modern"],
          ["editorial", "Editorial"],
          ["technical", "Technical"],
        ]}
        onChange={(value) => onChange(personalityPatch(value as PersonalityId))}
      />
      <Choice
        label="Heading font"
        value={config.headingFont ?? ""}
        options={FONT_CHOICES}
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
        options={FONT_CHOICES}
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
};

const STYLE_TABS = [
  ["look", "Look"],
  ["type", "Type"],
  ["layout", "Layout"],
  ["cards", "Cards"],
  ["outline", "Outline"],
] as const;
type StyleTab = (typeof STYLE_TABS)[number][0];
const STUDIO_STYLE_TAB_KEY = "studio-style-tab";

/**
 * The Studio's style settings, in five small groups instead of one long
 * scroll: Look (theme, accent, background), Type (personality, faces, block
 * titles), Layout (width, spacing, corners), Cards (outlines and fill) and
 * Outline (every area and block). Shared by the desktop rail and the phone
 * sheet, so both always offer the same settings.
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
}: StyleSectionProps) {
  const [tab, setTab] = useState<StyleTab>("look");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STUDIO_STYLE_TAB_KEY);
      if (STYLE_TABS.some(([value]) => value === saved)) setTab(saved as StyleTab);
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
  return (
    // The group tabs sit above the scrolling settings (not inside them), so
    // nothing ever scrolls underneath them.
    <div className="flex h-full min-h-0 flex-col">
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
        {tab === "look" && (
          <>
            <ThemeSection themeId={themeId} onThemeChange={onThemeChange} />
            <Choice
              label="Motion"
              hint="Blocks rise gently into place as visitors scroll. Off for anyone who prefers reduced motion."
              value={config.motion ?? "none"}
              options={[
                ["none", "Still"],
                ["rise", "Rise in"],
              ]}
              onChange={(value) => onChange({ motion: value === "rise" ? "rise" : "none" })}
            />
            <Choice
              label="Accent"
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
          </>
        )}
        {tab === "type" && (
          <>
            <TypeSection config={config} onChange={onChange} />
            <Choice
              label="Block titles"
              hint="How every block's title is set. Rename or hide one in its own settings."
              value={config.blockTitles ?? "label"}
              options={[
                ["label", "Label"],
                ["heading", "Heading"],
                ["hidden", "Hidden"],
              ]}
              onChange={(value) => onChange({ blockTitles: value as GStudioConfig["blockTitles"] })}
            />
          </>
        )}
        {tab === "layout" && (
          <>
            <Choice
              label="Structure"
              hint="How wide your Studio reads"
              value={config.structure}
              options={[
                ["single", "Column"],
                ["sidebar", "Balanced"],
                ["wide", "Wide"],
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
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="t-label">Corners</p>
                <span className="t-label tabular-nums">{config.radius}px</span>
              </div>
              <p className="mb-1.5 text-2xs leading-snug text-muted-foreground">
                Roundness of card corners, from sharp to generously soft.
              </p>
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
            </div>
          </>
        )}
        {tab === "cards" && (
          <>
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
            <div className="mb-4">
              <div className="mb-2 flex items-start gap-2">
                <Frame
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--user-accent-text)]"
                  aria-hidden
                />
                <div>
                  <p className="text-xs font-medium text-foreground">Card outlines</p>
                  <p className="mt-0.5 text-2xs leading-snug text-muted-foreground">
                    One default for every card and panel. Per-block overrides live in the block
                    inspector and are optional.
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
                  if (next === "custom" && !cardBorderColor)
                    onCardBorderColorChange(BORDER_SWATCHES[0]);
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
                          cardBorderColor.toLowerCase() === swatch
                            ? "border-foreground"
                            : "border-border",
                        )}
                        style={{ backgroundColor: swatch }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
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
