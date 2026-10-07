// ── Layout composition ────────────────────────────────────────────────────────
// A layout template describes a *composition*: which kinds of content lead,
// how wide each piece is, what sits beside what, and how the rest of the page
// keeps the rhythm. `composeLayout` re-arranges a member's existing blocks into
// that composition. It is deterministic and non-destructive:
//
//   • every block keeps its id, type, config and visibility — nothing is
//     created (except a template's explicit `adds`) and nothing is deleted;
//   • areas are reused where they already hold the content, so their titles
//     and Area settings (background, accent, divider…) survive;
//   • it writes real grid positions, so the change is visible everywhere (the
//     editor, the owner view and the public page all read the grid);
//   • it is content-aware: a slot with nothing to fill is skipped, and the
//     blocks left in its row widen to use the space, so a missing gallery
//     never leaves a hole;
//   • it never touches the look (theme, visual language, fonts, colours);
//     phone width and overlap are composition, so they're reset to the
//     template's.
//
// Blocks the template doesn't name stay in their own areas, re-flowed with
// the template's `rest` rhythm, so the whole page follows the composition.

import type {
  AreaAppearance,
  LayoutBlockInstance,
  LayoutGridItem,
  LayoutSection,
  PageLayout,
} from "@/lib/page-blocks";
import { sizeFor } from "@/lib/studio-grid";

/** Kinds of content a slot can hold, by the block types that provide them. */
export const ROLES = {
  identity: ["profile-header"],
  projects: ["profile-projects"],
  building: ["profile-currently-building"],
  proof: ["profile-proof-of-work"],
  bio: ["profile-bio"],
  readme: ["profile-readme", "project-about"],
  direction: ["profile-direction", "profile-looking-for", "profile-availability"],
  quote: ["quote", "callout"],
  skills: ["profile-skills"],
  tools: ["profile-tools"],
  experience: ["profile-experience", "timeline"],
  services: ["services"],
  gallery: ["profile-gallery"],
  highlights: ["highlights", "profile-contribution-stats"],
  achievements: ["profile-achievements"],
  activity: ["profile-activity-heatmap"],
  network: ["profile-collaboration-network", "profile-collaborators"],
  links: ["profile-links", "featured-link"],
  cta: ["call-to-action"],
  faq: ["faq"],
} as const satisfies Record<string, readonly string[]>;
export type Role = keyof typeof ROLES;

/** One place in a row: the first unplaced block of any of these roles. */
export interface Slot {
  role: Role | Role[];
  /** Columns (of 12). */
  w: number;
  /** Start column; omitted = right after the previous slot. Leaves space on
   *  purpose (Open canvas), never overlaps. */
  x?: number;
  /** On phones: half width (two side by side) instead of full. */
  phone?: "half";
  /** On bigger screens: reach up over the edge of the piece above
   *  (LayoutBlockInstance.overlap). Placement only — the grid never overlaps. */
  overlap?: true;
}

export interface ComposedArea {
  /** Stable key, used for new areas' ids. */
  key: string;
  /** Title for a new area, or a reused area that has none of its own. */
  title?: string;
  rows: Slot[][];
  /** Area settings for a new area (a reused area keeps its own). */
  appearance?: AreaAppearance;
}

export interface Composition {
  areas: ComposedArea[];
  /** Column widths that every other area's blocks cycle through. */
  rest: number[];
  /** Blocks of these roles go half width on phones, wherever they land. */
  phoneHalf?: Role[];
}

const roleOf = new Map<string, Role>(
  (Object.entries(ROLES) as Array<[Role, readonly string[]]>).flatMap(([role, types]) =>
    types.map((type) => [type, role] as const),
  ),
);

/** The role a block plays, or null for content-only blocks (text, heading…). */
export function blockRole(type: string): Role | null {
  return roleOf.get(type) ?? null;
}

const PLACEHOLDER_TITLE = /^area\s+\d+$/i;

/**
 * Place blocks into rows: each row's matched slots keep their proportions and
 * stretch to fill the row when a sibling slot found nothing. Returns grid
 * items in reading order.
 */
function placeRows(rows: Array<Array<{ block: LayoutBlockInstance; slot: Slot }>>): {
  grid: LayoutGridItem[];
  order: LayoutBlockInstance[];
} {
  const grid: LayoutGridItem[] = [];
  const order: LayoutBlockInstance[] = [];
  let y = 0;
  for (const row of rows) {
    if (row.length === 0) continue;
    const fixedX = row.length === 1 && row[0].slot.x !== undefined;
    const total = row.reduce((sum, entry) => sum + entry.slot.w, 0);
    const scale = fixedX ? 1 : 12 / total;
    let x = fixedX ? (row[0].slot.x ?? 0) : 0;
    let rowHeight = 0;
    row.forEach((entry, index) => {
      const [, height, minW, minH] = sizeFor(entry.block.type);
      // Proportional widths, the last one taking the remainder exactly.
      let w =
        index === row.length - 1 && !fixedX
          ? 12 - x
          : Math.max(minW, Math.round(entry.slot.w * scale));
      if (x + Math.max(minW, w) > 12) {
        // Minimum widths don't fit beside the rest: wrap to a new line.
        y += rowHeight;
        x = 0;
        rowHeight = 0;
        w = index === row.length - 1 ? 12 : w;
      }
      w = Math.max(minW, Math.min(12 - x, w));
      const h = Math.max(minH, entry.block.height ?? height);
      grid.push({ i: entry.block.id, x, y, w, h, minW, minH });
      order.push(entry.block);
      x += w;
      rowHeight = Math.max(rowHeight, h);
    });
    y += rowHeight;
  }
  return { grid, order };
}

/** Re-flow blocks through repeating column widths (blocks too wide for the
 *  space left in a row start a new row). */
function flowRest(
  blocks: LayoutBlockInstance[],
  widths: number[],
): Array<Array<{ block: LayoutBlockInstance; slot: Slot }>> {
  const rows: Array<Array<{ block: LayoutBlockInstance; slot: Slot }>> = [];
  let row: Array<{ block: LayoutBlockInstance; slot: Slot }> = [];
  let used = 0;
  blocks.forEach((block, index) => {
    const [, , minW] = sizeFor(block.type);
    const w = Math.max(minW, widths[index % widths.length]);
    if (used + w > 12 && row.length > 0) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push({ block, slot: { role: "bio", w } });
    used += w;
  });
  if (row.length > 0) rows.push(row);
  return rows;
}

/**
 * Re-arrange `layout` into `composition`. See the module comment for the
 * guarantees; `blocks` are matched in their current reading order, so a
 * member's first projects block stays the first one.
 */
export function composeLayout(
  layout: PageLayout,
  composition: Composition,
  options: {
    /** Titles the member never typed (from layouts or the default page), in
     *  lower case. A reused area with one of these takes the layout's title. */
    generatedTitles?: ReadonlySet<string>;
  } = {},
): PageLayout {
  // Every block in reading order (area order, then grid position).
  const sourceOf = new Map<string, LayoutSection>();
  const all: LayoutBlockInstance[] = [];
  for (const section of layout.sections) {
    const grid = new Map((section.grid ?? []).map((item) => [item.i, item]));
    const ordered = [...section.blocks].sort((a, b) => {
      const ga = grid.get(a.id);
      const gb = grid.get(b.id);
      return ga && gb ? ga.y - gb.y || ga.x - gb.x : a.position - b.position;
    });
    for (const block of ordered) {
      sourceOf.set(block.id, section);
      all.push(block);
    }
  }
  const used = new Set<string>();
  const take = (slot: Slot): LayoutBlockInstance | undefined => {
    const roles = Array.isArray(slot.role) ? slot.role : [slot.role];
    for (const role of roles) {
      const types: readonly string[] = ROLES[role];
      // Blocks in an area the member hid stay there, hidden.
      const found = all.find(
        (block) =>
          !used.has(block.id) &&
          types.includes(block.type) &&
          sourceOf.get(block.id)?.visible !== false,
      );
      if (found) {
        used.add(found.id);
        return found;
      }
    }
    return undefined;
  };

  const phoneHalf = new Set<Role>(composition.phoneHalf ?? []);
  // Placement the template decides: phone width and overlap.
  const withPhone = (block: LayoutBlockInstance, slot?: Slot): LayoutBlockInstance => {
    const role = blockRole(block.type);
    const half = slot?.phone === "half" || (role !== null && phoneHalf.has(role));
    const { phoneWidth: _phoneWidth, overlap: _overlap, ...rest } = block;
    return {
      ...rest,
      ...(half && { phoneWidth: "half" as const }),
      ...(slot?.overlap && { overlap: "up" as const }),
    };
  };

  const reusedIds = new Set<string>();
  const composed: LayoutSection[] = [];
  for (const area of composition.areas) {
    const rows = area.rows
      .map((row) =>
        row
          .map((slot) => {
            const block = take(slot);
            return block ? { block: withPhone(block, slot), slot } : null;
          })
          .filter((entry): entry is { block: LayoutBlockInstance; slot: Slot } => !!entry),
      )
      .filter((row) => row.length > 0);
    if (rows.length === 0) continue; // nothing for this area: no empty zone
    const { grid, order } = placeRows(rows);
    // Reuse the area most of these blocks came from (keeps its id, title and
    // Area settings) unless an earlier template area already claimed it.
    const counts = new Map<string, number>();
    for (const block of order) {
      const source = sourceOf.get(block.id);
      if (source && !reusedIds.has(source.id))
        counts.set(source.id, (counts.get(source.id) ?? 0) + 1);
    }
    const reuseId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const reused = layout.sections.find((section) => section.id === reuseId);
    if (reused) reusedIds.add(reused.id);
    const ownTitle = reused?.title?.trim();
    // A reused area keeps its own title while it is still mostly that area
    // (at least half of its blocks stayed together); once it has become
    // something else, the layout's title — so titles don't drift onto
    // unrelated content over several layouts.
    const stayed = reused
      ? reused.blocks.filter((b) => order.some((o) => o.id === b.id)).length
      : 0;
    const sameArea = !!reused && stayed * 2 >= reused.blocks.length;
    composed.push({
      ...(reused ?? { id: `section-tpl-${area.key}`, visible: true, appearance: area.appearance }),
      title:
        sameArea &&
        ownTitle &&
        !PLACEHOLDER_TITLE.test(ownTitle) &&
        !options.generatedTitles?.has(ownTitle.toLowerCase())
          ? ownTitle
          : (area.title ?? ""),
      layout: "full",
      position: 0,
      blocks: order.map((block, index) => ({ ...block, position: index })),
      grid,
    });
  }

  // Everything else stays in its own area, re-flowed with the template's rhythm.
  for (const section of layout.sections) {
    const remaining = all.filter(
      (block) => !used.has(block.id) && sourceOf.get(block.id)?.id === section.id,
    );
    if (remaining.length === 0) continue; // an emptied area holds no content
    remaining.forEach((block) => used.add(block.id));
    const { grid, order } = placeRows(
      flowRest(
        remaining.map((b) => withPhone(b)),
        composition.rest,
      ),
    );
    composed.push({
      ...section,
      id: reusedIds.has(section.id) ? `${section.id}-more` : section.id,
      layout: "full",
      position: 0,
      blocks: order.map((block, index) => ({ ...block, position: index })),
      grid,
    });
  }

  // Section ids stay unique (React keys, grid targets): an id minted here can
  // already belong to an area left from an earlier application.
  const seen = new Set<string>();
  return {
    sections: composed.map((section, position) => {
      let id = section.id;
      for (let n = 2; seen.has(id); n++) id = `${section.id}-${n}`;
      seen.add(id);
      return { ...section, id, position };
    }),
  };
}
