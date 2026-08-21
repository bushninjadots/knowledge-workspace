// Card excerpts for library items. HTML items strip tags; Markdown items get
// their syntax markers flattened so cards read like prose either way.

const MAX_LENGTH = 120;

function truncate(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > MAX_LENGTH ? trimmed.slice(0, MAX_LENGTH) + "…" : trimmed;
}

function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function markdownToText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ") // fenced blocks
    .replace(/`([^`]*)`/g, "$1") // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images → alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → text
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^>\s?/gm, "") // blockquotes
    .replace(/^\s*[-*+]\s+/gm, "") // bullets
    .replace(/^\s*\d+\.\s+/gm, "") // ordered lists
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/~~(.*?)~~/g, "$1"); // strikethrough
}

export function getItemExcerpt(content: string, format: "html" | "markdown"): string {
  if (!content) return "";
  return truncate(format === "markdown" ? markdownToText(content) : htmlToText(content));
}
