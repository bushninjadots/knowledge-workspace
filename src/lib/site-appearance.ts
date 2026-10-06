// ── Site appearance ───────────────────────────────────────────────────────────
// How Tethyr itself looks for this person, on this device: its density,
// shape, accent and motion. It sits on top of the site theme (a preset from
// the shared `themes` catalogue, chosen in the same place) and is applied as
// CSS custom properties on <html>, so every component that uses the shared
// tokens follows it: spacing utilities read --spacing, `rounded-*` reads
// --radius-*, buttons and focus rings read --primary/--ring.
//
// It never reaches a profile: Studio canvases re-establish Tethyr's own
// palette, faces, radius and spacing beneath their own theme
// ([data-base-palette] in styles.css, --spacing in studioSurfaceStyle).

export type SiteDensity = "compact" | "comfortable" | "spacious";
export type SiteShape = "theme" | "sharp" | "soft" | "rounded";
export type SiteMotion = "standard" | "reduced";

export interface SiteAppearance {
  density: SiteDensity;
  shape: SiteShape;
  /** "" follows the theme; otherwise a #rrggbb accent. */
  accent: string;
  motion: SiteMotion;
}

export const DEFAULT_SITE_APPEARANCE: Readonly<SiteAppearance> = {
  density: "comfortable",
  shape: "theme",
  accent: "",
  motion: "standard",
};

export const SITE_APPEARANCE_STORAGE_KEY = "tethyr-site-appearance";

export const SITE_DENSITY_OPTIONS: ReadonlyArray<{ id: SiteDensity; label: string; hint: string }> =
  [
    { id: "compact", label: "Compact", hint: "More on screen, tighter controls." },
    { id: "comfortable", label: "Comfortable", hint: "The balanced default." },
    { id: "spacious", label: "Spacious", hint: "More room around everything." },
  ];

export const SITE_SHAPE_OPTIONS: ReadonlyArray<{ id: SiteShape; label: string }> = [
  { id: "theme", label: "Theme" },
  { id: "sharp", label: "Sharp" },
  { id: "soft", label: "Soft" },
  { id: "rounded", label: "Rounded" },
];

export const SITE_ACCENTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "Theme" },
  { value: "#3f8f8a", label: "Teal" },
  { value: "#2f6fd0", label: "Blue" },
  { value: "#7a4ecf", label: "Violet" },
  { value: "#c2410c", label: "Ember" },
  { value: "#2f7d4a", label: "Green" },
  { value: "#1f2328", label: "Ink" },
];

/** One spacing step of Tailwind's scale (`p-1`, `gap-1`, `h-1`…). */
const SPACING: Record<SiteDensity, string | null> = {
  compact: "0.225rem",
  comfortable: null,
  spacious: "0.275rem",
};

/** The radius scale per shape, in px: sm, md, lg, xl, 2xl, 3xl, 4xl. */
const RADII: Record<Exclude<SiteShape, "theme">, number[]> = {
  sharp: [0, 0, 1, 1, 1, 2, 2],
  soft: [3, 4, 6, 8, 8, 10, 12],
  rounded: [4, 6, 10, 12, 14, 16, 20],
};
const RADIUS_KEYS = ["sm", "md", "lg", "xl", "2xl", "3xl", "4xl"];

const HEX = /^#[0-9a-f]{6}$/i;

export function normalizeSiteAppearance(raw: unknown): SiteAppearance {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = <T extends string>(allowed: readonly T[], v: unknown, fallback: T): T =>
    typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  return {
    density: pick(["compact", "comfortable", "spacious"], value.density, "comfortable"),
    shape: pick(["theme", "sharp", "soft", "rounded"], value.shape, "theme"),
    accent: typeof value.accent === "string" && HEX.test(value.accent) ? value.accent : "",
    motion: pick(["standard", "reduced"], value.motion, "standard"),
  };
}

/** A readable label colour on `hex`. */
function onColour(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  return luminance > 0.4 ? "#111827" : "#ffffff";
}

/**
 * The CSS custom properties Site appearance sets on <html>. Only what differs
 * from the theme is emitted, so the defaults change nothing. An accent brings
 * its whole family (label colour, focus ring, tints) so no control is left
 * with an unreadable pairing.
 */
export function siteAppearanceVars(appearance: SiteAppearance): Record<string, string> {
  const vars: Record<string, string> = {};
  const spacing = SPACING[appearance.density];
  if (spacing) vars["--spacing"] = spacing;
  if (appearance.shape !== "theme") {
    RADII[appearance.shape].forEach((px, index) => {
      vars[`--radius-${RADIUS_KEYS[index]}`] = `${px}px`;
    });
    vars["--radius"] = `${RADII[appearance.shape][2]}px`;
  }
  if (HEX.test(appearance.accent)) {
    const accent = appearance.accent;
    vars["--primary"] = accent;
    vars["--primary-foreground"] = onColour(accent);
    vars["--ring"] = accent;
    vars["--accent-border"] = `color-mix(in oklab, ${accent} 40%, transparent)`;
    vars["--user-accent"] = accent;
    vars["--user-accent-text"] = `color-mix(in oklab, ${accent} 60%, var(--foreground))`;
    vars["--user-accent-foreground"] = onColour(accent);
    vars["--user-accent-subtle"] = `color-mix(in oklab, ${accent} 10%, transparent)`;
    vars["--user-accent-border"] = `color-mix(in oklab, ${accent} 30%, transparent)`;
  }
  return vars;
}
