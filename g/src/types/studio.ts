/**
 * Studio persistence + editing types.
 *
 * Preserves the existing shape of `pages`, `layouts.sections`, `themes` and
 * `studio-config`, but collapses the six competing configuration systems
 * (composition / vibe / appearance / theme / section layout / block spans)
 * into one coherent model: STRUCTURE · PERSONALITY · ACCENT · BACKGROUND · CONTENT.
 */

export type StudioMode = 'view' | 'edit' | 'preview';
export type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

/** STRUCTURE — how the Studio is arranged. */
export type StructureId = 'single' | 'sidebar' | 'wide';
/** PERSONALITY — typography + visual character. */
export type PersonalityId = 'editorial' | 'modern' | 'technical';
export type DensityId = 'compact' | 'comfortable' | 'spacious';
export type RadiusId = 'sharp' | 'soft';
/** ACCENT — user identity colour. */
export type AccentMode = 'auto' | 'custom' | 'none';
/** BACKGROUND — app shell vs public Studio. */
export type BackgroundId = 'default' | 'surface' | 'sunken';

export type StarterId = 'focused' | 'editorial' | 'project-first' | 'minimal' | 'experimental';

export interface StudioConfig {
  starterId: StarterId | null;
  structure: StructureId;
  personality: PersonalityId;
  density: DensityId;
  radius: RadiusId;
  accentMode: AccentMode;
  /** Used when accentMode === 'custom'; 'auto' derives from the banner. */
  accentColor: string;
  appBackground: BackgroundId;
  publicBackground: BackgroundId;
}

export type BlockType =
'profile-header' |
'profile-bio' |
'profile-direction' |
'profile-projects' |
'profile-needs' |
'profile-credits' |
'profile-activity' |
'profile-skills' |
'profile-tools' |
'profile-links' |
'profile-achievements' |
'profile-gallery' |
'content-heading' |
'content-text' |
'content-divider';

export type ProjectPresentation = 'spotlight' | 'editorial-grid' | 'minimal-list' | 'horizontal-scroll';
export type ProjectFilter = 'building' | 'contributing' | 'created' | 'all';

export interface BlockProps {
  /** content-heading / content-text / any block override label */
  text?: string;
  /** profile-projects */
  presentation?: ProjectPresentation;
  filter?: ProjectFilter;
  limit?: number;
  showSignals?: boolean;
  /** shared */
  title?: string;
}

export interface BlockInstance {
  id: string;
  type: BlockType;
  visible: boolean;
  props: BlockProps;
}

/** react-grid-layout item — the single source of truth for size + position. */
export interface GridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  static?: boolean;
}

export interface LayoutSection {
  id: string;
  title: string;
  /** `spine` sections carry projects and are visually weighted. */
  kind: 'spine' | 'standard';
  visible: boolean;
  blocks: BlockInstance[];
  grid: GridItem[];
}

export interface PageLayout {
  sections: LayoutSection[];
}

export type PageStatus = 'draft' | 'published';

export interface StudioSnapshot {
  layout: PageLayout;
  config: StudioConfig;
}

export interface StudioVersion {
  version: number;
  label: string;
  publishedAt: string;
  snapshot: StudioSnapshot;
}

export interface PageData {
  id: string;
  ownerId: string;
  ownerType: 'profile' | 'project';
  status: PageStatus;
  layout: PageLayout;
  config: StudioConfig;
  publishedVersion: number | null;
  versions: StudioVersion[];
}

export type BlockCategory = 'identity' | 'projects' | 'signals' | 'content';

export interface BlockDefinition {
  type: BlockType;
  label: string;
  category: BlockCategory;
  description: string;
  /** Default grid footprint at 12 columns. */
  defaultW: number;
  defaultH: number;
  minW: number;
  minH: number;
  /** Blocks that only make sense once. */
  singleton?: boolean;
}