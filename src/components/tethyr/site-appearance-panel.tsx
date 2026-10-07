// Settings → Site appearance: how Tethyr itself looks to this person, synced
// to their account. Theme (the shared preset catalogue), light/dark, accent, density,
// shape and motion — with a miniature of the app that repaints as they
// choose, so it's unmistakable that this changes Tethyr, not their profile.

import { Link } from "@tanstack/react-router";
import { Check, Home, LayoutGrid, RotateCcw, Sparkles, Users } from "lucide-react";
import { useThemePresets, type ThemePreset } from "@/hooks/use-theme";
import { useTheme as useAppTheme } from "@/lib/theme";
import { DEFAULT_THEME_ID } from "@/lib/constants";
import {
  BANNER_ACCENT,
  DEFAULT_SITE_APPEARANCE,
  SITE_ACCENTS,
  SITE_DENSITY_OPTIONS,
  SITE_SHAPE_OPTIONS,
  type SiteAppearance,
} from "@/lib/site-appearance";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ id: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex border border-border bg-surface-sunken p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "flex-1 rounded-sm px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === option.id
              ? "bg-surface-elevated text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Row({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 border-t border-border/60 pt-4 sm:grid-cols-[12rem_1fr] sm:items-center">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

/** A small Tethyr: sidebar, a page with a card, a field and buttons. It uses
 *  the app's own tokens, so it shows exactly what the choices do. */
function AppMiniature() {
  return (
    <div
      aria-hidden
      className="flex h-44 overflow-hidden border border-border bg-background text-foreground"
    >
      <div className="flex w-32 shrink-0 flex-col gap-1 border-r border-border bg-surface p-2">
        <span className="mb-1 px-1.5 font-display text-xs font-semibold">Tethyr</span>
        {[
          [Home, "Dashboard", true],
          [LayoutGrid, "Explore", false],
          [Users, "Community", false],
        ].map(([Icon, label, active]) => {
          const I = Icon as typeof Home;
          return (
            <span
              key={label as string}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-2xs",
                active ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
            >
              <I className="h-3 w-3" />
              {label as string}
            </span>
          );
        })}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <span className="font-display text-sm font-semibold">Good morning</span>
        <div className="card flex flex-col gap-1.5 p-2.5 shadow-sm">
          <span className="flex items-center justify-between">
            <span className="text-xs font-medium">Bloom</span>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-3xs text-primary">
              Active
            </span>
          </span>
          <span className="text-2xs text-muted-foreground">A journaling app · 3 collaborators</span>
          <span className="h-1 overflow-hidden rounded-full bg-muted">
            <span className="block h-full w-2/3 rounded-full bg-primary" />
          </span>
        </div>
        <span className="flex gap-1.5">
          <span className="flex h-7 flex-1 items-center rounded-md border border-input bg-background px-2 text-2xs text-muted-foreground">
            Search…
          </span>
          <span className="flex h-7 items-center rounded-md bg-primary px-2.5 text-2xs font-medium text-primary-foreground">
            New
          </span>
          <span className="flex h-7 items-center rounded-md border border-border px-2.5 text-2xs">
            Share
          </span>
        </span>
      </div>
    </div>
  );
}

function presetColour(preset: ThemePreset, key: string, fallback: string): string {
  const colors = (preset.tokens as { colors?: Record<string, string> }).colors ?? {};
  return colors[key] ?? fallback;
}

/** Whether a preset's palette is light or dark, from its background. */
function presetScheme(preset: ThemePreset): "light" | "dark" | null {
  const bg = presetColour(preset, "background", "");
  if (!/^#[0-9a-f]{6}$/i.test(bg)) return null;
  const n = Number.parseInt(bg.slice(1), 16);
  const luminance =
    (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return luminance > 0.5 ? "light" : "dark";
}

function ThemeTile({
  preset,
  active,
  onPick,
}: {
  preset: ThemePreset | null;
  active: boolean;
  onPick: () => void;
}) {
  const typography = (preset?.tokens as { typography?: Record<string, string> } | undefined)
    ?.typography;
  const bg = preset ? presetColour(preset, "background", "var(--background)") : "var(--background)";
  const fg = preset ? presetColour(preset, "foreground", "var(--foreground)") : "var(--foreground)";
  const accent = preset ? presetColour(preset, "primary", fg) : "var(--primary)";
  const radius = (preset?.tokens as { borders?: { radius?: Record<string, string> } } | undefined)
    ?.borders?.radius?.lg;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPick}
      className={cn(
        "flex flex-col gap-1.5 border p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary bg-accent" : "border-border hover:border-border-strong",
      )}
    >
      <span
        aria-hidden
        className="flex h-12 items-end justify-between border border-border/60 p-1.5"
        style={{ background: bg, color: fg, borderRadius: radius }}
      >
        <span
          className="text-lg font-semibold leading-none"
          style={{ fontFamily: typography?.headingFont }}
        >
          Aa
        </span>
        <span className="h-3 w-6" style={{ background: accent, borderRadius: radius }} />
      </span>
      <span className="flex items-center justify-between gap-1 px-0.5">
        <span className="truncate text-xs font-medium">{preset?.name ?? "Tethyr Default"}</span>
        {active && <Check className="h-3 w-3 shrink-0" aria-hidden />}
      </span>
    </button>
  );
}

export function SiteAppearancePanel() {
  const {
    themePreset,
    setThemePreset,
    siteAppearance,
    setSiteAppearance,
    resolvedTheme,
    setTheme,
  } = useAppTheme();
  // A theme is light or dark by nature; picking one switches the mode to
  // match, or the palette is rebuilt for the other mode and loses its
  // character (Obsidian would arrive as a pale tint). Mode stays changeable.
  const pickTheme = (preset: ThemePreset | null) => {
    setThemePreset(preset?.id ?? null);
    const scheme = preset ? presetScheme(preset) : null;
    if (scheme && scheme !== resolvedTheme) setTheme(scheme);
  };
  const { data: presets = [] } = useThemePresets();
  const set = (patch: Partial<SiteAppearance>) =>
    setSiteAppearance({ ...siteAppearance, ...patch });
  const customised =
    !!themePreset || JSON.stringify(siteAppearance) !== JSON.stringify(DEFAULT_SITE_APPEARANCE);
  const others = presets.filter((preset) => preset.id !== DEFAULT_THEME_ID);
  const current = presets.find((preset) => preset.id === themePreset);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_15rem]">
        <AppMiniature />
        <div className="text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">{current?.name ?? "Tethyr Default"}</span>
            {` — ${current?.description ?? "Clean, contemporary and human."}`}
          </p>
          <p className="mt-2">
            Follows you to every device you sign in on (light/dark is set per device). It never
            changes how your profile looks to anyone — that&rsquo;s{" "}
            <Link
              to="/studio"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Profile appearance in Studio
            </Link>
            .
          </p>
          {customised && (
            <button
              type="button"
              onClick={() => {
                setThemePreset(null);
                setSiteAppearance({ ...DEFAULT_SITE_APPEARANCE });
              }}
              className="mt-3 inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Reset site appearance
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Theme</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ThemeTile preset={null} active={!themePreset} onPick={() => pickTheme(null)} />
          {others.map((preset) => (
            <ThemeTile
              key={preset.id}
              preset={preset}
              active={themePreset === preset.id}
              onPick={() => pickTheme(preset)}
            />
          ))}
        </div>
      </div>

      <Row title="Mode" hint="Light, dark, or follow the system.">
        <ThemeToggle variant="icon" />
      </Row>
      <Row
        title="Accent"
        hint="Buttons, focus and highlights. Theme keeps the theme's own; From your banner follows your banner image."
      >
        <div role="radiogroup" aria-label="Accent" className="flex flex-wrap gap-1.5">
          {SITE_ACCENTS.map((accent) => (
            <button
              key={accent.label}
              type="button"
              role="radio"
              aria-checked={siteAppearance.accent === accent.value}
              aria-label={accent.label}
              title={accent.label}
              onClick={() => set({ accent: accent.value })}
              className={cn(
                "flex h-7 min-w-7 items-center justify-center border-2 px-1.5 text-2xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
                siteAppearance.accent === accent.value ? "border-foreground" : "border-border",
              )}
              style={accent.value.startsWith("#") ? { backgroundColor: accent.value } : undefined}
            >
              {accent.value === BANNER_ACCENT ? (
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  Banner
                </span>
              ) : accent.value ? (
                ""
              ) : (
                "Theme"
              )}
            </button>
          ))}
        </div>
      </Row>
      <Row title="Density" hint="How much fits on screen. Type stays the same size.">
        <Segmented
          label="Density"
          value={siteAppearance.density}
          options={SITE_DENSITY_OPTIONS}
          onChange={(density) => set({ density })}
        />
      </Row>
      <Row title="Shape" hint="Corners of buttons, fields, cards and dialogs.">
        <Segmented
          label="Shape"
          value={siteAppearance.shape}
          options={SITE_SHAPE_OPTIONS}
          onChange={(shape) => set({ shape })}
        />
      </Row>
      <Row title="Motion" hint="Reduced turns transitions and animations off.">
        <Segmented
          label="Motion"
          value={siteAppearance.motion}
          options={[
            { id: "standard", label: "Standard" },
            { id: "reduced", label: "Reduced" },
          ]}
          onChange={(motion) => set({ motion })}
        />
      </Row>
    </div>
  );
}
