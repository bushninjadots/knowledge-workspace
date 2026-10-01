import type { LayoutBlockInstance, LayoutSection } from "@/lib/page-blocks";

/**
 * Config-only blocks can be classified before their component mounts. This
 * prevents a publish from briefly reserving a frame for a block whose required
 * copy, URL, or item list is visibly empty.
 */
export function isDefinitelyEmptyBlock(block: LayoutBlockInstance): boolean {
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
 * (via `emptyBlockIds`), so an empty Studio section doesn't leave a blank band
 * and divider in the public presentation.
 */
export function shouldRenderSectionInView(
  section: LayoutSection,
  emptyBlockIds: ReadonlySet<string>,
): boolean {
  return !section.blocks.every((block) => block.visible === false || emptyBlockIds.has(block.id));
}
