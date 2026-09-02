import type { LayoutSection } from "@/lib/page-blocks";

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
