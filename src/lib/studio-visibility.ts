import type { LayoutBlockInstance, LayoutSection } from "@/lib/page-blocks";
import { getBlock } from "@/lib/block-registry";

/**
 * Statically classify a block as having no public content, before it mounts.
 *
 * Only blocks whose content lives entirely in their config (registry flag
 * `contentSource: "config"` — text, heading, markdown, divider) can be
 * classified this way. Data-driven blocks read owner/DB content at runtime and
 * report emptiness themselves via `context.onBlockEmptyChange`; pre-filtering
 * them on an empty config would hide blocks whose config is `{}` but whose
 * database content exists. Unregistered types also fail open — the block gets
 * the chance to render and report.
 */
export function isDefinitelyEmptyBlock(block: LayoutBlockInstance): boolean {
  if (getBlock(block.type)?.contentSource !== "config") return false;

  const values = Object.values(block.config ?? {});
  if (values.length === 0) return true;

  return values.every((value) => {
    if (value == null) return true;
    if (typeof value === "string") return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    return false;
  });
}

/**
 * Whether a section should render in view (public) mode. Editing always shows
 * every section so empty blocks get their inline "add content" affordance. In
 * view mode a section is dropped when every visible block reports no content
 * (via `emptyBlockIds`, from static config classification plus the runtime
 * `onBlockEmptyChange` reporter), so an empty Studio section doesn't leave a
 * blank band and divider in the public presentation.
 */
export function shouldRenderSectionInView(
  section: LayoutSection,
  emptyBlockIds: ReadonlySet<string>,
): boolean {
  return !section.blocks.every((block) => block.visible === false || emptyBlockIds.has(block.id));
}
