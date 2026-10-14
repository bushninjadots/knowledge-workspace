// Pure helpers for the Notes dock: turning a quick jot into a library note,
// and naming what kind of thing a library item is.

const TITLE_MAX = 80;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A quick jot → a library note. The first line becomes the title; the rest
 * becomes the body as simple HTML paragraphs (the Library's rich editor
 * format), so the note opens cleanly in the full editor too.
 */
export function quickNoteFromText(text: string): { title: string; content: string } {
  const lines = text.replace(/\r\n?/g, "\n").trim().split("\n");
  const first = (lines.shift() ?? "").trim();
  const title =
    first.length > TITLE_MAX
      ? `${first.slice(0, TITLE_MAX - 1).trimEnd()}…`
      : first || "Quick note";
  // A long first line keeps its full text in the body.
  const bodyLines = first.length > TITLE_MAX ? [first, ...lines] : lines;
  const content = bodyLines
    .join("\n")
    .trim()
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p>${p.split("\n").map(escapeHtml).join("<br>")}</p>`)
    .join("");
  return { title, content };
}

export type ItemKind = "note" | "image" | "video" | "audio" | "link" | "file";

export function itemKind(item: {
  type: string;
  file_type: string | null;
  url?: string | null;
}): ItemKind {
  if (item.type === "link") return "link";
  if (item.type === "note") return "note";
  const mime = item.file_type ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A jot whose first line is a single http(s) link is a saved link; anything
 * after it is the member's note about it. Null for anything else.
 */
export function parseQuickLink(text: string): { url: string; note: string } | null {
  const lines = text.replace(/\r\n?/g, "\n").trim().split("\n");
  const first = (lines.shift() ?? "").trim();
  if (!/^https?:\/\/\S+$/i.test(first)) return null;
  try {
    const url = new URL(first);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return { url: url.toString(), note: lines.join("\n").trim() };
  } catch {
    return null;
  }
}

/** A readable fallback title for a link ("github.com/acme/repo"). */
export function linkFallbackTitle(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    const label = `${u.hostname.replace(/^www\./, "")}${path}`;
    return label.length > 80 ? `${label.slice(0, 79)}…` : label;
  } catch {
    return url.slice(0, 80);
  }
}

/** The note under a saved link, as the Library's HTML paragraphs. */
export function noteToHtml(note: string): string {
  return quickNoteFromText(`x\n${note}`).content;
}
