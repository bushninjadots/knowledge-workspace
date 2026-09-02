// ── Block Renderer ────────────────────────────────────────────────────────────
// Given a block type and config, looks up the registered definition and
// renders its component. If the type is not registered, renders a fallback
// error block (visible only in edit mode).

import { memo } from "react";
import { getBlock } from "@/lib/block-registry";
import type { BlockConfig, BlockContext } from "@/lib/page-blocks";

interface BlockRendererProps {
  type: string;
  config: BlockConfig;
  context: BlockContext;
  onChange?: (config: BlockConfig) => void;
}

/**
 * Renders a single block by looking up its type in the global registry.
 * Memoised so layout changes don't re-render unchanged blocks.
 */
export const BlockRenderer = memo(function BlockRenderer({
  type,
  config,
  context,
  onChange,
}: BlockRendererProps) {
  const def = getBlock(type);

  if (!def) {
    // Missing block — only show anything in edit mode so the owner can fix it.
    if (!context.isEditing) return null;
    return (
      <div className="rounded-lg border border-dashed border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Unknown block type: <code className="font-mono text-xs">{type}</code>
      </div>
    );
  }

  const Component = def.component;

  // Containerless blocks (hero, full-width sections) render without wrapper.
  if (def.containerless) {
    return <Component config={config} onChange={onChange} context={context} />;
  }

  return (
    <div
      data-block-type={type}
      data-block-id={context.blockId ?? context.pageId}
      className="group/block"
    >
      <Component config={config} onChange={onChange} context={context} />
    </div>
  );
});
