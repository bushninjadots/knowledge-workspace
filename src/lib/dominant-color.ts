import { useEffect, useState } from "react";

export type ExtractedPalette = {
  /** The dominant colour as `rgb(r, g, b)`. */
  dominant: string;
  /** Same colour at ~10% opacity — card/hover backgrounds. */
  subtle: string;
  /** Same colour at ~30% opacity — borders. */
  border: string;
  /** Same colour at ~5% opacity — glows, shadows. */
  glow: string;
};

// Samples an image region and returns the average colour.
function sampleRegion(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): { r: number; g: number; b: number; count: number } | null {
  const regionCanvas = document.createElement("canvas");
  regionCanvas.width = sw;
  regionCanvas.height = sh;
  const rCtx = regionCanvas.getContext("2d");
  if (!rCtx) return null;

  rCtx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  const { data } = rCtx.getImageData(0, 0, sw, sh);

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 180) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count++;
  }

  if (count === 0) return null;
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count), count };
}

/** Pick the most saturated colour from a set of samples. */
function mostSaturated(samples: { r: number; g: number; b: number }[]): {
  r: number;
  g: number;
  b: number;
} {
  return samples.reduce((best, curr) => {
    const maxCurr = Math.max(curr.r, curr.g, curr.b);
    const minCurr = Math.min(curr.r, curr.g, curr.b);
    const satCurr = maxCurr === 0 ? 0 : (maxCurr - minCurr) / maxCurr;

    const maxBest = Math.max(best.r, best.g, best.b);
    const minBest = Math.min(best.r, best.g, best.b);
    const satBest = maxBest === 0 ? 0 : (maxBest - minBest) / maxBest;

    return satCurr > satBest ? curr : best;
  });
}

/**
 * Boosts luminance to ensure the colour is visible against dark backgrounds.
 * Uses relative luminance (perceived brightness): 0.2126*R + 0.7152*G + 0.0722*B.
 * If the colour is too dark, it's lightened toward a minimum threshold while
 * preserving the hue and saturation as much as possible.
 */
function ensureVisible(r: number, g: number, b: number): { r: number; g: number; b: number } {
  // Relative luminance (0-255 scale)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Higher threshold for dark-mode visibility: accent must pop against ~39-lum bg
  const isDarkMode =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const MIN_LUM = isDarkMode ? 155 : 100;

  if (lum >= MIN_LUM) return { r, g, b };

  // Scale up linearly while preserving hue ratios
  const scale = MIN_LUM / Math.max(lum, 1);
  return {
    r: Math.min(255, Math.round(r * scale)),
    g: Math.min(255, Math.round(g * scale)),
    b: Math.min(255, Math.round(b * scale)),
  };
}

// Samples an image across five regions (4 corners + centre) and extracts the
// most visually interesting dominant colour. Falls back to global averaging
// when per-region sampling fails.
//
// Note: this relies on the image being served with permissive CORS headers
// (Supabase Storage signed URLs are). If the canvas gets tainted for any
// reason, we fail silently and return null — callers should treat that as
//"no accent colour"rather than throw.
export async function getDominantColor(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const size = 48; // up from 24 for better region sampling
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);

        ctx.drawImage(img, 0, 0, size, size);

        // Sample 5 regions: 4 corners + centre
        const regionSize = 12;
        const regions: { r: number; g: number; b: number; count: number }[] = [];

        const corners = [
          [0, 0],
          [size - regionSize, 0],
          [0, size - regionSize],
          [size - regionSize, size - regionSize],
        ];
        const centre = [Math.floor((size - regionSize) / 2), Math.floor((size - regionSize) / 2)];

        for (const [sx, sy] of [...corners, centre]) {
          const sample = sampleRegion(ctx, sx, sy, regionSize, regionSize);
          if (sample && sample.count > 3) regions.push(sample);
        }

        if (regions.length === 0) {
          // Fallback: full-image average
          const { data } = ctx.getImageData(0, 0, size, size);
          let r = 0;
          let g = 0;
          let b = 0;
          let count = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 180) continue;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
          if (count === 0) return resolve(null);
          const fallback = ensureVisible(
            Math.round(r / count),
            Math.round(g / count),
            Math.round(b / count),
          );
          resolve(`rgb(${fallback.r}, ${fallback.g}, ${fallback.b})`);
          return;
        }

        // Pick the most saturated sample for the accent
        const accent = mostSaturated(regions);
        const visible = ensureVisible(accent.r, accent.g, accent.b);
        resolve(`rgb(${visible.r}, ${visible.g}, ${visible.b})`);
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Extracts a full palette from an image URL. */
export async function extractPalette(url: string): Promise<ExtractedPalette | null> {
  const dominant = await getDominantColor(url);
  if (!dominant) return null;
  return {
    dominant,
    subtle: withAlpha(dominant, 0.1) ?? "transparent",
    border: withAlpha(dominant, 0.3) ?? "transparent",
    glow: withAlpha(dominant, 0.06) ?? "transparent",
  };
}

// React hook wrapper — re-samples whenever the image URL changes, and
// resets to null (no accent) when there's no image.
export function useDominantColor(url: string | null): string | null {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setColor(null);
      return;
    }
    getDominantColor(url).then((c) => {
      if (!cancelled) setColor(c);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return color;
}

/** React hook that returns a full ExtractedPalette from a banner URL. */
export function useUserPalette(url: string | null): ExtractedPalette | null {
  const [palette, setPalette] = useState<ExtractedPalette | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setPalette(null);
      return;
    }
    extractPalette(url).then((p) => {
      if (!cancelled) setPalette(p);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return palette;
}

// Turns an`rgb(r, g, b)`string into`rgba(r, g, b, alpha)`— used to get a
// softer tint of the sampled banner color for card borders, distinct from
// the fully-opaque color used on the banner's own border.
export function withAlpha(rgb: string | null, alpha: number): string | null {
  if (!rgb) return null;
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return rgb;
  const [, r, g, b] = match;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Converts an ExtractedPalette into CSS custom property assignments.
 * Returns a style object and a separate CSS string for use in JS or inline.
 */
export function paletteToStyle(palette: ExtractedPalette | null): React.CSSProperties {
  if (!palette) return {};
  return {
    "--user-accent": palette.dominant,
    "--user-accent-subtle": palette.subtle,
    "--user-accent-border": palette.border,
    "--user-accent-glow": palette.glow,
  } as React.CSSProperties;
}
