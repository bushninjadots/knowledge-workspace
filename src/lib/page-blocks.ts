// ── Block System Types ───────────────────────────────────────────────────────
// Core type definitions for the block/page/layout/theme architecture.
// These are the shared contracts that the registry, renderer, hooks, and
// database schema all agree on.

import type { StudioConfig } from "@/lib/studio-config";

// ---------------------------------------------------------------------------
// Block Types
// ---------------------------------------------------------------------------

/** Unique key identifying a registered block type, e.g. "text", "roadmap". */
export type BlockType = string;

/** Category groups for the block picker and library browsing. */
export type BlockCategory = "content" | "media" | "project" | "people" | "community" | "utility";

// ---------------------------------------------------------------------------
// Block Configuration
// ---------------------------------------------------------------------------

/**
 * A block instance's runtime configuration. The shape depends on the block
 * type and is validated against a schema at registration time.
 */
export type BlockConfig = Record<string, unknown>;

/** Context the renderer passes to every block. */
export interface BlockContext {
  /** The page owner's user ID (profile owner or project owner). */
  ownerId: string;
  /** Optional already-loaded owner data, used by previews to avoid duplicate loading states. */
  data?: Record<string, unknown>;
  /** Either "profile" or "project". */
  ownerType: "profile" | "project";
  /** The page ID, useful for data hooks that scope to the page owner. */
  pageId: string;
  /** The block instance ID, used for data attributes and targeting. */
  blockId?: string;
  /** Whether the block is currently in edit mode (shows handles, config UI). */
  isEditing: boolean;
  /** Whether the current viewer owns this page (enables in-place editing affordances). */
  isOwner?: boolean;
  /** Optional translucent surface treatment for profile pages. */
  translucent?: boolean;
  /** Optional profile-header completion action supplied by the profile route. */
  profileCompleteness?: number;
  onCompleteProfile?: () => void;
}

/** Props every block component must accept. */
export interface BlockProps {
  /** The block instance's configuration values. */
  config: BlockConfig;
  /** Callback when the config changes (editor only). */
  onChange?: (config: BlockConfig) => void;
  /** Runtime context including owner, page, and edit state. */
  context: BlockContext;
}

// ---------------------------------------------------------------------------
// Block Definition (Registry Entry)
// ---------------------------------------------------------------------------

/**
 * Every block registers a definition so the system can discover, validate,
 * and render it without a hard-coded switch statement.
 */
export interface BlockDefinition {
  /** Unique type key, e.g. "text", "heading", "roadmap". */
  type: BlockType;
  /** Category for the block picker. */
  category: BlockCategory;
  /** Human-readable label. */
  label: string;
  /** Short description shown in the block picker. */
  description: string;
  /** Lucide icon name for the block picker. Must match a key from lucide-react. */
  icon: string;
  /** Default config used when the block is first added. */
  defaults: BlockConfig;
  /** Whether the block expects to control its own container (e.g. full-width hero). */
  containerless?: boolean;
  /**
   * Editable fields exposed in the Studio inspector.
   * Each entry generates a form control in the block inspector panel.
   * If omitted, the inspector shows only the width + actions controls.
   */
  fields?: BlockField[];
  /** The React component that renders this block. */
  component: React.ComponentType<BlockProps>;
}

/** Describes a single editable field for a block in the Studio inspector. */
export interface BlockField {
  /** Config key this field reads/writes. */
  key: string;
  /** Human-readable label shown in the inspector. */
  label: string;
  /** The type of form control to render. */
  type: "text" | "textarea" | "toggle" | "select" | "image" | "color";
  /** Placeholder text for text/textarea inputs. */
  placeholder?: string;
  /** Options for select-type fields. */
  options?: Array<{ label: string; value: string }>;
}

// ---------------------------------------------------------------------------
// Layout Types
// ---------------------------------------------------------------------------

export type LayoutType =
  | "standard"
  | "minimal"
  | "full_width"
  | "centered"
  | "sidebar"
  | "documentation"
  | "portfolio"
  | "magazine"
  | "dashboard"
  | "landing_page"
  | "custom";

export type SectionLayoutType =
  | "full"
  | "two_column"
  | "three_column"
  | "sidebar_left"
  | "sidebar_right"
  | "feature"
  | "side_by_side"
  | "featured_work"
  | "asymmetric"
  | "split"
  | "image_lead"
  | "compact_list";

/** A responsive freeform frame. Coordinates are normalized to a 12-column canvas. */
interface LayoutFrame {
  x: number;
  y: number;
  width: number;
  height?: number;
}

/** Optional per-device freeform placement. Older layouts omit this field. */
interface ResponsiveFrames {
  desktop?: LayoutFrame;
  tablet?: LayoutFrame;
  mobile?: LayoutFrame;
}

/** A single block instance within a layout section. */
export interface LayoutBlockInstance {
  /** Stable id for this block instance within the page. */
  id: string;
  /** Registered block type key. */
  type: BlockType;
  /** Position within the section (0-based). */
  position: number;
  /** The block's runtime configuration. */
  config: BlockConfig;
  /** Whether the block is visible (can be toggled without deleting). */
  visible: boolean;
  /**
   * Column assignment within a multi-column section.
   * -1 or undefined = auto-flow (default). 0 = first column, 1 = second, etc.
   * Only meaningful when the section layout is two_column, three_column, etc.
   */
  column?: number;
  /**
   * How many columns this block spans. Default 1.
   * E.g. span 2 in a two_column section = full width.
   */
  span?: number;
  /** Optional responsive freeform placement; omitted means legacy flow layout. */
  frames?: ResponsiveFrames;
  /** When true, the block uses absolute freeform placement in its section canvas. */
  freeform?: boolean;
}

/** A section groups blocks into a column arrangement. */
export interface LayoutSection {
  /** Stable id for this section. */
  id: string;
  /** Position within the layout (0-based). */
  position: number;
  /** Column arrangement for this section. */
  layout: SectionLayoutType;
  /** Blocks within this section, ordered by position. */
  blocks: LayoutBlockInstance[];
  /** Legacy page-level placement retained for backwards-compatible data reads. */
  gridRow?: number;
  /** Legacy page-level placement retained for backwards-compatible data reads. */
  gridColumn?: number;
  /** Optional responsive freeform placement; omitted means legacy flow layout. */
  frames?: ResponsiveFrames;
  /** When true, the section uses freeform placement in the page canvas. */
  freeform?: boolean;
}

/** A complete page layout: an ordered list of sections. */
export interface PageLayout {
  /** Ordered sections. */
  sections: LayoutSection[];
}

// ---------------------------------------------------------------------------
// Theme Types
// ---------------------------------------------------------------------------

/** A theme is a named collection of design tokens stored as JSONB. */
export interface ThemeTokens {
  colors?: {
    background?: string;
    foreground?: string;
    muted?: string;
    accent?: string;
    surface?: string;
    "surface-elevated"?: string;
    "surface-sunken"?: string;
    card?: string;
    "card-foreground"?: string;
    primary?: string;
    "primary-foreground"?: string;
    secondary?: string;
    "secondary-foreground"?: string;
    border?: string;
    "border-strong"?: string;
    input?: string;
    ring?: string;
    trust?: string;
    learning?: string;
    teaching?: string;
    ai?: string;
    warning?: string;
    [key: string]: string | undefined;
  };
  typography?: {
    headingFont?: string;
    bodyFont?: string;
    monoFont?: string;
    scale?: Record<string, { fontSize: string; lineHeight: string; fontWeight?: string }>;
  };
  spacing?: Record<string, string>;
  borders?: {
    radius?: Record<string, string>;
    style?: string;
  };
  shadows?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Page Types
// ---------------------------------------------------------------------------

export type PageOwnerType = "profile" | "project";
export type PageStatus = "draft" | "published";

/** Row from the `pages` table (joined with layout + theme). */
export interface PageData {
  id: string;
  ownerId: string;
  ownerType: PageOwnerType;
  layoutId: string;
  themeId: string;
  status: PageStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Joined layout data. */
  layout: PageLayout;
  /** Joined theme tokens. */
  theme: ThemeTokens | null;
  /** Raw persisted theme override deltas (unmerged), or null if none. */
  themeOverrides: ThemeTokens | null;
  /** Normalized StudioConfig (radius/typography/density/accent/personality). */
  config: StudioConfig;
}

// ---------------------------------------------------------------------------
// Registry Types
// ---------------------------------------------------------------------------

/** The block registry is a Map<BlockType, BlockDefinition>. */
export type BlockRegistry = Map<BlockType, BlockDefinition>;

// ---------------------------------------------------------------------------
// Template Types
// ---------------------------------------------------------------------------

/** A template is a layout that has been marked as reusable by its creator. */
export interface TemplateData {
  id: string;
  name: string;
  description: string | null;
  type: LayoutType;
  category: string | null;
  sections: LayoutSection[];
  /** The theme tokens bundled with this template (null = default). */
  themeTokens: ThemeTokens | null;
  /** The theme ID for this template. */
  themeId: string | null;
  /** Creator profile info — joined from layouts.created_by → profiles. */
  createdBy: string | null;
  creatorHandle: string | null;
  creatorDisplayName: string | null;
  usageCount: number;
  forkCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Categories for browsing templates in the library. */
export type TemplateCategory =
  | "minimal"
  | "developer"
  | "portfolio"
  | "documentation"
  | "startup"
  | "community"
  | "creative"
  | "experimental";

// ---------------------------------------------------------------------------
// Fork / Remix Types
// ---------------------------------------------------------------------------

/** A lineage node returned by get_layout_lineage. */
export interface LineageNode {
  layoutId: string;
  parentId: string;
  depth: number;
}
