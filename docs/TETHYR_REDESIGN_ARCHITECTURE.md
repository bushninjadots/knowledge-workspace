# Tethyr Redesign — Data & Architecture Design

> **Status: Proposal. Not yet implemented.**
> **Created: 2026-08-23**
> **References:** `TETHYR_REDESIGN_SPEC.md` for product intent; existing `TETHYR_ARCHITECTURE.md` for current ownership.

## Scope

This document defines the conceptual data model and component architecture for the block/page/template/fork system. It is a guide for implementation design, not a final schema.

Follow the existing Tethyr technology stack (TypeScript, React, TanStack Start, TanStack Router, TanStack Query, Supabase, Tailwind, Radix, Framer Motion) and conventions. Do not introduce new frameworks or libraries that are not already dependencies.

---

## 1. Conceptual Data Model

### Page

A page represents a renderable public or private surface (profile or project).

```typescript
interface Page {
  id: string;
  owner_id: string;          // profile or project owner
  owner_type: "profile" | "project";
  layout_id: string;          // reference to active layout
  theme_id: string;           // reference to active theme
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
```

### Layout

A layout defines the structural arrangement of sections/blocks.

```typescript
interface Layout {
  id: string;
  name: string;
  description: string | null;
  type: "standard" | "minimal" | "full_width" | "centered" | "sidebar" |
        "documentation" | "portfolio" | "magazine" | "dashboard" |
        "landing_page" | "custom";
  sections: LayoutSection[];
  is_template: boolean;       // can it be used as a starting point?
  created_by: string;         // user who created this layout
  created_at: string;
  updated_at: string;
}

interface LayoutSection {
  id: string;
  position: number;
  layout_type: "full" | "two_column" | "three_column" | "sidebar_left" | "sidebar_right" | "feature";
  blocks: LayoutBlock[];
}

interface LayoutBlock {
  id: string;
  block_type: string;         // references BlockDefinition.type
  position: number;           // within section
  config: Record<string, unknown>;  // block-specific configuration
  visibility: "visible" | "hidden";
}
```

### BlockDefinition

A block definition is the registered type contract — what the block is, what it can render, and what configuration it accepts. The runtime registers blocks so the system can discover them without hard-coded lists.

```typescript
interface BlockDefinition {
  type: string;               // unique key, e.g. "text", "heading", "roadmap"
  category: "content" | "media" | "project" | "people" | "community" | "utility";
  label: string;              // human-readable name
  description: string;
  icon: string;               // icon identifier
  defaults: Record<string, unknown>;  // default config
  schema: BlockConfigSchema;  // JSON Schema or validation shape for config
  component: React.ComponentType<BlockProps>;  // registered renderer
}

interface BlockProps {
  config: Record<string, unknown>;
  context: BlockContext;      // page owner, auth state, etc.
  isEditing: boolean;
}
```

### Theme

A theme is a named collection of design tokens.

```typescript
interface Theme {
  id: string;
  name: string;
  description: string | null;
  tokens: ThemeTokens;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ThemeTokens {
  colors: {
    background: string;
    foreground: string;
    muted: string;
    accent: string;
    // ... extended token set
  };
  typography: {
    heading_font: string;
    body_font: string;
    scale: Record<string, TypographyToken>;
  };
  spacing: Record<string, string>;
  borders: {
    radius_scale: Record<string, string>;
    default_style: string;
  };
  shadows: Record<string, string>;
}
```

### Template

A template is a published, reusable Layout + optional Theme that others can fork.

```typescript
interface Template {
  id: string;
  name: string;
  description: string | null;
  creator_id: string;
  layout: Layout;              // the structural blueprint
  theme_id: string | null;     // optional associated theme
  preview_image: string | null;
  categories: string[];        // e.g. ["developer", "portfolio"]
  tags: string[];
  is_published: boolean;
  usage_count: number;
  like_count: number;
  version: number;
  created_at: string;
  updated_at: string;
}
```

### Fork

A fork records lineage: who forked what, from where.

```typescript
interface Fork {
  id: string;
  original_template_id: string;
  parent_template_id: string | null;  // immediate ancestor (for remix chains)
  forked_by: string;
  forked_at: string;
  is_independent: boolean;     // true if fork has diverged from original
}

interface TemplateLineage {
  root_template_id: string;
  chain: Fork[];               // ordered from original to current
}
```

---

## 2. Page Rendering Architecture

```
Route (e.g. /projects/$id)
  └── PageShell (owner, auth, edit/view mode)
        ├── PageThemeProvider (applies active theme tokens)
        ├── PageLayout (reads layout → arranges sections)
        │     ├── LayoutSection (reads section → arranges columns)
        │     │     └── BlockRenderer (reads block type → renders registered component)
        │     │           ├── TextBlock
        │     │           ├── HeadingBlock
        │     │           ├── RoadmapBlock
        │     │           ├── TeamBlock
        │     │           └── ...extensible
        │     └── LayoutSection
        └── EditOverlay (visible only in edit mode)
              ├── BlockPicker
              ├── DragHandle
              ├── ConfigPanel
              └── PublishControls
```

### Key Principles

1. **Edit mode is an overlay on view mode** — the same components render; edit controls are additive.
2. **Blocks are registered, not enumerated** — `BlockRenderer` looks up registered blocks by type. New blocks can be added without rewriting the renderer.
3. **Layout, theme, and content are separate concerns** — a page can swap layouts without data loss, swap themes without structural changes.
4. **Public pages render without edit metadata** — templates and layouts have an `is_template` flag. Public rendering only needs the layout structure; edit history, draft status, and lineage metadata are never exposed to unauthenticated visitors.

---

## 3. Component Ownership Map (Proposed)

### New conceptual owners

```
src/components/tethyr/page/
  page-shell.tsx             — auth, edit/view mode, theme provider
  page-layout.tsx            — layout → sections → blocks
  layout-section.tsx         — section column arrangement
  block-renderer.tsx         — block type → registered component lookup
  block-registry.ts          — registration, discovery, validation

src/components/tethyr/blocks/
  content/
    text-block.tsx
    heading-block.tsx
    markdown-block.tsx
    quote-block.tsx
    divider-block.tsx
  media/
    image-block.tsx
    gallery-block.tsx
    video-block.tsx
    embed-block.tsx
  project/
    status-block.tsx
    stats-block.tsx
    roadmap-block.tsx
    tech-stack-block.tsx
    files-block.tsx
    tasks-block.tsx
  people/
    team-block.tsx
    contributors-block.tsx
  community/
    activity-block.tsx
    discussions-block.tsx

src/components/tethyr/editor/
  customize-bar.tsx          — edit mode entry point
  block-picker.tsx           — add blocks
  block-config-panel.tsx     — configure selected block
  drag-handle.tsx            — reorder
  publish-controls.tsx       — draft/preview/publish

src/components/tethyr/templates/
  template-card.tsx
  template-library.tsx
  template-preview.tsx
  fork-button.tsx
  lineage-view.tsx

src/hooks/
  use-page.ts                — fetch page with layout + theme
  use-page-editor.ts         — edit state, draft, publish
  use-block-registry.ts      — registered blocks lookup
  use-templates.ts           — template library queries
  use-fork.ts                — fork/remix mutations
  use-theme.ts               — theme application

src/lib/
  block-validation.ts        — config schema validation
  layout-serializer.ts       — layout ↔ JSON ↔ DB
  theme-applier.ts           — theme tokens → CSS variables
  fork-lineage.ts            — lineage resolution
  migration/
    page-migration.ts        — map existing profiles/projects → blocks
```

### Existing owners that connect

- `src/routes/projects.$id.tsx` → wraps `PageShell` with owner_type=project
- `src/routes/u.$handle.tsx` → wraps `PageShell` with owner_type=profile
- `src/hooks/use-current-user.ts` → provides auth context
- `src/components/tethyr/workspace/` → potentially replaced by or migrated into the block system
- `src/components/tethyr/profile/public-studio-workspace.tsx` → migrated
- `src/styles.css` → extended with theme token variables

---

## 4. Database Migration Strategy

### New tables (conceptual, not final DDL)

```
pages
  id, owner_id, owner_type, layout_id, theme_id, status, published_at, created_at, updated_at

layouts
  id, name, type, sections (jsonb), is_template, created_by, created_at, updated_at

themes
  id, name, tokens (jsonb), created_by, created_at, updated_at

templates
  id, name, description, creator_id, layout (jsonb), theme_id,
  preview_image, categories, tags, is_published, usage_count, like_count,
  version, created_at, updated_at

forks
  id, original_template_id, parent_template_id, forked_by, is_independent, forked_at
```

### Migration of existing data

Existing profiles and projects must be mapped into the block system:

```
Existing project description → "about" / "markdown" block
Existing members → "team" block
Existing files → "files" block
Existing activity → "activity" block
Existing project status → "status" block
Existing skills → "skills" block
Existing profile bio → "about" / "text" block
Existing featured projects → "projects" / "featured" block
```

The migration should be additive — existing data is not destroyed, it is represented through blocks using the same underlying queries.

---

## 5. Template Safety Rules

### What templates CAN contain
- Layout structure (sections, block positions, column arrangements)
- Theme reference or theme tokens
- Default block configurations (e.g., "this section should be a two-column layout")
- Metadata (name, description, categories, tags)

### What templates MUST NOT contain
- User-specific content (project data, profile text, names, contact info)
- Private project identifiers
- Private member lists
- Files or file references
- Internal activity or discussion content
- Authentication tokens or secrets

### Enforcement
- Template serialization strips content fields from blocks when publishing
- Template application fills block config defaults from the template, then hydrates with the user's own data
- Permissions enforced at the database row level through RLS policies

---

## 6. Implementation Constraints

1. **Do not build a generic website builder.** Every block must have a meaningful Tethyr purpose (projects, people, skills, collaboration, community, activity, reputation).
2. **Reuse existing queries and hooks.** Blocks are presentation wrappers around existing data hooks — they do not introduce new data sources.
3. **Preserve the existing project/profile RLS policies.** The block system reads through existing permission boundaries.
4. **Keep the system lightweight.** Lazy-load blocks; avoid a monolithic page-builder framework.
5. **Test at every phase.** Typecheck, focused tests, full test suite, authenticated browser smoke.

---

## 7. Open Design Questions (For Audit Phase)

These must be answered during Phase 1 (audit) before Phase 2 (block foundation) begins:

1. Should the block system replace or coexist with the existing `WorkspaceGrid` customization system?
2. How does the public Studio layout (currently `profiles.public_studio_layout`) map into the new page/block model?
3. Should the project page's README be a block within the page system, or remain a separate first-class concept?
4. How should the existing dashboard priority flow interact with the new page model? Should dashboard also become a block-based page?
5. What is the minimal viable block set for Phase 2? Which existing project/profile sections map cleanly to blocks?
6. How should the current theme/token system in `src/styles.css` evolve into the new Theme model?
7. Does the template table belong in the same Supabase schema, or should it be a separate service?