// ── Default Layouts ──────────────────────────────────────────────────────────
// Generates comprehensive block layouts for new pages.
// Every existing project/profile section has a corresponding block type so
// owners can add, remove, reorder, or hide any section they want.

import type { PageLayout, LayoutBlockInstance } from "@/lib/page-blocks";

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
