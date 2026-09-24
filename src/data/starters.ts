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
  StarterId,
  StructureId,
  StudioConfig,
} from "@/lib/studio-config";
import { DEFAULT_STUDIO_CONFIG } from "@/lib/studio-config";
import type { LayoutSection, PageLayout, SectionLayoutType } from "@/lib/page-blocks";

/** Semantic identity of a profile section, derived from the block types it holds. */
type SectionMarker =
  "identity" | "projects" | "bio" | "readme" | "skills" | "gallery" | "tools" | "links";

type ProfileProjectsPresentation =
  "spotlight" | "editorial-grid" | "horizontal-scroll" | "minimal-list";

interface StarterConfigStamp {
  structure: StructureId;
  personality: PersonalityId;
  density: DensityId;
  radius: number;
  appBackground: BackgroundId;
  publicBackground: BackgroundId;
}

export interface Starter {
  id: StarterId;
  name: string;
  tagline: string;
  feels: string;
  /** Who this direction is for, in one line — the remix-descriptor layer
   *  shared with community templates so both read as one system. */
  remixNote: string;
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
  readme: ["profile-readme"],
  skills: ["profile-skills"],
  gallery: ["profile-gallery"],
  tools: ["profile-tools", "profile-experience"],
  links: ["profile-links"],
};

const MARKER_ORDER: SectionMarker[] = [
  "identity",
  "projects",
  "bio",
  "readme",
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
    remixNote: "For makers deep in one build who want the work to open the conversation.",
    config: {
      structure: "single",
      personality: "modern",
      density: "comfortable",
      radius: 12,
      appBackground: "surface",
      publicBackground: "default",
    },
    presentation: "spotlight",
    sectionOrder: ["projects", "identity", "bio", "readme", "skills"],
    collapsedSections: [],
    sketch: [[12], [12], [7, 5], [12]],
  },
  {
    id: "editorial",
    name: "Editorial",
    tagline: "Reads like a printed feature.",
    feels: "Generous rhythm and a narrow measure. Projects become articles rather than cards.",
    remixNote: "For writers and designers whose work is the prose — work that reads, not scans.",
    config: {
      structure: "single",
      personality: "editorial",
      density: "spacious",
      radius: 6,
      appBackground: "default",
      publicBackground: "surface",
    },
    presentation: "editorial-grid",
    sectionOrder: ["identity", "projects", "bio", "readme", "skills", "gallery"],
    collapsedSections: [],
    sketch: [[12], [8, 4], [12], [6, 6]],
  },
  {
    id: "project-first",
    name: "Project-first",
    tagline: "Work above identity. Dense and technical.",
    feels: "The work opens the Studio. Compact rows, and every collaboration signal visible.",
    remixNote: "For engineers and crews shipping in the open — signals over ceremony.",
    config: {
      structure: "wide",
      personality: "technical",
      density: "compact",
      radius: 6,
      appBackground: "sunken",
      publicBackground: "default",
    },
    presentation: "spotlight",
    sectionOrder: ["projects", "identity", "skills", "bio", "readme"],
    collapsedSections: [],
    sketch: [[12], [6, 6], [4, 4, 4], [12]],
  },
  {
    id: "minimal",
    name: "Minimal",
    tagline: "Name, work, a way to reach you.",
    feels:
      "Almost nothing. A list of projects and a line about what you want. Supporting sections stay, hidden, until you want them.",
    remixNote: "For quiet presence — a card you'd hand someone instead of a résumé.",
    config: {
      structure: "single",
      personality: "modern",
      density: "spacious",
      radius: 6,
      appBackground: "default",
      publicBackground: "default",
    },
    presentation: "minimal-list",
    sectionOrder: ["identity", "projects", "bio", "readme", "links"],
    collapsedSections: ["tools", "gallery"],
    sketch: [[12], [12], [12], [12]],
  },
  {
    id: "experimental",
    name: "Experimental",
    tagline: "Uneven, wide, a little restless.",
    feels: "Asymmetric widths and a horizontal shelf. For work that does not sit still.",
    remixNote: "For studios and collectors whose work refuses the grid.",
    config: {
      structure: "wide",
      personality: "editorial",
      density: "compact",
      radius: 12,
      appBackground: "sunken",
      publicBackground: "sunken",
    },
    presentation: "horizontal-scroll",
    sectionOrder: ["identity", "projects", "bio", "readme", "gallery"],
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
 *
 * `previouslyApplied` (the starter already recorded on the Studio config, if
 * any) matters when switching templates: sections hidden by the previous
 * starter must be revealed again before the new one decides what stays hidden,
 * otherwise they remain invisible no matter which template the creator picks
 * next.
 */
export function applyStarter(
  layout: PageLayout,
  starter: Starter,
  previouslyApplied?: Starter | null,
): PageLayout {
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
  const previouslyHidden = new Set(previouslyApplied?.collapsedSections ?? []);

  return {
    sections: ordered.map((section, position) => {
      const marker = sectionMarker(section);
      const nextBlocks = section.blocks.map((block) =>
        block.type === "profile-projects"
          ? { ...block, config: { ...block.config, presentation: starter.presentation } }
          : block,
      );
      // Sections the previous starter hid come back when switching, unless the
      // new starter hides them too. Sections hidden manually by the creator
      // (no previous starter, or a marker no starter owns) keep their state.
      const hiddenByPreviousStarter =
        previouslyApplied != null && marker != null && previouslyHidden.has(marker);
      const visible =
        marker == null
          ? section.visible
          : hiddenByPreviousStarter
            ? !collapsed.has(marker)
            : (section.visible ?? true) && !collapsed.has(marker);
      return {
        ...section,
        position,
        visible,
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

// ── Live preview layout ────────────────────────────────────────────────────────

const PREVIEW_TITLES: Partial<Record<SectionMarker, string>> = {
  projects: "Work",
  bio: "About",
  readme: "README",
  skills: "Skills",
  gallery: "Gallery",
  tools: "Tools",
  links: "Links",
};

const PREVIEW_LAYOUTS: Partial<Record<SectionMarker, SectionLayoutType>> = {
  projects: "feature",
  tools: "two_column",
};

/**
 * Build a small representative layout for a starter, used to render a live
 * preview of what applying it would look like. Blocks are built from the
 * starter's semantic markers with empty configs (blocks self-default), so the
 * member's own data renders inside the real block components.
 */
export function starterPreviewLayout(starter: Starter): PageLayout {
  const collapsed = new Set(starter.collapsedSections);
  return {
    sections: starter.sectionOrder.map((marker, index) => ({
      id: `preview:${marker}`,
      position: index,
      title: PREVIEW_TITLES[marker],
      layout: PREVIEW_LAYOUTS[marker] ?? "full",
      visible: !collapsed.has(marker),
      blocks: MARKER_BLOCKS[marker].map((type, blockIndex) => ({
        id: `preview:${marker}:${type}`,
        type,
        position: blockIndex,
        visible: !collapsed.has(marker),
        config: type === "profile-projects" ? { presentation: starter.presentation } : {},
      })),
    })),
  };
}

// ── Preview surface dressing ───────────────────────────────────────────────────

/**
 * The StudioConfig stamp a starter would set, merged over the defaults. Used
 * by the picker to render each preview in its starter's real surface
 * treatment — fonts, density, radius, backgrounds — instead of a generic
 * canvas, so previews actually differ the way applying them would differ.
 */
export function starterPreviewConfig(starter: Starter): StudioConfig {
  return {
    ...DEFAULT_STUDIO_CONFIG,
    ...starter.config,
    starterId: starter.id,
  };
}

/**
 * The StudioConfig stamp a community template applies. Templates carry no
 * config of their own (the layouts table is structure + theme only), so the
 * member's current config is preserved — only the sections change. Kept as a
 * sibling of {@link starterPreviewConfig} so the picker can treat both layers
 * with one code path.
 */
export function templatePreviewConfig(current: StudioConfig): StudioConfig {
  return { ...current, starterId: null };
}
