import { describe, expect, it } from "vitest";
import { paletteFromPixels } from "./image-palette";

/** RGBA pixel data: `n` pixels of each colour. */
function pixels(...runs: [number, [number, number, number, number?]][]) {
  const out: number[] = [];
  for (const [n, [r, g, b, a = 255]] of runs) {
    for (let i = 0; i < n; i++) out.push(r, g, b, a);
  }
  return out;
}

describe("paletteFromPixels", () => {
  it("returns the image's colours as hex, most covered first", () => {
    const palette = paletteFromPixels(pixels([300, [37, 99, 235]], [100, [234, 88, 12]]));
    expect(palette).toEqual(["#2563eb", "#ea580c"]);
  });

  it("prefers a colourful area over a slightly larger grey one", () => {
    const palette = paletteFromPixels(pixels([200, [128, 128, 128]], [150, [220, 40, 80]]));
    expect(palette[0]).toBe("#dc2850");
  });

  it("skips near-black, near-white and transparent pixels", () => {
    const palette = paletteFromPixels(
      pixels(
        [500, [5, 5, 5]],
        [500, [250, 250, 250]],
        [500, [200, 30, 30, 0]],
        [10, [22, 163, 74]],
      ),
    );
    expect(palette).toEqual(["#16a34a"]);
  });

  it("does not return near-duplicate colours", () => {
    const palette = paletteFromPixels(pixels([100, [124, 58, 237]], [100, [118, 52, 230]]));
    expect(palette).toHaveLength(1);
  });

  it("caps the count and handles an empty image", () => {
    const many = pixels(
      [10, [255, 0, 0]],
      [10, [0, 160, 0]],
      [10, [0, 0, 255]],
      [10, [200, 200, 0]],
      [10, [0, 200, 200]],
    );
    expect(paletteFromPixels(many, 3)).toHaveLength(3);
    expect(paletteFromPixels([])).toEqual([]);
  });
});
