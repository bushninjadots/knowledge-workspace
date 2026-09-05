// ── Studio Starters ───────────────────────────────────────────────────────────
// Starting directions — "choose how you want your Studio to feel".
//
// A starter is a STARTING POINT, never a destructive replacement: it changes
// personality, structure, layout rhythm, section order and the projects
// presentation, but every section, block and piece of content survives.
// Sections that a starter prefers to tuck away are hidden, not deleted, and the
// whole change is one undo away.
//
// Unlike the g/ prototype, Tethyr sections carry no stable semantic ids — they
// are composed from sets of blocks and identified by the block types they
// contain. Section order and collapse behaviour are therefore expressed in
// terms of semantic markers, resolved against the live layout.

import type {
  BackgroundId,
  DensityId,
  PersonalityId,
  RadiusId,
  StarterId,
  StructureId,
  StudioConfig,
} from "@/lib/studio-config";
import type { LayoutSection, PageLayout } from "@/lib/page-blocks";

/** Semantic identity of a profile section, derived from the block types it holds. */
type SectionMarker = "identity" | "projects" | "bio" | "skills" | "gallery" | "tools" | "links";

type ProfileProjectsPresentation =
  "spotlight" | "editorial-grid" | "horizontal-scroll" | "minimal-list";

interface StarterConfigStamp {
  structure: StructureId;
  personality: PersonalityId;
  density: DensityId;
  radius: RadiusId;
  appBackground: BackgroundId;
  publicBackground: BackgroundId;
}

export interface Starter {
  id: StarterId;
  name: string;
  tagline: string;
  feels: string;
  config: StarterConfigStamp;
  /** Applied to the profile-projects block. */
  presentation: ProfileProjectsPresentation;
  /** Sections by marker that should lead the Studio, in order. */
  sectionOrder: SectionMarker[];
  /** Sections by marker to hide (not delete). */
  collapsedSections: SectionMarker[];
  /** Preview glyph: relative block weights, rendered as a tiny wireframe. */
  sketch: number[][];
}

// ── Semantic markers ──────────────────────────────────────────────────────────

const MARKER_BLOCKS: Record<SectionMarker, string[]> = {
  identity: ["profile-header"],
  projects: ["profile-projects"],
  bio: ["profile-bio"],
  skills: ["profile-skills"],
  gallery: ["profile-gallery"],
  tools: ["profile-tools", "profile-experience"],
  links: ["profile-links"],
};

const MARKER_ORDER: SectionMarker[] = [
  "identity",
  "projects",
  "bio",
  "skills",
  "gallery",
  "tools",
  "links",
];

/** Classify a section by the first marker whose block type it contains. */
export function sectionMarker(section: LayoutSection): SectionMarker | null {
  for (const marker of MARKER_ORDER) {
    const types = MARKER_BLOCKS[marker];
    if (section.blocks.some((block) => types.includes(block.type))) return marker;
  }
  return null;
}

// ── Starters ──────────────────────────────────────────────────────────────────

export const STARTERS: Starter[] = [
  {
    id: "focused",
    name: "Focused",
    tagline: "One project at a time, front and centre.",
    feels:
      "A single column that reads top to bottom. Your current work fills the screen; everything else waits its turn.",
    config: {
      structure: "single",
      personality: "modern",
      density: "comfortable",
      radius: "soft",
      appBackground: "surface",
      publicBackground: "default",
    },
    presentation: "spotlight",
    sectionOrder: ["projects", "identity", "bio", "skills"],
    collapsedSections: [],
    sketch: [[12], [12], [7, 5], [12]],
  },
  {
    id: "editorial",
    name: "Editorial",
    tagline: "Reads like a printed feature.",
    feels: "Generous rhythm and a narrow measure. Projects become articles rather than cards.",
    config: {
      structure: "single",
      personality: "editorial",
      density: "spacious",
      radius: "sharp",
      appBackground: "default",
      publicBackground: "surface",
    },
    presentation: "editorial-grid",
    sectionOrder: ["identity", "projects", "bio", "skills", "gallery"],
    collapsedSections: [],
    sketch: [[12], [8, 4], [12], [6, 6]],
  },
  {
    id: "project-first",
    name: "Project-first",
    tagline: "Work above identity. Dense and technical.",
    feels: "The work opens the Studio. Compact rows, and every collaboration signal visible.",
    config: {
      structure: "wide",
      personality: "technical",
      density: "compact",
      radius: "sharp",
      appBackground: "sunken",
      publicBackground: "default",
    },
    presentation: "spotlight",
    sectionOrder: ["projects", "identity", "skills", "bio"],
    collapsedSections: [],
    sketch: [[12], [6, 6], [4, 4, 4], [12]],
  },
  {
    id: "minimal",
    name: "Minimal",
    tagline: "Name, work, a way to reach you.",
    feels:
      "Almost nothing. A list of projects and a line about what you want. Supporting sections stay, hidden, until you want them.",
    config: {
      structure: "single",
      personality: "modern",
      density: "spacious",
      radius: "sharp",
      appBackground: "default",
      publicBackground: "default",
    },
    presentation: "minimal-list",
    sectionOrder: ["identity", "projects", "bio", "links"],
    collapsedSections: ["tools", "gallery"],
    sketch: [[12], [12], [12], [12]],
  },
  {
    id: "experimental",
    name: "Experimental",
    tagline: "Uneven, wide, a little restless.",
    feels: "Asymmetric widths and a horizontal shelf. For work that does not sit still.",
    config: {
      structure: "wide",
      personality: "editorial",
      density: "compact",
      radius: "soft",
      appBackground: "sunken",
      publicBackground: "sunken",
    },
    presentation: "horizontal-scroll",
    sectionOrder: ["identity", "projects", "bio", "gallery"],
    collapsedSections: [],
    sketch: [[12], [5, 7], [3, 5, 4], [7, 5]],
  },
];

export const starterMap: Record<StarterId, Starter> = STARTERS.reduce(
  (acc, starter) => ({ ...acc, [starter.id]: starter }),
  {} as Record<StarterId, Starter>,
);

// ── Non-destructive application ────────────────────────────────────────────────

/**
 * Apply a starter to a live layout. Reorders the leading sections, hides (never
 * deletes) collapsed ones, and re-dresses the projects presentation. Every
 * block's id, config and content are preserved.
 */
export function applyStarter(layout: PageLayout, starter: Starter): PageLayout {
  // Order sections so markers named in `sectionOrder` lead (in that order),
  // then any remaining sections follow in their existing relative order.
  const byMarker = new Map<SectionMarker, LayoutSection[]>();
  for (const section of layout.sections) {
    const marker = sectionMarker(section);
    if (!marker) continue;
    const list = byMarker.get(marker) ?? [];
    list.push(section);
    byMarker.set(marker, list);
  }

  const orderedUnique = new Set<string>();
  const ordered: LayoutSection[] = [];
  const push = (section: LayoutSection) => {
    if (orderedUnique.has(section.id)) return;
    orderedUnique.add(section.id);
    ordered.push(section);
  };
  for (const marker of starter.sectionOrder) {
    for (const section of byMarker.get(marker) ?? []) push(section);
  }
  for (const section of layout.sections) push(section);

  const collapsed = new Set(starter.collapsedSections);

  return {
    sections: ordered.map((section, position) => {
      const marker = sectionMarker(section);
      const nextBlocks = section.blocks.map((block) =>
        block.type === "profile-projects"
          ? { ...block, config: { ...block.config, presentation: starter.presentation } }
          : block,
      );
      return {
        ...section,
        position,
        visible: marker ? !collapsed.has(marker) : section.visible,
        blocks: nextBlocks,
      };
    }),
  };
}

/** Merge a starter's configuration stamp into the current config. */
export function starterConfig(starter: Starter, current: StudioConfig): StudioConfig {
  return {
    ...current,
    ...starter.config,
    starterId: starter.id,
  };
}
