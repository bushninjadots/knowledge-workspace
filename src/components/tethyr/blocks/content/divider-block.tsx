// ── Divider Block ─────────────────────────────────────────────────────────────
// A horizontal divider / separator. Registers as "divider".

import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

function DividerBlock({ config, context }: BlockProps) {
  const label = typeof config.label === "string" && config.label.length > 0 ? config.label : null;
  const weight = typeof config.weight === "number" ? config.weight : 1;
  const labelColor =
    typeof config.labelColor === "string" && config.labelColor.length > 0
      ? config.labelColor
      : null;

  if (label && !context.isEditing) {
    return (
      <div className="flex items-center gap-3 py-2">
        <hr className="flex-1 border-border" style={{ borderTopWidth: weight }} />
        <span
          className="text-xs font-medium text-muted-foreground"
          style={labelColor ? { color: labelColor } : undefined}
        >
          {label}
        </span>
        <hr className="flex-1 border-border" style={{ borderTopWidth: weight }} />
      </div>
    );
  }

  return <hr className="my-2 border-border" style={{ borderTopWidth: weight }} />;
}

registerBlock({
  type: "divider",
  category: "content",
  label: "Divider",
  description: "A horizontal rule to separate sections. Optionally add a label.",
  icon: "Minus",
  defaults: { label: "", weight: 1, labelColor: "" },
  fields: [
    { key: "label", label: "Divider label", type: "text", placeholder: "Optional label..." },
    { key: "weight", label: "Thickness", type: "range", min: 1, max: 6 },
    { key: "labelColor", label: "Label color", type: "color" },
  ],
  component: DividerBlock,
});

export { DividerBlock };
