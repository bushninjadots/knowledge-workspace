// ── Text Block ────────────────────────────────────────────────────────────────
// A plain text block that renders prose content. In edit mode, it becomes an
// editable textarea. Registers itself as "text" in the block registry.

import { useCallback } from "react";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

function TextBlock({ config, onChange, context }: BlockProps) {
  const content = typeof config.content === "string" ? config.content : "";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.({ ...config, content: e.target.value });
    },
    [config, onChange],
  );

  if (!context.isEditing) {
    if (!content) return null;
    return <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{content}</p>;
  }

  return (
    <textarea
      value={content}
      onChange={handleChange}
      placeholder="Write something..."
      rows={3}
      className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      aria-label="Text block content"
    />
  );
}

registerBlock({
  type: "text",
  category: "content",
  label: "Text",
  description: "A paragraph of plain text. Great for descriptions and bios.",
  icon: "Type",
  defaults: { content: "" },
  fields: [{ key: "content", label: "Text", type: "textarea", placeholder: "Write something..." }],
  containerless: false,
  component: TextBlock,
});

export { TextBlock };
