// ── Template application ──────────────────────────────────────────────────────
// Shared by built-in starters and community templates. Templates carry
// STRUCTURE only (sections, block types, per-block config); they never carry
// private content. Applying one to a live layout re-dresses what the member
// already has — content survives, arrangement changes, one undo puts it back.
//
// Two guarantees:
//  1. Sanitization — a template's sections are untrusted JSON from the DB.
//     Every block type must exist in the registry and every section must be a
//     well-formed LayoutSection before it can touch a live layout, or the
//     renderer crashes mid-render. Unknown block types are dropped (a template
//     created before a block was retired must not break the modern renderer).
//  2. Non-destruction — the live layout's own sections are never removed.
//     Sections not covered by the template keep their relative order, their
//     position (behind the template's sections), visibility, and grid.

import type { LayoutBlockInstance, LayoutSection, PageLayout } from "@/lib/page-blocks";
import { getBlock } from "@/lib/block-registry";
import { sectionMarker } from "@/data/starters";

const SECTION_LAYOUTS = new Set([
  "full",
  "two_column",
  "three_column",
  "sidebar_left",
  "sidebar_right",
  "feature",
  "side_by_side",
  "featured_work",
  "asymmetric",
  "split",
  "image_lead",
  "compact_list",
]);

/** Legacy section-layout values mapped to their closest current composition. */
const SECTION_LAYOUTS_FALLBACK: Record<string, LayoutSection["layout"]> = {
  hero: "feature",
  gallery: "side_by_side",
  list: "compact_list",
};

function normalizeSectionLayout(value: unknown): LayoutSection["layout"] {
  if (typeof value === "string") {
    if (SECTION_LAYOUTS.has(value)) return value as LayoutSection["layout"];
    if (SECTION_LAYOUTS_FALLBACK[value]) return SECTION_LAYOUTS_FALLBACK[value];
  }
  return "full";
}

/** True when a block instance looks renderable: type known, id present. */
function isRenderableBlock(block: unknown): block is LayoutBlockInstance {
  if (!block || typeof block !== "object") return false;
  const candidate = block as Partial<LayoutBlockInstance>;
  if (typeof candidate.type !== "string" || typeof candidate.id !== "string") return false;
  return getBlock(candidate.type) != null;
}

/**
 * Sanitize untrusted template sections into renderable LayoutSections.
 * Drops sections with no renderable blocks, renumbers positions, and heals
 * unknown section layout values. Returns [] when nothing survives.
 */
export function sanitizeTemplateSections(raw: unknown): LayoutSection[] {
  if (!Array.isArray(raw)) return [];
  const sections: LayoutSection[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<LayoutSection>;
    // Templates publish what they show — a hidden section in a template is
    // dead weight, so it is dropped rather than carried into the Studio.
    if (candidate.visible === false) continue;
    if (!Array.isArray(candidate.blocks)) continue;
    const blocks = candidate.blocks.filter(isRenderableBlock).map((block, index) => ({
      ...block,
      position: index,
      config: { ...(block.config ?? {}) },
    }));
    if (blocks.length === 0) continue;
    sections.push({
      id:
        typeof candidate.id === "string" && candidate.id ? candidate.id : `tpl-${sections.length}`,
      position: sections.length,
      title: typeof candidate.title === "string" ? candidate.title : undefined,
      layout: normalizeSectionLayout(candidate.layout),
      // Hidden sections never reach this line (dropped above).
      visible: true,
      blocks,
      ...(Array.isArray(candidate.grid) ? { grid: candidate.grid } : {}),
    });
  }
  return sections;
}

/**
 * Apply sanitized template sections to the member's live layout.
 *
 * Template sections lead, in their order. Live sections the template doesn't
 * cover keep their relative order behind them, their visibility untouched —
 * a template leads the story; it doesn't erase the member's other work.
 * Live sections keep their ids, grids, and every block exactly as they are;
 * only section order changes.
 */
export function applyTemplateSections(
  layout: PageLayout,
  templateSections: LayoutSection[],
): PageLayout {
  if (templateSections.length === 0) return layout;

  // A template section covers the live section carrying the same semantic
  // marker (identity/projects/bio/…), regardless of block ids.
  const coveredMarkers = new Set<string>();
  for (const section of templateSections) {
    const marker = sectionMarker(section);
    if (marker) coveredMarkers.add(marker);
  }

  const templateIds = new Set(templateSections.map((s) => s.id));
  const followers: LayoutSection[] = [];
  for (const section of layout.sections) {
    const marker = sectionMarker(section);
    if (marker && coveredMarkers.has(marker)) continue;
    if (templateIds.has(section.id)) continue;
    followers.push(section);
  }

  return {
    sections: [
      ...templateSections.map((section, position) => ({ ...section, position })),
      ...followers.map((section, index) => ({
        ...section,
        position: templateSections.length + index,
      })),
    ],
  };
}
