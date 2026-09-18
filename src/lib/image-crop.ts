/**
 * Client-side center-cropping for identity media.
 *
 * Avatars are displayed in circles and banners in fixed-ratio bands; uploads
 * of any aspect ratio previously leaned on CSS `object-cover` guesswork, so
 * heads got cut off and banners framed unpredictably. Cropping at upload time
 * stores exactly what will be shown.
 *
 * The math is a pure function so it is unit-testable without a canvas; the
 * canvas step is a thin browser-only wrapper. Everything degrades gracefully:
 * if `createImageBitmap` or the canvas is unavailable, callers keep the
 * original file and display-side `object-cover` still applies.
 */

/** Avatars render as circles — store squares. */
export const AVATAR_CROP_ASPECT = 1;
/** Banner bands render at 1200×400 (3:1) — store the same shape. */
export const BANNER_CROP_ASPECT = 3;

export type CenterCropRect = { sx: number; sy: number; sw: number; sh: number };

/** Relative aspect difference below which no crop is worth a re-encode. */
const ASPECT_EPSILON = 0.01;

/**
 * Largest centred rectangle of `aspect` inside a `w × h` image.
 * Returns null when the image already matches the target aspect.
 */
export function centerCropRect(w: number, h: number, aspect: number): CenterCropRect | null {
  if (w <= 0 || h <= 0 || aspect <= 0) return null;
  if (Math.abs(w / h - aspect) < ASPECT_EPSILON) return null;
  if (w / h > aspect) {
    // Too wide: crop the sides.
    const sw = Math.round(h * aspect);
    return { sx: Math.round((w - sw) / 2), sy: 0, sw, sh: h };
  }
  // Too tall: crop top and bottom equally, biased slightly upward so faces
  // (which sit above centre in most portraits) stay in frame.
  const sh = Math.round(w / aspect);
  const sy = Math.round((h - sh) * 0.4);
  return { sx: 0, sy, sw: w, sh };
}

export type CropResult = { blob: Blob; width: number; height: number };

/**
 * Centre-crop `file` to `aspect` and re-encode it. PNG keeps its format (and
 * transparency); everything else becomes JPEG at 0.92 quality. Returns null
 * when no crop is needed or the browser APIs are unavailable — callers should
 * upload the original file in that case.
 */
export async function cropImageToAspect(file: File, aspect: number): Promise<CropResult | null> {
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    const rect = centerCropRect(bitmap.width, bitmap.height, aspect);
    if (!rect) return null;
    const canvas = document.createElement("canvas");
    canvas.width = rect.sw;
    canvas.height = rect.sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, rect.sw, rect.sh);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, type === "image/jpeg" ? 0.92 : undefined),
    );
    if (!blob) return null;
    return { blob, width: rect.sw, height: rect.sh };
  } finally {
    bitmap.close();
  }
}

/** Extension/content-type pair for an upload payload after optional cropping. */
export function cropUploadMeta(
  file: File,
  result: CropResult | null,
): {
  ext: string;
  contentType: string;
} {
  if (!result) return { ext: file.name.split(".").pop() ?? "jpg", contentType: file.type };
  return file.type === "image/png"
    ? { ext: "png", contentType: "image/png" }
    : { ext: "jpg", contentType: "image/jpeg" };
}
