// ── Default Project Layout ────────────────────────────────────────────────────
// Generates a standard block layout for a new project page.
// Used by useProjectPage to auto-create pages for projects that don't have one.

import type { PageLayout, LayoutSection, LayoutBlockInstance } from "@/lib/page-blocks";

let _counter = 0;
function nextId(): string {
  return `blk-${++_counter}-${Date.now().toString(36)}`;
}

/**
 * Default project layout:
 *   Hero → About → Status + Team → Activity
 * This is a starting point; the owner can customize it later.
 */
export function createDefaultProjectLayout(): PageLayout {
  const sections: LayoutSection[] = [
    {
      id: nextId(),
      position: 0,
      layout: "full",
      blocks: [
        block("project-hero", 0, { showDescription: true, showProgress: true, showTags: true }),
      ],
    },
    {
      id: nextId(),
      position: 1,
      layout: "full",
      blocks: [
        block("divider", 0, {}),
        block("project-about", 1, {}),
      ],
    },
    {
      id: nextId(),
      position: 2,
      layout: "two_column",
      blocks: [
        block("project-status", 0, {}),
        block("project-team", 1, {}),
      ],
    },
    {
      id: nextId(),
      position: 3,
      layout: "full",
      blocks: [
        block("project-activity", 0, {}),
      ],
    },
  ];

  return { sections };
}

/**
 * Default profile layout:
 *   ProfileHeader → Bio → Divider → Skills + Projects (two column)
 * The identity header from the existing route (Shell + avatar) remains;
 * this layout complements it with blocks below.
 */
export function createDefaultProfileLayout(): PageLayout {
  return {
    sections: [
      {
        id: nextId(),
        position: 0,
        layout: "full",
        blocks: [
          block("profile-header", 0, {}),
        ],
      },
      {
        id: nextId(),
        position: 1,
        layout: "full",
        blocks: [
          block("profile-bio", 0, {}),
        ],
      },
      {
        id: nextId(),
        position: 2,
        layout: "two_column",
        blocks: [
          block("profile-skills", 0, {}),
          block("profile-projects", 1, {}),
        ],
      },
    ],
  };
}

function block(type: string, position: number, config: Record<string, unknown>): LayoutBlockInstance {
  return {
    id: nextId(),
    type,
    position,
    config,
    visible: true,
  };
}