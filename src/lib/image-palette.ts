// Pull a few colours out of an image, so a space's colour can come from its
// banner. Pure pixel maths (`paletteFromPixels`) plus a browser loader
// (`imagePalette`) that draws the image small on a canvas first.

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** Chroma-ish spread (0–255) and lightness (0–1) of an RGB colour. */
function describe(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return { spread: max - min, light: (max + min) / 510 };
}

/**
 * Up to `count` distinct colours from RGBA pixel data, most useful first.
 * Pixels are bucketed (4 bits per channel); each bucket's average colour is
 * scored by how much of the image it covers and how colourful it is, so a big
 * grey sky doesn't beat the orange that makes the picture. Near-black,
 * near-white and see-through pixels are skipped — they make poor accents.
 */
export function paletteFromPixels(data: ArrayLike<number>, count = 4): string[] {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (data[i + 3] < 128) continue;
    const { light } = describe(r, g, b);
    if (light < 0.12 || light > 0.92) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n += 1;
    } else buckets.set(key, { r, g, b, n: 1 });
  }

  const scored = [...buckets.values()]
    .map(({ r, g, b, n }) => {
      const colour = [r / n, g / n, b / n] as const;
      const { spread } = describe(...colour);
      return { colour, score: n * (0.25 + spread / 255) };
    })
    .sort((a, b) => b.score - a.score);

  const picked: (readonly [number, number, number])[] = [];
  for (const { colour } of scored) {
    // Keep picks visibly different from each other.
    const distinct = picked.every(
      (p) => Math.hypot(p[0] - colour[0], p[1] - colour[1], p[2] - colour[2]) > 60,
    );
    if (distinct) picked.push(colour);
    if (picked.length === count) break;
  }
  return picked.map((c) => toHex(...c));
}

/**
 * Load an image URL and return its palette. Resolves to [] when the image
 * can't be read (network error, or a cross-origin image without CORS).
 */
export function imagePalette(src: string, count = 4): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onerror = () => resolve([]);
    img.onload = () => {
      try {
        const size = 48;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve([]);
        ctx.drawImage(img, 0, 0, size, size);
        resolve(paletteFromPixels(ctx.getImageData(0, 0, size, size).data, count));
      } catch {
        resolve([]); // tainted canvas
      }
    };
    img.src = src;
  });
}
