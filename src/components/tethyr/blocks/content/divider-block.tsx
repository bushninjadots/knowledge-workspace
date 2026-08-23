// ── Divider Block ─────────────────────────────────────────────────────────────
// A horizontal divider / separator. Registers as "divider".

import { Minus } from "lucide-react";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

function DividerBlock({ config, context }: BlockProps) {
  const label = typeof config.label === "string" && config.label.length > 0 ? config.label : null;

  if (label && !context.isEditing) {
    return (
      <div className="flex items-center gap-3 py-2">
        <hr className="flex-1 border-border" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <hr className="flex-1 border-border" />
      </div>
    );
  }

  return <hr className="my-2 border-border" />;
}

registerBlock({
  type: "divider",
  category: "content",
  label: "Divider",
  description: "A horizontal rule to separate sections. Optionally add a label.",
  icon: "Minus",
  defaults: { label: "" },
  component: DividerBlock,
});

export { DividerBlock };