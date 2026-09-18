import { describe, expect, it } from "vitest";
import { centerCropRect, AVATAR_CROP_ASPECT, BANNER_CROP_ASPECT } from "./image-crop";

describe("centerCropRect", () => {
  it("returns null for already-square images (avatar)", () => {
    expect(centerCropRect(512, 512, AVATAR_CROP_ASPECT)).toBeNull();
  });

  it("crops wide images on the sides (landscape portrait photo)", () => {
    // 1000×800 → target square: sw=800, sx=(1000−800)/2=100
    expect(centerCropRect(1000, 800, AVATAR_CROP_ASPECT)).toEqual({
      sx: 100,
      sy: 0,
      sw: 800,
      sh: 800,
    });
  });

  it("crops tall images with the 40% upward bias (face framing)", () => {
    // 600×1000 → square: sh=600, excess=400, sy=0.4·400=160
    expect(centerCropRect(600, 1000, AVATAR_CROP_ASPECT)).toEqual({
      sx: 0,
      sy: 160,
      sw: 600,
      sh: 600,
    });
  });

  it("crops 3:2 banners to 3:1 from the vertical centre", () => {
    // 1200×800 → 3:1: sh=400, excess=400, sy=0.4·400=160
    expect(centerCropRect(1200, 800, BANNER_CROP_ASPECT)).toEqual({
      sx: 0,
      sy: 160,
      sw: 1200,
      sh: 400,
    });
  });

  it("returns null for near-target aspects within epsilon", () => {
    expect(centerCropRect(3000, 1000, BANNER_CROP_ASPECT)).toBeNull();
    expect(centerCropRect(1001, 1000, AVATAR_CROP_ASPECT)).toBeNull();
  });

  it("returns null for degenerate inputs", () => {
    expect(centerCropRect(0, 100, AVATAR_CROP_ASPECT)).toBeNull();
    expect(centerCropRect(100, -5, AVATAR_CROP_ASPECT)).toBeNull();
    expect(centerCropRect(100, 100, 0)).toBeNull();
  });
});
