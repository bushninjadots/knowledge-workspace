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
export type BlockCategory =
  | "content"
  | "identity"
  | "work"
  | "skills"
  | "network"
  | "media"
  | "project"
  | "people"
  | "community"
  | "utility";

/** The page owner context a block can render in. Omit (or "both") to allow everywhere. */
type BlockOwnerContext = "profile" | "project" | "both";

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
  /**
   * Quick-edit mode: the owner can change identity/media/appearance on the
   * header block without the full block editor. Blocks stay in view mode
   * (empty states hidden) — only the header's owner controls are revealed.
   */
  quickEdit?: boolean;
  /** Whether the current viewer owns this page (enables in-place editing affordances). */
  isOwner?: boolean;
  /** Optional translucent surface treatment for profile pages. */
  translucent?: boolean;
  /**
   * View-mode content reporter. A block calls this (when not editing) to tell
   * the page renderer whether it rendered any public content. The layout uses
   * it to collapse empty sections in the public Studio so they don't leave a
   * blank band + divider.
   */
  onBlockEmptyChange?: (blockId: string, isEmpty: boolean) => void;
  /** Optional profile-header completion action supplied by the profile route. */
  profileCompleteness?: number;
  onCompleteProfile?: () => void;
  /** Optional first-project creation action (Studio editor/view only). */
  onAddProject?: () => void;
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
  /** The block's own title, when it renders one through BlockTitle. Its
   *  presence gives the block the inspector's Title controls. */
  title?: string;
  /** The title starts hidden (the block's content labels itself). */
  titleHiddenByDefault?: boolean;
  /** Whether the block expects to control its own container (e.g. full-width hero). */
  containerless?: boolean;
  /**
   * Where the block's public content comes from. "config" means every value it
   * renders lives in the block instance's config, so emptiness can be
   * classified statically (before the block mounts). "data" (default) means the
   * block reads owner/DB content at runtime and reports emptiness itself via
   * `context.onBlockEmptyChange` — static config-based classification would
   * wrongly hide a data-driven block whose config is empty but whose DB content
   * exists.
   */
  contentSource?: "config" | "data";
  /** Owner contexts this block can render in. Omit (or "both") to allow everywhere. */
  ownerContext?: BlockOwnerContext;
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
  type: "text" | "textarea" | "toggle" | "select" | "image" | "color" | "range" | "url" | "list";
  /** Hint under the control. */
  help?: string;
  /** list: the fields each item has (text/textarea/url/select). */
  itemFields?: BlockField[];
  /** list: what one item is called ("stat", "question"). */
  itemLabel?: string;
  /** list: the most items allowed. */
  maxItems?: number;
  /** Placeholder text for text/textarea inputs. */
  placeholder?: string;
  /** Options for select-type fields. */
  options?: Array<{ label: string; value: string }>;
  /** Min/max/step for range-type fields. */
  min?: number;
  max?: number;
  step?: number;
}

// ---------------------------------------------------------------------------
// Layout Types

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
  /** Editing-time grid height in rows; omitted for legacy content-sized layouts. */
  height?: number;
  /** Optional responsive freeform placement; omitted means legacy flow layout. */
  frames?: ResponsiveFrames;
  /** When true, the block uses absolute freeform placement in its section canvas. */
  freeform?: boolean;
  /** Per-block frame border: follow the appearance (default), force the
   *  outline on, or remove it. Rendered by the shared `.studio-block` frame. */
  frameBorder?: "default" | "frame" | "none";
  /** Per-block inner spacing in px (0 = content flush to the frame edge).
   *  Omitted = the global frame inset. */
  frameInset?: number;
  /** Per-block corner shape. "default" follows the global studio radius;
   *  the other presets override it with a shape that can adapt to the
   *  block's dimensions (percentage-based radii scale with content). */
  frameShape?: BlockShape;
  /** Per-block uniform corner radius in px (0–48). Only meaningful when
   *  frameShape is "rounded" or "soft"; omitted = the shape's built-in default. */
  frameRadius?: number;
  /** Per-block fill: "tint", "accent", "none" or a #rrggbb colour (text
   *  switches to a readable ink). Omitted = the Studio's card fill. */
  frameFill?: string;
  /** Per-block shadow. Omitted = the Studio's card shadow. */
  frameShadow?: "none" | "soft" | "lifted";
  /** Text alignment inside the block. Omitted = start. */
  frameAlign?: "start" | "center";
  /** Where the block appears. Omitted = everywhere. */
  showOn?: "all" | "desktop" | "mobile";
}

/** Per-block corner shape presets. Percentage-based shapes ("organic", "blob",
 *  "leaf") adapt to the block's aspect ratio so they look right at any size. */
export type BlockShape =
  "default" | "square" | "rounded" | "soft" | "pill" | "organic" | "blob" | "leaf";

/** A 12-column grid item used by the Studio's direct manipulation canvas. */
export interface LayoutGridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

/** A section groups blocks into a column arrangement. */
export interface LayoutSection {
  /** Stable id for this section. */
  id: string;
  /** Position within the layout (0-based). */
  position: number;
  /** Optional human-readable section name. Omitted sections display their layout type. */
  title?: string;
  /** Column arrangement for this section. */
  layout: SectionLayoutType;
  /** Blocks within this section, ordered by position. */
  blocks: LayoutBlockInstance[];
  /** Whether the section is visible in the public Studio. */
  visible?: boolean;
  /** Persisted 12-column placement used by the owner Studio editor. */
  grid?: LayoutGridItem[];
  /** Legacy page-level placement retained for backwards-compatible data reads. */
  gridRow?: number;
  /** Legacy page-level placement retained for backwards-compatible data reads. */
  gridColumn?: number;
  /** Optional responsive freeform placement; omitted means legacy flow layout. */
  frames?: ResponsiveFrames;
  /** When true, the section uses freeform placement in the page canvas. */
  freeform?: boolean;
  /** How the area itself presents: its title, a background, its spacing. */
  appearance?: AreaAppearance;
}

/** Per-area presentation, shared by the editor, the owner view and the
 *  public page (components/tethyr/page/area-frame.tsx). */
export interface AreaAppearance {
  /** Show the area's title above it on the page (default true when titled). */
  showTitle?: boolean;
  /** A surface behind the whole area. */
  background?: "none" | "tint" | "accent";
  /** Room after the area. */
  spacing?: "tight" | "normal" | "loose";
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

/** A published snapshot row from the `page_versions` table. */
export interface PageVersion {
  id: string;
  version: number;
  /** The layout sections that were live at publish time. */
  layout: PageLayout;
  publishedAt: string;
  /** Optional changelog line the creator attached at publish time. */
  note?: string | null;
}

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
  /** Published version snapshots (newest first). Empty while never published. */
  versions: PageVersion[];
  /** The latest published version number, or null when never published. */
  publishedVersion: number | null;
  /**
   * The appearance visitors see: the latest published version's config and
   * theme id. Null when never published. Lets the editor count appearance
   * edits as unpublished changes.
   */
  published: { config: StudioConfig; themeId: string } | null;
}

// ---------------------------------------------------------------------------
// Registry Types
// ---------------------------------------------------------------------------

/** The block registry is a Map<BlockType, BlockDefinition>. */
export type BlockRegistry = Map<BlockType, BlockDefinition>;

// ---------------------------------------------------------------------------
// Template Types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fork / Remix Types
// ---------------------------------------------------------------------------
