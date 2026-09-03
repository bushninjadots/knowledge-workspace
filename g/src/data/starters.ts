import type {
  BlockType,
  PageLayout,
  ProjectPresentation,
  StarterId,
  StudioConfig } from
'../types/studio';
import { reflowSection, reorderSections } from '../utils/layout';

/**
 * Starting directions — "choose how you want your Studio to feel".
 *
 * A starter is a STARTING POINT, never a destructive replacement: it changes
 * personality, structure, section order and block widths, but every block
 * instance and every piece of content survives. Hidden sections are hidden,
 * not deleted, and the whole thing is one undo away.
 */
export interface Starter {
  id: StarterId;
  name: string;
  tagline: string;
  feels: string;
  config: Omit<StudioConfig, 'starterId' | 'accentColor' | 'accentMode'>;
  sectionOrder: string[];
  collapsedSections: string[];
  widths: Partial<Record<BlockType, number>>;
  heights: Partial<Record<BlockType, number>>;
  presentation: ProjectPresentation;
  /** Preview glyph: relative block weights, rendered as a tiny wireframe. */
  sketch: number[][];
}

export const starters: Starter[] = [
{
  id: 'focused',
  name: 'Focused',
  tagline: 'One project at a time, front and centre.',
  feels: 'A single column that reads top to bottom. Your current work fills the screen; everything else waits its turn.',
  config: { structure: 'single', personality: 'modern', density: 'comfortable', radius: 'soft', appBackground: 'surface', publicBackground: 'default' },
  sectionOrder: ['sec-identity', 'sec-building', 'sec-contributing', 'sec-created', 'sec-signals', 'sec-practice'],
  collapsedSections: [],
  widths: {
    'profile-header': 12,
    'profile-bio': 12,
    'profile-direction': 12,
    'profile-projects': 12,
    'profile-needs': 12,
    'profile-credits': 12,
    'profile-activity': 12,
    'profile-skills': 6,
    'profile-tools': 6,
    'profile-links': 12
  },
  heights: { 'profile-projects': 12, 'profile-bio': 4, 'profile-direction': 5 },
  presentation: 'spotlight',
  sketch: [[12], [12], [7, 5], [12]]
},
{
  id: 'editorial',
  name: 'Editorial',
  tagline: 'Reads like a printed feature.',
  feels: 'Space Grotesk headings, generous rhythm and a narrow measure. Projects become articles rather than cards.',
  config: { structure: 'single', personality: 'editorial', density: 'spacious', radius: 'sharp', appBackground: 'default', publicBackground: 'surface' },
  sectionOrder: ['sec-identity', 'sec-building', 'sec-created', 'sec-contributing', 'sec-signals', 'sec-practice'],
  collapsedSections: [],
  widths: {
    'profile-header': 12,
    'profile-bio': 8,
    'profile-direction': 4,
    'profile-projects': 12,
    'profile-needs': 12,
    'profile-credits': 8,
    'profile-activity': 4,
    'profile-skills': 12,
    'profile-tools': 6,
    'profile-links': 6
  },
  heights: { 'profile-projects': 11, 'profile-bio': 6 },
  presentation: 'editorial-grid',
  sketch: [[12], [8, 4], [12], [6, 6]]
},
{
  id: 'project-first',
  name: 'Project-first',
  tagline: 'Work above identity. Dense and technical.',
  feels: 'The project spine opens the Studio. Monospace labels, compact rows, and every collaboration signal visible.',
  config: { structure: 'wide', personality: 'technical', density: 'compact', radius: 'sharp', appBackground: 'sunken', publicBackground: 'default' },
  sectionOrder: ['sec-building', 'sec-identity', 'sec-contributing', 'sec-created', 'sec-practice', 'sec-signals'],
  collapsedSections: [],
  widths: {
    'profile-header': 12,
    'profile-bio': 6,
    'profile-direction': 6,
    'profile-projects': 12,
    'profile-needs': 5,
    'profile-credits': 6,
    'profile-activity': 6,
    'profile-skills': 4,
    'profile-tools': 4,
    'profile-links': 4
  },
  heights: { 'profile-projects': 12, 'profile-header': 6 },
  presentation: 'spotlight',
  sketch: [[12], [6, 6], [4, 4, 4], [12]]
},
{
  id: 'minimal',
  name: 'Minimal',
  tagline: 'Name, work, a way to reach you.',
  feels: 'Almost nothing. A list of projects and a line about what you want. Signals and practice sections stay, hidden, until you want them.',
  config: { structure: 'single', personality: 'modern', density: 'spacious', radius: 'sharp', appBackground: 'default', publicBackground: 'default' },
  sectionOrder: ['sec-identity', 'sec-building', 'sec-contributing', 'sec-created', 'sec-practice', 'sec-signals'],
  collapsedSections: ['sec-practice', 'sec-signals'],
  widths: {
    'profile-header': 12,
    'profile-bio': 12,
    'profile-direction': 12,
    'profile-projects': 12,
    'profile-needs': 12,
    'profile-credits': 12,
    'profile-activity': 12,
    'profile-skills': 12,
    'profile-tools': 12,
    'profile-links': 12
  },
  heights: { 'profile-projects': 8, 'profile-header': 6, 'profile-bio': 4 },
  presentation: 'minimal-list',
  sketch: [[12], [12], [12], [12]]
},
{
  id: 'experimental',
  name: 'Experimental',
  tagline: 'Uneven, wide, a little restless.',
  feels: 'Asymmetric widths and a horizontal shelf. For people whose work does not sit still.',
  config: { structure: 'wide', personality: 'editorial', density: 'compact', radius: 'soft', appBackground: 'sunken', publicBackground: 'sunken' },
  sectionOrder: ['sec-identity', 'sec-building', 'sec-created', 'sec-contributing', 'sec-practice', 'sec-signals'],
  collapsedSections: [],
  widths: {
    'profile-header': 12,
    'profile-bio': 5,
    'profile-direction': 7,
    'profile-projects': 12,
    'profile-needs': 4,
    'profile-credits': 5,
    'profile-activity': 7,
    'profile-skills': 3,
    'profile-tools': 5,
    'profile-links': 4
  },
  heights: { 'profile-projects': 10, 'profile-bio': 5 },
  presentation: 'horizontal-scroll',
  sketch: [[12], [5, 7], [3, 5, 4], [7, 5]]
}];


export const starterMap: Record<StarterId, Starter> = starters.reduce(
  (acc, s) => ({ ...acc, [s.id]: s }),
  {} as Record<StarterId, Starter>
);

/** Non-destructive: reorders, resizes and re-presents. Never removes content. */
export function applyStarter(layout: PageLayout, starter: Starter): PageLayout {
  const reordered = reorderSections(layout, starter.sectionOrder);
  return {
    sections: reordered.sections.map((section) => {
      const withPresentation = {
        ...section,
        visible: !starter.collapsedSections.includes(section.id),
        blocks: section.blocks.map((block) =>
        block.type === 'profile-projects' ?
        { ...block, props: { ...block.props, presentation: starter.presentation } } :
        block
        )
      };
      return reflowSection(withPresentation, starter.widths, starter.heights);
    })
  };
}

export function starterConfig(starter: Starter, current: StudioConfig): StudioConfig {
  return {
    ...current,
    ...starter.config,
    starterId: starter.id
  };
}