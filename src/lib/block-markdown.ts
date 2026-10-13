// ── Block Markdown ───────────────────────────────────────────────────────────
// Minimal markdown-to-HTML renderer used by page blocks (project-about,
// markdown, etc.). Renders straight into `dangerouslySetInnerHTML`, so it must
// be safe against stored XSS:
//
//   1. HTML-escapes `& < > " '` — quotes included, so attribute breakout is
//      impossible (the old renderers only escaped `& < >`).
//   2. Validates URL schemes on links/images — only http:, https:, mailto:,
//      and relative/rooted paths are allowed. `javascript:` and friends are
//      dropped (the surrounding markdown text stays, escaped).
//
// This is pure string processing (no DOM), so it is safe to run during SSR.

const ALLOWED_URL_SCHEMES = new Set(["http", "https", "mailto"]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Allow only safe URL schemes; otherwise return null (drop the link/image). */
function sanitizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed)?.[1]?.toLowerCase();
  if (scheme) {
    return ALLOWED_URL_SCHEMES.has(scheme) ? trimmed : null;
  }

  // Protocol-relative, rooted, relative, or fragment URLs are fine.
  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith(".") ||
    trimmed.startsWith("#")
  ) {
    return trimmed;
  }

  return null;
}

// Placeholder delimiters (Unicode private-use characters). They never survive
// into the output: both are stripped from input, so an author cannot forge a
// stored placeholder.
const SLOT_OPEN = "\uE000";
const SLOT_CLOSE = "\uE001";
const SLOT_PATTERN = /\uE000(\d+)\uE001/g;

/**
 * Render block markdown to safe HTML. Supports headings, bold, italic, inline
 * code, fenced code blocks, links, images, lists, horizontal rules, and
 * paragraphs.
 *
 * Code spans and every link/image URL are swapped for opaque placeholders
 * before inline formatting runs, then restored at the end. Formatting rules
 * therefore never see — or inject markup into — a code body or an attribute
 * value (a URL containing `*x*` keeps its literal `href`).
 */
export function blockMarkdownToHtml(md: string): string {
  const slots: string[] = [];
  // The (escaped) markdown each slot replaced, so a code span that sits inside
  // a URL or alt text can be put back literally instead of as markup.
  const sources: string[] = [];
  const stash = (fragment: string, source = "") => {
    sources.push(source);
    return `${SLOT_OPEN}${slots.push(fragment) - 1}${SLOT_CLOSE}`;
  };
  const literal = (value: string) =>
    value.replace(SLOT_PATTERN, (_match, index: string) => sources[Number(index)] ?? "");

  let html = escapeHtml(md.replace(/[\uE000\uE001]/g, ""));

  // Code blocks (triple backtick) — the escaped body is safe inside <pre>.
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang: string, body: string) =>
    stash(
      `<pre class="rounded-lg bg-surface-sunken p-3 text-xs font-mono overflow-x-auto"><code>${body}</code></pre>`,
    ),
  );
  // Inline code
  html = html.replace(/`([^`]+)`/g, (match: string, body: string) =>
    stash(
      `<code class="rounded bg-surface-sunken px-1 py-0.5 text-xs font-mono">${body}</code>`,
      match,
    ),
  );

  // Images (before links so `![alt](url)` is not captured by the link rule).
  // A blocked image is dropped entirely (renders nothing, not the raw markdown).
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, src: string) => {
    const url = sanitizeUrl(literal(src));
    if (!url) return "";
    // `alt` is already escaped; stash the whole tag so formatting skips it.
    return stash(`<img src="${url}" alt="${literal(alt)}" class="rounded-lg max-w-full" />`);
  });

  // Links — text and URL are already escaped; the URL additionally passed the
  // scheme allowlist, so `href` cannot break out or run script. Only the opening
  // tag is stashed, so the link text still gets bold/italic. A blocked URL
  // degrades to plain escaped text (the raw `javascript:` payload never reaches
  // the DOM).
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text: string, url: string) => {
    const safeUrl = sanitizeUrl(literal(url));
    if (!safeUrl) return text;
    return `${stash(
      `<a href="${safeUrl}" class="text-primary underline" target="_blank" rel="noopener noreferrer">`,
    )}${text}${stash("</a>")}`;
  });

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Headings
  html = html
    .replace(/^#### (.+)$/gm, "<h4 class='text-base font-medium text-foreground mt-4 mb-2'>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3 class='text-lg font-medium text-foreground mt-5 mb-2'>$1</h3>")
    .replace(
      /^## (.+)$/gm,
      "<h2 class='text-xl font-semibold tracking-tight text-foreground mt-6 mb-3'>$1</h2>",
    )
    .replace(
      /^# (.+)$/gm,
      "<h1 class='text-2xl font-semibold tracking-tight text-foreground mt-6 mb-3'>$1</h1>",
    )
    // Horizontal rule
    .replace(/^---$/gm, "<hr class='my-4 border-border' />")
    // Unordered lists
    .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc text-sm text-foreground'>$1</li>")
    // Paragraphs (double newline)
    .replace(/\n\n/g, "</p><p class='text-sm leading-relaxed text-foreground mb-3'>")
    // Single newlines → <br> within paragraphs
    .replace(/\n/g, "<br />");

  html = html.replace(SLOT_PATTERN, (_match, index: string) => slots[Number(index)] ?? "");

  // Wrap in paragraph if not already
  if (!html.startsWith("<")) {
    html = `<p class='text-sm leading-relaxed text-foreground mb-3'>${html}</p>`;
  }

  return html;
}
