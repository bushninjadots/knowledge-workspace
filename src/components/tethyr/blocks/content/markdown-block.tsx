// ── Markdown Block ────────────────────────────────────────────────────────────
// Renders markdown content as formatted HTML. In edit mode, shows a textarea
// for raw markdown editing. Registers as "markdown".
//
// Uses the shared sanitized block renderer (escapes quotes, rejects
// javascript: URLs). For the project README, the existing TipTap editor
// (ReadmeEditor) provides rich editing — this block is for simple markdown
// sections within a page.

import { useCallback, useMemo } from "react";
import { blockMarkdownToHtml } from "@/lib/block-markdown";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

function MarkdownBlock({ config, onChange, context }: BlockProps) {
  const content = typeof config.content === "string" ? config.content : "";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.({ ...config, content: e.target.value });
    },
    [config, onChange],
  );

  const html = useMemo(() => blockMarkdownToHtml(content), [content]);

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
  description:
    "Rich text with markdown formatting. Supports headings, bold, italic, code, links, and lists.",
  icon: "FileText",
  defaults: { content: "" },
  fields: [
    { key: "content", label: "Markdown content", type: "textarea", placeholder: "Write markdown..." },
  ],
  component: MarkdownBlock,
});

export { MarkdownBlock };
