// Shared client-side validators for uploads and URLs.
// These run in the browser and prevent obvious abuse (SVG upload with embedded
// scripts, javascript: URLs) — server-side RLS + storage policies remain the
// final line of defence.

export const ALLOWED_IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif"] as const;
export const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type ImageValidation =
  | { ok: true; ext: string; contentType: string }
  | { ok: false; error: string };

export function validateImageFile(file: File): ImageValidation {
  const rawExt = (file.name.split(".").pop() ?? "").toLowerCase();
  const ext = rawExt === "jpeg" ? "jpg" : rawExt;
  if (!ALLOWED_IMAGE_EXTS.includes(ext as (typeof ALLOWED_IMAGE_EXTS)[number])) {
    return { ok: false, error: "Only JPG, PNG, WEBP or GIF images are allowed." };
  }
  const type = (file.type || "").toLowerCase();
  if (type && !ALLOWED_IMAGE_MIMES.includes(type as (typeof ALLOWED_IMAGE_MIMES)[number])) {
    return { ok: false, error: "Unsupported image type." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "Image must be under 8 MB." };
  }
  // Normalize content-type — never trust the browser blindly.
  const contentType =
    type && ALLOWED_IMAGE_MIMES.includes(type as (typeof ALLOWED_IMAGE_MIMES)[number])
      ? type
      : ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/jpeg";
  return { ok: true, ext: ext === "jpeg" ? "jpg" : ext, contentType };
}

// Only http(s) URLs are allowed for stored links.
export function isSafeUrl(url: string): boolean {
  if (!url) return false;
  try {
    const { protocol } = new URL(url.trim());
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

// Returns the URL when safe, otherwise "#" — for rendering hrefs from data
// that may have been stored before validation was in place.
export function safeHref(url: string | null | undefined): string {
  return url && isSafeUrl(url) ? url : "#";
}
