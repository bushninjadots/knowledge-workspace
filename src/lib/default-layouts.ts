// ── Default Layouts ──────────────────────────────────────────────────────────
// Generates comprehensive block layouts for new pages.
// Every existing project/profile section has a corresponding block type so
// owners can add, remove, reorder, or hide any section they want.

import type { PageLayout, LayoutBlockInstance, SectionLayoutType } from "@/lib/page-blocks";

let _counter = 0;
function nid(): string {
  return `b-${++_counter}-${Date.now().toString(36)}`;
}

function blk(
  type: string,
  position: number,
  config: Record<string, unknown> = {},
): LayoutBlockInstance {
  return { id: nid(), type, position, config, visible: true };
}

/** Full default project page — every section that has data appears. */
export function createDefaultProjectLayout(): PageLayout {
  return {
    sections: [
      {
        id: nid(),
        position: 0,
        layout: "full",
        blocks: [
          blk("project-hero", 0, { showDescription: true, showProgress: true, showTags: true }),
        ],
      },
      {
        id: nid(),
        position: 1,
        layout: "full",
        blocks: [blk("divider", 0), blk("project-about", 1)],
      },
      {
        id: nid(),
        position: 2,
        layout: "two_column",
        blocks: [blk("project-status", 0), blk("project-milestones", 1)],
      },
      {
        id: nid(),
        position: 3,
        layout: "two_column",
        blocks: [blk("project-team", 0), blk("project-roles", 1)],
      },
      { id: nid(), position: 4, layout: "full", blocks: [blk("project-files", 0)] },
      { id: nid(), position: 5, layout: "full", blocks: [blk("project-repos", 0)] },
      {
        id: nid(),
        position: 6,
        layout: "two_column",
        blocks: [blk("project-needs", 0), blk("project-discussions", 1)],
      },
      { id: nid(), position: 7, layout: "full", blocks: [blk("project-sessions", 0)] },
      { id: nid(), position: 8, layout: "full", blocks: [blk("project-evidence", 0)] },
      { id: nid(), position: 9, layout: "full", blocks: [blk("project-credits", 0)] },
      { id: nid(), position: 10, layout: "full", blocks: [blk("project-activity", 0)] },
      { id: nid(), position: 11, layout: "full", blocks: [blk("project-timeline", 0)] },
    ],
  };
}

/** Full default profile — every section that has data appears. */
export function createDefaultProfileLayout(): PageLayout {
  return {
    sections: [
      { id: nid(), position: 0, layout: "full", blocks: [blk("profile-header", 0)] },
      { id: nid(), position: 1, layout: "full", blocks: [blk("profile-direction", 0)] },
      { id: nid(), position: 2, layout: "full", blocks: [blk("profile-bio", 0)] },
      {
        id: nid(),
        position: 3,
        layout: "two_column",
        blocks: [blk("profile-skills", 0), blk("profile-experience", 1)],
      },
      { id: nid(), position: 4, layout: "full", blocks: [blk("profile-tools", 0)] },
      { id: nid(), position: 5, layout: "full", blocks: [blk("profile-projects", 0)] },
      { id: nid(), position: 6, layout: "full", blocks: [blk("profile-links", 0)] },
      { id: nid(), position: 7, layout: "full", blocks: [blk("profile-achievements", 0)] },
      { id: nid(), position: 8, layout: "full", blocks: [blk("profile-gallery", 0)] },
    ],
  };
}

export type DirectionId = "showcase" | "collaborate" | "document";

const DIRECTION_BLUEPRINTS: Record<
  "profile" | "project",
  Record<DirectionId, Array<[SectionLayoutType, string[]]>>
> = {
  profile: {
    showcase: [
      ["full", ["profile-header"]],
      ["full", ["profile-projects"]],
      ["full", ["profile-gallery"]],
      ["two_column", ["profile-skills", "profile-experience"]],
      ["full", ["profile-tools"]],
      ["full", ["profile-links"]],
    ],
    collaborate: [
      ["full", ["profile-header"]],
      ["full", ["profile-direction"]],
      ["two_column", ["profile-experience", "profile-skills"]],
      ["full", ["profile-tools"]],
      ["full", ["profile-bio"]],
      ["full", ["profile-links"]],
    ],
    document: [
      ["full", ["profile-header"]],
      ["full", ["profile-bio"]],
      ["full", ["profile-skills"]],
      ["full", ["profile-projects"]],
      ["full", ["profile-achievements"]],
      ["full", ["profile-links"]],
    ],
  },
  project: {
    showcase: [
      ["full", ["project-hero"]],
      ["two_column", ["project-status", "project-milestones"]],
      ["full", ["project-evidence"]],
      ["two_column", ["project-team", "project-roles"]],
      ["full", ["project-repos"]],
      ["full", ["project-credits"]],
    ],
    collaborate: [
      ["full", ["project-hero"]],
      ["full", ["project-needs"]],
      ["two_column", ["project-roles", "project-team"]],
      ["full", ["project-discussions"]],
      ["full", ["project-sessions"]],
    ],
    document: [
      ["full", ["project-hero"]],
      ["full", ["project-status"]],
      ["full", ["project-milestones"]],
      ["full", ["project-timeline"]],
      ["full", ["project-evidence"]],
      ["full", ["project-activity"]],
    ],
  },
};

/**
 * Build a complete, well-structured starter layout for a "direction" recipe.
 * Unlike the old section-preset recipes (which produced mostly empty
 * sections), these yield a full, immediately-functional page — the same
 * quality as the default setup — oriented toward the chosen goal and the
 * page's owner type.
 */
export function createDirectionLayout(direction: DirectionId, ownerType: "profile" | "project"): PageLayout {
  const blueprint = DIRECTION_BLUEPRINTS[ownerType][direction];
    ownerType === "profile"
      ? {
          showcase: [
            ["full", ["profile-header"]],
            ["full", ["profile-projects"]],
            ["full", ["profile-gallery"]],
            ["two_column", ["profile-skills", "profile-experience"]],
            ["full", ["profile-tools"]],
            ["full", ["profile-links"]],
          ],
          collaborate: [
            ["full", ["profile-header"]],
            ["full", ["profile-direction"]],
            ["two_column", ["profile-experience", "profile-skills"]],
            ["full", ["profile-tools"]],
            ["full", ["profile-bio"]],
            ["full", ["profile-links"]],
          ],
          document: [
            ["full", ["profile-header"]],
            ["full", ["profile-bio"]],
            ["full", ["profile-skills"]],
            ["full", ["profile-projects"]],
            ["full", ["profile-achievements"]],
            ["full", ["profile-links"]],
          ],
        }[direction]
      : {
          showcase: [
            ["full", ["project-hero"]],
            ["two_column", ["project-status", "project-milestones"]],
            ["full", ["project-evidence"]],
            ["two_column", ["project-team", "project-roles"]],
            ["full", ["project-repos"]],
            ["full", ["project-credits"]],
          ],
          collaborate: [
            ["full", ["project-hero"]],
            ["full", ["project-needs"]],
            ["two_column", ["project-roles", "project-team"]],
            ["full", ["project-discussions"]],
            ["full", ["project-sessions"]],
          ],
          document: [
            ["full", ["project-hero"]],
            ["full", ["project-status"]],
            ["full", ["project-milestones"]],
            ["full", ["project-timeline"]],
            ["full", ["project-evidence"]],
            ["full", ["project-activity"]],
          ],
        }[direction];

  return {
    sections: blueprint.map(([layout, blockTypes], index) => ({
      id: nid(),
      position: index,
      layout,
      blocks: blockTypes.map((type, blockIndex) => blk(type, blockIndex)),
    })),
  };
}
