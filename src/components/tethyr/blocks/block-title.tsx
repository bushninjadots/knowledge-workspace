// ── Block title ────────────────────────────────────────────────────────────────
// One title treatment for every block. Its look comes from the Studio's
// "Block titles" setting (label / heading / hidden, via --bt-* custom
// properties); each block instance can rename its title (`config.title`) or
// hide it (`config.hideTitle`) from the inspector.

import type { ReactNode } from "react";
import type { BlockConfig } from "@/lib/page-blocks";

/** The text a block's title shows: the member's own, else the block's. */
export function blockTitleText(config: BlockConfig, fallback: string): string {
  const custom = typeof config.title === "string" ? config.title.trim() : "";
  return custom || fallback;
}

/** Whether a block hides its title, honouring the block's default. */
export function isBlockTitleHidden(config: BlockConfig, hiddenByDefault = false): boolean {
  return typeof config.hideTitle === "boolean" ? config.hideTitle : hiddenByDefault;
}

export function BlockTitle({
  config,
  children,
  icon,
  count,
  action,
  hiddenByDefault,
}: {
  config: BlockConfig;
  /** The block's default title. */
  children: string;
  icon?: ReactNode;
  /** A total shown after the title ("Achievements · 7"). */
  count?: number;
  /** A control on the right of the title row (e.g. the owner's "Add"). */
  action?: ReactNode;
  /** Blocks whose content already labels itself start without a title. */
  hiddenByDefault?: boolean;
}) {
  const hidden = isBlockTitleHidden(config, hiddenByDefault);
  if (hidden && !action) return null;
  return (
    <div className="block-title-row">
      {hidden ? (
        <span />
      ) : (
        <h2 className="block-title">
          {icon}
          <span className="truncate">{blockTitleText(config, children)}</span>
          {typeof count === "number" && count > 0 && (
            <span className="block-title-count">· {count}</span>
          )}
        </h2>
      )}
      {action}
    </div>
  );
}
