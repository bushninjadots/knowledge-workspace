// ── Font Catalog ──────────────────────────────────────────────────────────────
// The typefaces a Studio can adopt. `id` is what a config stores, `stack` is the
// CSS font-family that id resolves to, and `google` is the family spec the
// stylesheet link in __root.tsx is built from (googleFontsHref) — so a stored
// choice can never render a face that was never loaded.

export type FontId =
  | "inter"
  | "space-grotesk"
  | "manrope"
  | "dm-sans"
  | "sora"
  | "jetbrains-mono"
  | "fraunces"
  | "playfair-display";

interface FontOption {
  id: FontId;
  label: string;
  /** CSS font-family stack. */
  stack: string;
  /** Family + weights, as the Google Fonts css2 API expects them. */
  google: string;
}

export const FONT_OPTIONS: readonly FontOption[] = [
  {
    id: "inter",
    label: "Inter",
    stack: '"Inter", ui-sans-serif, system-ui, sans-serif',
    google: "Inter:wght@400;450;500;600;700",
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    stack: '"Space Grotesk", "Inter", ui-sans-serif, system-ui, sans-serif',
    google: "Space+Grotesk:wght@400;500;600;700",
  },
  {
    id: "manrope",
    label: "Manrope",
    stack: '"Manrope", "Inter", ui-sans-serif, system-ui, sans-serif',
    google: "Manrope:wght@400;500;600;700",
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    stack: '"DM Sans", "Inter", ui-sans-serif, system-ui, sans-serif',
    google: "DM+Sans:wght@400;500;600;700",
  },
  {
    id: "sora",
    label: "Sora",
    stack: '"Sora", "Inter", ui-sans-serif, system-ui, sans-serif',
    google: "Sora:wght@400;500;600;700",
  },
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono",
    stack: '"JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace',
    google: "JetBrains+Mono:wght@400;500;600",
  },
  {
    id: "fraunces",
    label: "Fraunces",
    stack: '"Fraunces", Georgia, "Times New Roman", serif',
    google: "Fraunces:wght@400;500;600",
  },
  {
    id: "playfair-display",
    label: "Playfair Display",
    stack: '"Playfair Display", Georgia, "Times New Roman", serif',
    google: "Playfair+Display:wght@400;500;600;700",
  },
];

const FONT_BY_ID = new Map(FONT_OPTIONS.map((option) => [option.id, option]));

/** Whether a stored value is one of the catalog's ids. */
export function isFontId(value: unknown): value is FontId {
  return typeof value === "string" && FONT_BY_ID.has(value as FontId);
}

/** The CSS font-family for a stored font id, or null when unset/unknown — the
 *  surface then keeps the theme's own face. */
export function fontStack(id: string | null | undefined): string | null {
  if (!id) return null;
  return FONT_BY_ID.get(id as FontId)?.stack ?? null;
}

/** The Google Fonts stylesheet every catalog face is served from. Built from
 *  the catalog so the link and the ids can't drift apart. */
export function googleFontsHref(): string {
  const families = FONT_OPTIONS.map((option) => `family=${option.google}`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
