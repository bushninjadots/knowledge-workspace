// ── Block System Types ───────────────────────────────────────────────────────
// Core type definitions for the block/page/layout/theme architecture.
// These are the shared contracts that the registry, renderer, hooks, and
// database schema all agree on.

// ---------------------------------------------------------------------------
// Block Types
// ---------------------------------------------------------------------------

/** Unique key identifying a registered block type, e.g. "text", "roadmap". */
export type BlockType = string;

/** Category groups for the block picker and library browsing. */
export type BlockCategory =
  | "content"
  | "media"
  | "project"
  | "people"
  | "community"
  | "utility";

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
  /** Either "profile" or "project". */
  ownerType: "profile" | "project";
  /** The page ID, useful for data hooks that scope to the page owner. */
  pageId: string;
  /** Whether the block is currently in edit mode (shows handles, config UI). */
  isEditing: boolean;
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
  /** The React component that renders this block. */
  component: React.ComponentType<BlockProps>;
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
  | "feature";

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
}

// ---------------------------------------------------------------------------
// Registry Types
// ---------------------------------------------------------------------------

/** The block registry is a Map<BlockType, BlockDefinition>. */
export type BlockRegistry = Map<BlockType, BlockDefinition>;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_LAYOUT: PageLayout = {
  sections: [],
};

export const DEFAULT_THEME_TOKENS: ThemeTokens = {};