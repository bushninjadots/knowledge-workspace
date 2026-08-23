// ── Markdown Block ────────────────────────────────────────────────────────────
// Renders markdown content as formatted HTML. In edit mode, shows a textarea
// for raw markdown editing. Registers as "markdown".
//
// Uses a lightweight markdown-to-HTML approach. For the project README, the
// existing TipTap editor (ReadmeEditor) provides rich editing — this block is
// for simple markdown sections within a page.

import { useCallback, useMemo } from "react";
import { FileText } from "lucide-react";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

/**
 * Minimal markdown-to-HTML renderer. Handles the most common formatting:
 * headings, bold, italic, code, links, lists, and paragraphs.
 * For production use, this can be swapped for a library like marked or
 * the existing lowlight-based renderer.
 */
function markdownToHtml(md: string): string {
  let html = md
    // Escape HTML entities first
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Code blocks (triple backtick)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="rounded-lg bg-surface-sunken p-3 text-xs font-mono overflow-x-auto"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="rounded bg-surface-sunken px-1 py-0.5 text-xs font-mono">$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline" target="_blank" rel="noopener noreferrer">$1</a>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-lg max-w-full" />')
    // Headings
    .replace(/^#### (.+)$/gm, "<h4 class='text-base font-medium text-foreground mt-4 mb-2'>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3 class='text-lg font-medium text-foreground mt-5 mb-2'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='text-xl font-semibold tracking-tight text-foreground mt-6 mb-3'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class='text-2xl font-semibold tracking-tight text-foreground mt-6 mb-3'>$1</h1>")
    // Horizontal rule
    .replace(/^---$/gm, "<hr class='my-4 border-border' />")
    // Unordered lists
    .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc text-sm text-foreground'>$1</li>")
    // Paragraphs (double newline)
    .replace(/\n\n/g, "</p><p class='text-sm leading-relaxed text-foreground mb-3'>")
    // Single newlines → <br> within paragraphs
    .replace(/\n/g, "<br />");

  // Wrap in paragraph if not already
  if (!html.startsWith("<")) {
    html = `<p class='text-sm leading-relaxed text-foreground mb-3'>${html}</p>`;
  }

  return html;
}

function MarkdownBlock({ config, onChange, context }: BlockProps) {
  const content = typeof config.content === "string" ? config.content : "";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.({ ...config, content: e.target.value });
    },
    [config, onChange],
  );

  const html = useMemo(() => markdownToHtml(content), [content]);

  if (!context.isEditing) {
    if (!content) return null;
    return (
      <div
        className="prose-custom text-sm leading-relaxed text-foreground"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={content}
        onChange={handleChange}
        placeholder={"# Markdown content\n\nWrite **bold**, *italic*, `code`, and more."}
        rows={6}
        className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Markdown content"
      />
      {content && (
        <div className="rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium">Preview:</span>
          <div
            className="mt-1 text-sm text-foreground"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </div>
  );
}

registerBlock({
  type: "markdown",
  category: "content",
  label: "Markdown",
  description: "Rich text with markdown formatting. Supports headings, bold, italic, code, links, and lists.",
  icon: "FileText",
  defaults: { content: "" },
  component: MarkdownBlock,
});

export { MarkdownBlock };