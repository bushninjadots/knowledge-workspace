// What will change for visitors when a Studio draft goes live — shown in the
// publish dialog (and the unpublished-changes summary) so publishing is
// deliberate, not blind. At most four lines.

import { getBlock } from "@/lib/block-registry";
import type { PageLayout } from "@/lib/page-blocks";
import { normalizeLayout } from "@/lib/studio-layout";

export function describePublishChanges({
  layout,
  latestPublishedLayout,
  themeChanged,
  appearanceChanged,
}: {
  layout: PageLayout | null;
  latestPublishedLayout: PageLayout | null;
  themeChanged: boolean;
  appearanceChanged: boolean;
}): string[] {
  if (!layout) return [];
  if (!latestPublishedLayout) return ["First publish — your Studio goes live."];
  const current = normalizeLayout(layout);
  const previous = normalizeLayout(latestPublishedLayout);
  const lines: string[] = [];
  const currentSectionIds = new Set(current.sections.map((s) => s.id));
  const previousSectionIds = new Set(previous.sections.map((s) => s.id));
  const addedSections = current.sections.filter((s) => !previousSectionIds.has(s.id)).length;
  const removedSections = previous.sections.filter((s) => !currentSectionIds.has(s.id)).length;
  if (addedSections) lines.push(`Added ${addedSections} area${addedSections === 1 ? "" : "s"}`);
  if (removedSections)
    lines.push(`Removed ${removedSections} area${removedSections === 1 ? "" : "s"}`);
  const blockCounts = (sections: PageLayout["sections"]) => {
    const map = new Map<string, number>();
    for (const section of sections) {
      for (const block of section.blocks) {
        const label = getBlock(block.type)?.label ?? block.type;
        map.set(label, (map.get(label) ?? 0) + 1);
      }
    }
    return map;
  };
  const currentBlocks = blockCounts(current.sections);
  const previousBlocks = blockCounts(previous.sections);
  for (const [label, count] of currentBlocks) {
    const delta = count - (previousBlocks.get(label) ?? 0);
    if (delta > 0) lines.push(`Added ${delta} ${label} block${delta === 1 ? "" : "s"}`);
  }
  for (const [label, count] of previousBlocks) {
    const delta = count - (currentBlocks.get(label) ?? 0);
    if (delta > 0) lines.push(`Removed ${delta} ${label} block${delta === 1 ? "" : "s"}`);
  }
  if (themeChanged) lines.push("Changed theme");
  if (appearanceChanged) lines.push("Updated appearance");
  if (lines.length === 0) lines.push("Arrangement changes");
  return lines.slice(0, 4);
}
