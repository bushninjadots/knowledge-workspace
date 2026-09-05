// ── Studio Personalities ──────────────────────────────────────────────────────
// Curated one-click arrangements that stamp a whole studio: a layout
// composition, an appearance treatment (radius/typography/density/accent), and
// targeted theme overrides. Applying a personality is a destructive act (it
// replaces the layout), so callers confirm before applying.
//
// Once applied, the page records `personalityId`; subsequent manual edits
// update StudioConfig without touching the layout, detaching from the preset.

import type {
  LayoutBlockInstance,
  LayoutSection,
  PageLayout,
  ThemeTokens,
} from "@/lib/page-blocks";
import type { StudioConfig } from "@/lib/studio-config";

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

// ── Types ────────────────────────────────────────────────────────────────────

export interface StudioPersonality {
  id: string;
  label: string;
  description: string;
  /** Build the full page layout for this personality. */
  composition(): PageLayout;
  appearance: Pick<
    StudioConfig,
    "radius" | "personality" | "density" | "accentMode" | "accentColor"
  >;
  themeTokens: Partial<ThemeTokens>;
}

export interface AppliedPersonality {
  layout: PageLayout;
  config: StudioConfig;
  themeOverrides: Partial<ThemeTokens>;
}

/**
 * Compose a config + layout + token overrides from a personality preset.
 *
 * When an existing layout is supplied, block instances are matched by type and
 * moved into the preset's structure without replacing their ids or config. Any
 * custom blocks the preset does not know about are appended to the final
 * section, so a preset can change the rhythm of a Studio without deleting work.
 */
export function applyStudioPersonality(
  personality: StudioPersonality,
  currentLayout?: PageLayout,
): AppliedPersonality {
  const presetLayout = personality.composition();
  return {
    layout: currentLayout ? preserveStudioContent(currentLayout, presetLayout) : presetLayout,
    config: {
      structure: "wide", // Presets set structure via composition, not appearance
      personality: personality.appearance.personality,
      density: personality.appearance.density,
      radius: personality.appearance.radius,
      accentMode: personality.appearance.accentMode,
      accentColor: personality.appearance.accentColor,
      starterId: null,
      appBackground: "surface",
      publicBackground: "default",
    },
    themeOverrides: personality.themeTokens,
  };
}

export function preserveStudioContent(current: PageLayout, preset: PageLayout): PageLayout {
  const existingByType = new Map<string, LayoutBlockInstance[]>();
  for (const section of current.sections) {
    for (const block of section.blocks) {
      const blocks = existingByType.get(block.type) ?? [];
      blocks.push(block);
      existingByType.set(block.type, blocks);
    }
  }

  const usedIds = new Set<string>();
  const sections: LayoutSection[] = preset.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((presetBlock, position) => {
      const candidates = existingByType.get(presetBlock.type) ?? [];
      const existing = candidates.find((block) => !usedIds.has(block.id));
      if (!existing) return { ...presetBlock, position };
      usedIds.add(existing.id);
      return {
        ...existing,
        position,
        // The preset controls placement, while the user's content remains
        // authoritative. Keep visibility and every field in the block config.
        config: { ...existing.config },
      };
    }),
  }));

  const unmatched = [...existingByType.values()]
    .flat()
    .filter((block) => !usedIds.has(block.id))
    .map((block) => ({ ...block, config: { ...block.config } }));

  if (unmatched.length > 0) {
    const lastIndex = Math.max(0, sections.length - 1);
    const target = sections[lastIndex] ?? {
      id: `section-${Date.now()}`,
      position: 0,
      layout: "full" as const,
      blocks: [],
    };
    if (!sections[lastIndex]) sections.push(target);
    target.blocks = [...target.blocks, ...unmatched];
    target.blocks.forEach((block, position) => {
      block.position = position;
    });
  }

  sections.forEach((section, position) => {
    section.position = position;
  });
  return { sections };
}

// ── Presets ──────────────────────────────────────────────────────────────────

export const STUDIO_PERSONALITIES: StudioPersonality[] = [
  {
    id: "minimal",
    label: "Minimal",
    description: "One calm column. Text-led and quiet, with nothing clamoring for attention.",
    appearance: {
      radius: "sharp",
      personality: "technical",
      density: "spacious",
      accentMode: "auto",
      accentColor: "#3f8f8a",
    },
    themeTokens: {},
    composition(): PageLayout {
      return {
        sections: [
          { id: nid(), position: 0, layout: "full", blocks: [blk("profile-header", 0)] },
          {
            id: nid(),
            position: 1,
            layout: "full",
            blocks: [blk("profile-projects", 0, { presentation: "minimal-list" })],
          },
          { id: nid(), position: 2, layout: "full", blocks: [blk("profile-bio", 0)] },
          {
            id: nid(),
            position: 3,
            layout: "full",
            blocks: [blk("profile-skills", 0, { showCategories: false })],
          },
          { id: nid(), position: 4, layout: "full", blocks: [blk("profile-links", 0)] },
        ],
      };
    },
  },
  {
    id: "creative",
    label: "Creative",
    description: "Gallery-led and image-first. Asymmetric spreads that feel like a portfolio.",
    appearance: {
      radius: "soft",
      personality: "editorial",
      density: "comfortable",
      accentMode: "auto",
      accentColor: "#3f8f8a",
    },
    themeTokens: {},
    composition(): PageLayout {
      return {
        sections: [
          { id: nid(), position: 0, layout: "full", blocks: [blk("profile-header", 0)] },
          {
            id: nid(),
            position: 1,
            layout: "featured_work",
            blocks: [
              blk("profile-projects", 0, { presentation: "spotlight" }),
              blk("profile-direction", 1),
            ],
          },
          {
            id: nid(),
            position: 2,
            layout: "image_lead",
            blocks: [blk("profile-gallery", 0), blk("profile-bio", 1)],
          },
          {
            id: nid(),
            position: 3,
            layout: "asymmetric",
            blocks: [blk("profile-skills", 0), blk("profile-experience", 1)],
          },
          { id: nid(), position: 4, layout: "full", blocks: [blk("profile-links", 0)] },
        ],
      };
    },
  },
  {
    id: "professional",
    label: "Professional",
    description: "Structured and trustworthy. A clean hierarchy built for credibility.",
    appearance: {
      radius: "sharp",
      personality: "modern",
      density: "compact",
      accentMode: "none",
      accentColor: "#3f8f8a",
    },
    themeTokens: {},
    composition(): PageLayout {
      return {
        sections: [
          { id: nid(), position: 0, layout: "full", blocks: [blk("profile-header", 0)] },
          {
            id: nid(),
            position: 1,
            layout: "featured_work",
            blocks: [
              blk("profile-projects", 0, { presentation: "editorial-grid" }),
              blk("profile-direction", 1),
            ],
          },
          {
            id: nid(),
            position: 2,
            layout: "sidebar_left",
            blocks: [blk("profile-links", 0), blk("profile-skills", 1)],
          },
          {
            id: nid(),
            position: 3,
            layout: "compact_list",
            blocks: [blk("profile-achievements", 0)],
          },
          {
            id: nid(),
            position: 4,
            layout: "two_column",
            blocks: [blk("profile-experience", 0), blk("profile-tools", 1)],
          },
        ],
      };
    },
  },
  {
    id: "artistic",
    label: "Artistic",
    description: "Confident and experimental. Big type, rounded corners, a personal accent.",
    appearance: {
      radius: "soft",
      personality: "editorial",
      density: "spacious",
      accentMode: "custom",
      accentColor: "#6d28d9",
    },
    themeTokens: {},
    composition(): PageLayout {
      return {
        sections: [
          {
            id: nid(),
            position: 0,
            layout: "image_lead",
            blocks: [blk("profile-header", 0, { variant: "cover" }), blk("profile-gallery", 1)],
          },
          {
            id: nid(),
            position: 1,
            layout: "asymmetric",
            blocks: [blk("profile-bio", 0), blk("profile-direction", 1)],
          },
          {
            id: nid(),
            position: 2,
            layout: "full",
            blocks: [blk("profile-projects", 0, { presentation: "horizontal-scroll" })],
          },
          { id: nid(), position: 3, layout: "full", blocks: [blk("profile-links", 0)] },
        ],
      };
    },
  },
];

export function getStudioPersonality(id: string | null | undefined): StudioPersonality | null {
  if (!id) return null;
  return STUDIO_PERSONALITIES.find((p) => p.id === id) ?? null;
}

// Re-export the treatment types so pickers can type against them without
// reaching into studio-config directly.
export type {
  RadiusTreatment,
  TypographyTreatment,
  Density,
  AccentMode,
} from "@/lib/studio-config";
