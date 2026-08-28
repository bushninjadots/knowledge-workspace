// ── Section Presets ───────────────────────────────────────────────────────────
// Visual presets shown when the user clicks "+ Add Section".
// Each preset creates a LayoutSection with a specific column arrangement
// and optional starter blocks.

import type { SectionLayoutType } from "@/lib/page-blocks";

export interface SectionPreset {
  id: string;
  label: string;
  description: string;
  /** Lucide icon name for the visual preview. */
  icon: string;
  /** The column layout for the new section. */
  layout: SectionLayoutType;
  /** Optional blocks to place in the section on creation. */
  starterBlocks?: Array<{ type: string; config?: Record<string, unknown> }>;
}

export const SECTION_PRESETS: SectionPreset[] = [
  {
    id: "blank",
    label: "Blank",
    description: "Empty section — add your own blocks",
    icon: "Square",
    layout: "full",
  },
  {
    id: "one-column",
    label: "One Column",
    description: "Single full-width column",
    icon: "RectangleHorizontal",
    layout: "full",
  },
  {
    id: "side-by-side",
    label: "Side by side",
    description: "Two sections that sit together",
    icon: "Columns2",
    layout: "side_by_side",
  },
  {
    id: "two-columns",
    label: "Two Columns",
    description: "Side-by-side layout",
    icon: "Columns2",
    layout: "two_column",
  },
  {
    id: "three-columns",
    label: "Three Columns",
    description: "Three equal columns",
    icon: "Columns3",
    layout: "three_column",
  },
  {
    id: "hero",
    label: "Hero",
    description: "Full-width hero section",
    icon: "Layout",
    layout: "full",
    starterBlocks: [{ type: "project-hero" }],
  },
  {
    id: "two-row",
    label: "Two Rows",
    description: "Stacked full-width rows",
    icon: "Rows2",
    layout: "full",
  },
];
