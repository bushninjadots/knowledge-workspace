// ── Heading Block ─────────────────────────────────────────────────────────────
// A heading block that renders h1–h4 based on config.level.
// In edit mode it becomes an editable input. Registers as "heading".

import { useCallback } from "react";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type HeadingLevel = 1 | 2 | 3 | 4;

const LEVEL_CLASSES: Record<HeadingLevel, string> = {
  1: "text-2xl font-semibold tracking-tight text-foreground",
  2: "text-xl font-semibold tracking-tight text-foreground",
  3: "text-lg font-medium text-foreground",
  4: "text-base font-medium text-foreground",
};

function HeadingBlock({ config, onChange, context }: BlockProps) {
  const content = typeof config.content === "string" ? config.content : "";
  const level: HeadingLevel =
    typeof config.level === "number" && config.level >= 1 && config.level <= 4
      ? (config.level as HeadingLevel)
      : 2;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.({ ...config, content: e.target.value });
    },
    [config, onChange],
  );

  if (!context.isEditing) {
    if (!content) return null;
    if (level === 1) return <h1 className={LEVEL_CLASSES[1]}>{content}</h1>;
    if (level === 3) return <h3 className={LEVEL_CLASSES[3]}>{content}</h3>;
    if (level === 4) return <h4 className={LEVEL_CLASSES[4]}>{content}</h4>;
    return <h2 className={LEVEL_CLASSES[2]}>{content}</h2>;
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={String(level)}
        onValueChange={(value) => onChange?.({ ...config, level: Number(value) as HeadingLevel })}
      >
        <SelectTrigger aria-label="Heading level" className="h-8 w-16 px-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">H1</SelectItem>
          <SelectItem value="2">H2</SelectItem>
          <SelectItem value="3">H3</SelectItem>
          <SelectItem value="4">H4</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="text"
        value={content}
        onChange={handleChange}
        placeholder="Heading text..."
        className="flex-1"
        aria-label="Heading content"
      />
    </div>
  );
}

registerBlock({
  type: "heading",
  category: "content",
  label: "Heading",
  description: "A section heading. Choose from H1–H4 for hierarchy.",
  icon: "Heading",
  defaults: { content: "", level: 2 },
  fields: [
    { key: "content", label: "Heading text", type: "text", placeholder: "Enter heading..." },
    {
      key: "level",
      label: "Size",
      type: "select",
      options: [
        { label: "H1 — Page title", value: "1" },
        { label: "H2 — Section", value: "2" },
        { label: "H3 — Subsection", value: "3" },
        { label: "H4 — Minor", value: "4" },
      ],
    },
  ],
  component: HeadingBlock,
});

export { HeadingBlock };
