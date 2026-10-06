// ── Studio layouts ────────────────────────────────────────────────────────────
// Layout templates — "how is this page composed?". Each one is a composition
// (src/lib/layout-compose.ts): which content leads, what sits beside what, how
// wide each piece is, how the rest of the page keeps the rhythm, and how it
// stacks on a phone. Not a column count.
//
// A layout is a STARTING POINT and only ever changes composition: it moves the
// member's existing blocks into place (never deleting or duplicating one) and
// sets the page width. It never touches the look — theme, visual language,
// fonts, colours, surfaces and borders are the visual system's, so any layout
// pairs with any look ("Technical layout + Paper theme + Editorial type").
// Everything is one undo away.
//
// Sections carry no stable semantic ids, so areas are identified by the block
// types they contain (sectionMarker) — kept for community templates.

import type { StarterId, StructureId, StudioConfig } from "@/lib/studio-config";
import type { AreaAppearance, LayoutSection, PageLayout } from "@/lib/page-blocks";
import type { VisualLanguageId } from "@/lib/visual-language";
import { createBlockInstance } from "@/lib/block-registry";
import { composeLayout, type Composition } from "@/lib/layout-compose";
import { createDefaultProfileLayout } from "@/lib/default-layouts";

/** Semantic identity of a profile section, derived from the block types it holds. */
type SectionMarker =
  "identity" | "projects" | "bio" | "readme" | "skills" | "gallery" | "tools" | "links";

type ProfileProjectsPresentation =
  "spotlight" | "editorial-grid" | "horizontal-scroll" | "minimal-list";

/** How the picker groups layouts. */
export type LayoutFamily = "Editorial" | "Work-led" | "Structured" | "Expressive";

export interface Starter {
  id: StarterId;
  name: string;
  family: LayoutFamily;
  tagline: string;
  /** What the composition does, in a sentence or two. */
  feels: string;
  /** Who it's for — shared with community templates' remix descriptor. */
  remixNote: string;
  /** Page width. The only config a layout sets. */
  structure: StructureId;
  /** Applied to the profile-projects block. */
  presentation: ProfileProjectsPresentation;
  composition: Composition;
  /** A look it was drawn with — a suggestion shown in the picker, never applied. */
  pairsWith: VisualLanguageId;
  /** Areas this layout brings, added only when the page has none of their
   *  block types yet (never duplicated, never replacing content). */
  addsSections?: StarterAddedSection[];
}

export interface StarterAddedSection {
  title: string;
  /** Block types, in order. */
  blocks: string[];
  appearance?: AreaAppearance;
}

// ── Semantic markers (community templates) ──────────────────────────────────

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

// ── Layouts ───────────────────────────────────────────────────────────────────

const READING: AreaAppearance = { width: "reading" };

export const STARTERS: Starter[] = [
  {
    id: "editorial",
    name: "Editorial",
    family: "Editorial",
    tagline: "A feature story about your work.",
    feels:
      "A wide identity, an introduction set beside a pull quote, selected work at full width, then writing in a reading column.",
    remixNote: "For writers, designers and creative professionals whose thinking is the work.",
    structure: "wide",
    presentation: "editorial-grid",
    pairsWith: "editorial",
    composition: {
      areas: [
        { key: "identity", rows: [[{ role: "identity", w: 12 }]] },
        {
          key: "intro",
          title: "Introduction",
          rows: [
            [
              { role: "bio", w: 7 },
              { role: ["quote", "direction"], w: 5 },
            ],
          ],
        },
        { key: "work", title: "Selected work", rows: [[{ role: "projects", w: 12 }]] },
        {
          key: "writing",
          title: "Writing",
          rows: [[{ role: "readme", w: 12 }]],
          appearance: READING,
        },
        {
          key: "practice",
          title: "Practice",
          rows: [
            [
              { role: "experience", w: 6 },
              { role: "skills", w: 3 },
              { role: "tools", w: 3 },
            ],
          ],
        },
      ],
      rest: [6, 6],
    },
  },
  {
    id: "magazine",
    name: "Magazine",
    family: "Editorial",
    tagline: "A cover story and an issue's worth of features.",
    feels:
      "Your work leads beside a pull quote, then three short features side by side, then an uneven spread of images and writing.",
    remixNote: "For people with many threads — a practice with range.",
    structure: "wide",
    presentation: "editorial-grid",
    pairsWith: "editorial",
    composition: {
      areas: [
        { key: "identity", rows: [[{ role: "identity", w: 12 }]] },
        {
          key: "cover",
          title: "Cover story",
          rows: [
            [
              { role: "projects", w: 8 },
              { role: ["quote", "building"], w: 4 },
            ],
          ],
        },
        {
          key: "issue",
          title: "In this issue",
          rows: [
            [
              { role: "bio", w: 4 },
              { role: ["building", "direction"], w: 4 },
              { role: ["highlights", "achievements"], w: 4 },
            ],
          ],
        },
        {
          key: "spread",
          rows: [
            [
              { role: "gallery", w: 7 },
              { role: "readme", w: 5 },
            ],
          ],
        },
        {
          key: "practice",
          title: "Practice",
          rows: [
            [
              { role: "skills", w: 3 },
              { role: "tools", w: 3 },
              { role: "experience", w: 6 },
            ],
          ],
        },
      ],
      rest: [8, 4],
    },
  },
  {
    id: "journal",
    name: "Journal",
    family: "Editorial",
    tagline: "Long-form, chronological, few boxes.",
    feels:
      "One reading column: who you are, your story, your timeline, your writing, then the work as a quiet list.",
    remixNote: "For people whose path is the story — careers, practices, long projects.",
    structure: "single",
    presentation: "minimal-list",
    pairsWith: "personal",
    composition: {
      areas: [
        { key: "identity", rows: [[{ role: "identity", w: 12 }]] },
        { key: "story", rows: [[{ role: "bio", w: 12 }], [{ role: "quote", w: 12 }]] },
        { key: "path", title: "Path", rows: [[{ role: "experience", w: 12 }]] },
        { key: "writing", title: "Notes", rows: [[{ role: "readme", w: 12 }]] },
        { key: "work", title: "Work", rows: [[{ role: "projects", w: 12 }]] },
      ],
      rest: [12],
    },
  },
  {
    id: "portfolio",
    name: "Portfolio",
    family: "Work-led",
    tagline: "The work, big, first.",
    feels:
      "A full-width featured project, current work and proof beside each other, then images, then a short about with links.",
    remixNote: "For makers whose projects should open the conversation.",
    structure: "wide",
    presentation: "spotlight",
    pairsWith: "portfolio",
    composition: {
      areas: [
        { key: "identity", rows: [[{ role: "identity", w: 12 }]] },
        {
          key: "featured",
          title: "Featured work",
          rows: [
            [{ role: "projects", w: 12 }],
            [
              { role: "building", w: 7 },
              { role: "proof", w: 5 },
            ],
          ],
        },
        { key: "images", rows: [[{ role: "gallery", w: 12 }]] },
        {
          key: "about",
          title: "About",
          rows: [
            [
              { role: "bio", w: 8 },
              { role: ["links", "direction"], w: 4 },
            ],
          ],
        },
      ],
      rest: [4, 4, 4],
      phoneHalf: ["links", "tools"],
    },
  },
  {
    id: "gallery",
    name: "Gallery",
    family: "Work-led",
    tagline: "Images lead; words step back.",
    feels:
      "Edge-to-edge images straight after your name, work on a horizontal shelf, and a small caption-like note to close.",
    remixNote: "For illustrators, photographers and visual artists.",
    structure: "full",
    presentation: "horizontal-scroll",
    pairsWith: "minimal",
    composition: {
      areas: [
        { key: "identity", rows: [[{ role: "identity", w: 12 }]] },
        { key: "images", rows: [[{ role: "gallery", w: 12 }]] },
        { key: "work", title: "Work", rows: [[{ role: "projects", w: 12 }]] },
        {
          key: "note",
          rows: [
            [
              { role: "bio", w: 5 },
              { role: "links", w: 4 },
              { role: "direction", w: 3 },
            ],
          ],
        },
      ],
      rest: [7, 5],
      phoneHalf: ["links", "direction"],
    },
  },
  {
    id: "split",
    name: "Split",
    family: "Work-led",
    tagline: "Identity on one side, story on the other.",
    feels:
      "Your header and your introduction share the opening line, then the work runs full width, then images beside a quote.",
    remixNote: "For people with a strong visual identity and a short story.",
    structure: "wide",
    presentation: "editorial-grid",
    pairsWith: "personal",
    composition: {
      areas: [
        {
          key: "opening",
          rows: [
            [
              { role: "identity", w: 7 },
              { role: ["bio", "direction"], w: 5 },
            ],
          ],
        },
        { key: "work", title: "Work", rows: [[{ role: "projects", w: 12 }]] },
        {
          key: "images",
          rows: [
            [
              { role: "gallery", w: 7 },
              { role: ["quote", "readme"], w: 5 },
            ],
          ],
        },
        {
          key: "reach",
          rows: [
            [
              { role: ["direction", "links"], w: 6 },
              { role: "links", w: 6 },
            ],
          ],
        },
      ],
      rest: [6, 6],
    },
  },
  {
    id: "technical",
    name: "Technical",
    family: "Structured",
    tagline: "A precise grid of work, stack and signals.",
    feels:
      "Numbers first, then work beside what you're building, a three-part stack, and activity beside achievements.",
    remixNote: "For engineers and crews shipping in the open — signals over ceremony.",
    structure: "wide",
    presentation: "spotlight",
    pairsWith: "technical",
    composition: {
      areas: [
        { key: "identity", rows: [[{ role: "identity", w: 12 }]] },
        { key: "numbers", rows: [[{ role: "highlights", w: 12 }]] },
        {
          key: "work",
          title: "Work",
          rows: [
            [
              { role: "projects", w: 8 },
              { role: ["building", "proof"], w: 4 },
            ],
          ],
        },
        {
          key: "stack",
          title: "Stack",
          rows: [
            [
              { role: "skills", w: 4 },
              { role: "tools", w: 4 },
              { role: "experience", w: 4 },
            ],
          ],
        },
        {
          key: "signals",
          title: "Signals",
          rows: [
            [
              { role: "activity", w: 8 },
              { role: "achievements", w: 4 },
            ],
          ],
        },
        {
          key: "network",
          rows: [
            [
              { role: "network", w: 6 },
              { role: ["links", "direction"], w: 6 },
            ],
          ],
        },
      ],
      rest: [4, 4, 4],
      phoneHalf: ["tools", "links", "achievements"],
    },
  },
  {
    id: "archive",
    name: "Archive",
    family: "Structured",
    tagline: "Dense, chronological, catalogued.",
    feels:
      "A record: your timeline beside achievements, the work as a list, then a compact index of skills, tools and links.",
    remixNote: "For long careers and deep catalogues.",
    structure: "sidebar",
    presentation: "minimal-list",
    pairsWith: "technical",
    composition: {
      areas: [
        { key: "identity", rows: [[{ role: "identity", w: 12 }]] },
        {
          key: "record",
          title: "Record",
          rows: [
            [
              { role: "experience", w: 8 },
              { role: "achievements", w: 4 },
            ],
          ],
        },
        { key: "work", title: "Catalogue", rows: [[{ role: "projects", w: 12 }]] },
        {
          key: "index",
          title: "Index",
          rows: [
            [
              { role: "skills", w: 4 },
              { role: "tools", w: 4 },
              { role: "links", w: 4 },
            ],
          ],
        },
        { key: "notes", title: "Notes", rows: [[{ role: "readme", w: 12 }]] },
      ],
      rest: [4, 4, 4],
      phoneHalf: ["skills", "tools", "links"],
    },
  },
  {
    id: "linear",
    name: "Linear",
    family: "Structured",
    tagline: "One clear line, with the facts beside it.",
    feels:
      "Your story, experience and work run down one main line; skills, tools, availability and links sit in a narrow rail beside them.",
    remixNote: "For professional profiles that should read in thirty seconds.",
    structure: "wide",
    presentation: "minimal-list",
    pairsWith: "minimal",
    composition: {
      areas: [
        { key: "identity", rows: [[{ role: "identity", w: 12 }]] },
        {
          key: "line",
          rows: [
            [
              { role: "bio", w: 8 },
              { role: "direction", w: 4 },
            ],
            [
              { role: "experience", w: 8 },
              { role: "skills", w: 4 },
            ],
            [
              { role: "projects", w: 8 },
              { role: "tools", w: 4 },
            ],
            [
              { role: ["readme", "proof"], w: 8 },
              { role: ["links", "cta"], w: 4 },
            ],
          ],
        },
      ],
      rest: [8, 4],
      phoneHalf: ["tools", "links"],
    },
  },
  {
    id: "statement",
    name: "Statement",
    family: "Expressive",
    tagline: "A point of view, said big.",
    feels:
      "A large opening, one sentence you stand behind, the work, and a single next step. Everything else waits further down.",
    remixNote: "For people with a strong personal point of view.",
    structure: "sidebar",
    presentation: "spotlight",
    pairsWith: "experimental",
    composition: {
      areas: [
        { key: "identity", rows: [[{ role: "identity", w: 12 }]] },
        { key: "statement", rows: [[{ role: ["quote", "direction"], w: 12 }]] },
        { key: "work", rows: [[{ role: "projects", w: 12 }]] },
        { key: "next", rows: [[{ role: ["cta", "links"], w: 12 }]] },
      ],
      rest: [6, 6],
    },
  },
  {
    id: "collage",
    name: "Collage",
    family: "Expressive",
    tagline: "Uneven, layered, a little restless.",
    feels:
      "Alternating wide and narrow pieces — work beside a quote, images beside your story — so no two rows match.",
    remixNote: "For studios and collectors whose work refuses the grid.",
    structure: "full",
    presentation: "horizontal-scroll",
    pairsWith: "experimental",
    composition: {
      areas: [
        { key: "identity", rows: [[{ role: "identity", w: 12 }]] },
        {
          key: "one",
          rows: [
            [
              { role: "projects", w: 7 },
              { role: ["quote", "direction"], w: 5 },
            ],
          ],
        },
        {
          key: "two",
          rows: [
            [
              { role: "gallery", w: 5 },
              { role: "bio", w: 7 },
            ],
          ],
        },
        {
          key: "three",
          rows: [
            [
              { role: ["building", "proof"], w: 4 },
              { role: ["highlights", "readme"], w: 8 },
            ],
          ],
        },
      ],
      rest: [5, 7],
    },
  },
  {
    id: "open",
    name: "Open canvas",
    family: "Expressive",
    tagline: "Room around everything.",
    feels:
      "Pieces placed rather than stacked: an off-centre introduction, the work set in from the edge, wide pauses between.",
    remixNote: "For people who want space to do the talking.",
    structure: "wide",
    presentation: "editorial-grid",
    pairsWith: "minimal",
    composition: {
      areas: [
        { key: "identity", rows: [[{ role: "identity", w: 12 }]] },
        {
          key: "intro",
          rows: [[{ role: ["bio", "quote"], w: 7, x: 4 }]],
          appearance: { spacing: "loose" },
        },
        {
          key: "work",
          rows: [[{ role: "projects", w: 10, x: 0 }]],
          appearance: { spacing: "loose" },
        },
        {
          key: "aside",
          rows: [[{ role: ["quote", "direction", "readme"], w: 6, x: 6 }]],
          appearance: { spacing: "loose" },
        },
        { key: "images", rows: [[{ role: "gallery", w: 12 }]], appearance: { spacing: "loose" } },
      ],
      rest: [6, 6],
    },
  },
  {
    id: "for-hire",
    name: "For hire",
    family: "Work-led",
    tagline: "What you do, the proof, and how to start.",
    feels:
      "Leads with your numbers and what you offer, backs it with work and a testimonial, and ends on one clear next step.",
    remixNote: "For freelancers and consultants who want visitors to get in touch.",
    structure: "sidebar",
    presentation: "editorial-grid",
    pairsWith: "personal",
    composition: {
      areas: [
        { key: "identity", rows: [[{ role: "identity", w: 12 }]] },
        { key: "numbers", rows: [[{ role: "highlights", w: 12 }]] },
        { key: "work", title: "Work", rows: [[{ role: "projects", w: 12 }]] },
        {
          key: "offer",
          title: "What I offer",
          rows: [
            [
              { role: "services", w: 7 },
              { role: "quote", w: 5 },
            ],
          ],
        },
        {
          key: "about",
          title: "About",
          rows: [
            [
              { role: "bio", w: 7 },
              { role: "skills", w: 5 },
            ],
          ],
        },
        { key: "next", rows: [[{ role: "cta", w: 12 }]], appearance: { background: "accent" } },
      ],
      rest: [6, 6],
    },
    addsSections: [
      { title: "", blocks: ["highlights"] },
      { title: "What I offer", blocks: ["services", "quote"] },
      { title: "", blocks: ["call-to-action"], appearance: { background: "accent" } },
    ],
  },
];

/** Titles the member never typed: every layout's own area titles and the
 *  default page's. An area carrying one takes the next layout's title. */
const GENERATED_TITLES: ReadonlySet<string> = new Set(
  [
    ...STARTERS.flatMap((starter) => starter.composition.areas.map((area) => area.title ?? "")),
    ...createDefaultProfileLayout().sections.map((section) => section.title ?? ""),
  ]
    .filter(Boolean)
    .map((title) => title.toLowerCase()),
);

export const starterMap: Record<StarterId, Starter> = STARTERS.reduce(
  (acc, starter) => ({ ...acc, [starter.id]: starter }),
  {} as Record<StarterId, Starter>,
);

/** Families in picker order. */
export const LAYOUT_FAMILIES: LayoutFamily[] = [
  "Editorial",
  "Work-led",
  "Structured",
  "Expressive",
];

// ── Non-destructive application ────────────────────────────────────────────────

/**
 * Compose a live layout with a layout template: the template's additions
 * (only those whose blocks the page doesn't have yet), then every block moved
 * into the composition, then the projects presentation. Block ids, content and
 * visibility are preserved; nothing is deleted.
 *
 * `_previouslyApplied` is accepted for callers from before compositions; a
 * composition owns placement outright, so the previous layout doesn't matter.
 */
export function applyStarter(
  layout: PageLayout,
  starter: Starter,
  _previouslyApplied?: Starter | null,
): PageLayout {
  const withAdditions = addStarterSections(layout, starter.id, starter.addsSections ?? []);
  const composed = composeLayout(withAdditions, starter.composition, {
    generatedTitles: GENERATED_TITLES,
  });
  return {
    sections: composed.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((block) =>
        block.type === "profile-projects"
          ? { ...block, config: { ...block.config, presentation: starter.presentation } }
          : block,
      ),
    })),
  };
}

/** Add a layout's new areas, skipping any whose blocks already exist. */
function addStarterSections(
  layout: PageLayout,
  starterId: StarterId,
  additions: StarterAddedSection[],
): PageLayout {
  if (additions.length === 0) return layout;
  const sections = [...layout.sections];
  const present = new Set(sections.flatMap((s) => s.blocks.map((b) => b.type)));
  additions.forEach((addition, index) => {
    if (addition.blocks.some((type) => present.has(type))) return;
    const blocks = addition.blocks
      .map((type) => createBlockInstance(type))
      .filter((created): created is NonNullable<typeof created> => !!created)
      .map((created, position) => ({
        // Deterministic ids: applying a layout twice gives identical JSON, and
        // a second application never adds these again (their types exist).
        id: `block-${starterId}-${index}-${created.type}`,
        type: created.type,
        position,
        config: created.config,
        visible: true,
      }));
    if (blocks.length === 0) return;
    sections.push({
      id: `section-${starterId}-${index}`,
      position: sections.length,
      title: addition.title,
      layout: "full",
      visible: true,
      blocks,
      appearance: addition.appearance,
    });
    for (const block of blocks) present.add(block.type);
  });
  return { sections };
}

/** A layout sets the page width and records itself; the look is untouched. */
export function starterConfig(starter: Starter, current: StudioConfig): StudioConfig {
  return { ...current, structure: starter.structure, starterId: starter.id };
}

/** The config a layout preview renders with: the member's own look, at the
 *  layout's width — so the preview shows this layout in *their* style. */
export function starterPreviewConfig(starter: Starter, current: StudioConfig): StudioConfig {
  return starterConfig(starter, current);
}

/**
 * The StudioConfig stamp a community template applies. Templates carry no
 * config of their own (the layouts table is structure + theme only), so the
 * member's current config is preserved — only the sections change.
 */
export function templatePreviewConfig(current: StudioConfig): StudioConfig {
  return { ...current, starterId: null };
}

/** A tiny wireframe of the composition's opening rows (picker fallback). */
export function starterSketch(starter: Starter): number[][] {
  return starter.composition.areas
    .flatMap((area) => area.rows.map((row) => row.map((slot) => slot.w)))
    .slice(0, 5);
}
