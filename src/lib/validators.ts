// Shared client-side validators for uploads and URLs.
// These run in the browser and prevent obvious abuse (SVG upload with embedded
// scripts, javascript: URLs) — server-side RLS + storage policies remain the
// final line of defence.

export const ALLOWED_IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif"] as const;
export const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

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

// Skill proof uploads: certificates and portfolio exports are commonly PDFs,
// not just images, so this is a bit more permissive than validateImageFile.
export const ALLOWED_PROOF_EXTS = ["jpg", "jpeg", "png", "webp", "pdf"] as const;
export const ALLOWED_PROOF_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type ProofFileValidation =
  | { ok: true; ext: string; contentType: string }
  | { ok: false; error: string };

export function validateProofFile(file: File): ProofFileValidation {
  const rawExt = (file.name.split(".").pop() ?? "").toLowerCase();
  const ext = rawExt === "jpeg" ? "jpg" : rawExt;
  if (!ALLOWED_PROOF_EXTS.includes(ext as (typeof ALLOWED_PROOF_EXTS)[number])) {
    return { ok: false, error: "Only JPG, PNG, WEBP or PDF files are allowed." };
  }
  const type = (file.type || "").toLowerCase();
  if (type && !ALLOWED_PROOF_MIMES.includes(type as (typeof ALLOWED_PROOF_MIMES)[number])) {
    return { ok: false, error: "Unsupported file type." };
  }
  if (file.size > 15 * 1024 * 1024) {
    return { ok: false, error: "File must be under 15 MB." };
  }
  const contentType =
    type && ALLOWED_PROOF_MIMES.includes(type as (typeof ALLOWED_PROOF_MIMES)[number])
      ? type
      : ext === "pdf"
        ? "application/pdf"
        : ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : "image/jpeg";
  return { ok: true, ext, contentType };
}

// Returns the URL when safe, otherwise "#" — for rendering hrefs from data
// that may have been stored before validation was in place.
export function safeHref(url: string | null | undefined): string {
  return url && isSafeUrl(url) ? url : "#";
}

// Reject filenames that could enable path traversal or other injection.
export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/]/g, "").replace(/\.\./g, "").replace(/^\.+/, "").trim();
}

const LIBRARY_FILE_EXTS = [
  // Images
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  // Documents
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  // Text
  "txt",
  "md",
  "csv",
  "json",
  "rtf",
  // Video (short clips)
  "mp4",
  "webm",
  "mov",
  "avi",
] as const;

const VIDEO_EXTS = ["mp4", "webm", "mov", "avi"] as const;
const MAX_DEFAULT_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB for video

export function validateLibraryFile(
  file: File,
): { ok: true; ext: string } | { ok: false; error: string } {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!LIBRARY_FILE_EXTS.includes(ext as (typeof LIBRARY_FILE_EXTS)[number])) {
    return {
      ok: false,
      error:
        "Allowed: images, PDFs, office docs, text/markdown files, CSV, JSON, and short video clips (MP4, WebM, MOV).",
    };
  }
  const isVideo = (VIDEO_EXTS as readonly string[]).includes(ext);
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_DEFAULT_SIZE;
  if (file.size > maxSize) {
    const limit = isVideo ? "100 MB" : "25 MB";
    return { ok: false, error: `File must be under ${limit}.` };
  }
  return { ok: true, ext };
}
