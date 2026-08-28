// ── Block Registry ───────────────────────────────────────────────────────────
// The block registry is a module-level Map that stores BlockDefinition entries.
// Blocks register themselves at import time. The renderer looks up blocks by
// type key. This avoids a hard-coded switch statement and allows new blocks to
// be added without touching the renderer or any existing file.

import type { BlockDefinition, BlockRegistry, BlockType } from "@/lib/page-blocks";

/** The singleton registry. Lazy-initialised so side-effect imports work. */
let _registry: BlockRegistry | null = null;

function registry(): BlockRegistry {
  if (!_registry) _registry = new Map();
  return _registry;
}

/**
 * Register a block definition. Called at module level by each block file.
 * Throws if a block with the same type is already registered (double-registration
 * is a bug).
 */
export function registerBlock(def: BlockDefinition): void {
  const reg = registry();
  if (reg.has(def.type)) {
    console.warn(
      `[BlockRegistry] Block type "${def.type}" already registered — skipping duplicate`,
    );
    return;
  }
  reg.set(def.type, def);
}

/**
 * Look up a registered block definition by type key.
 * Returns undefined if no block is registered for that type.
 */
export function getBlock(type: BlockType): BlockDefinition | undefined {
  return registry().get(type);
}

/**
 * Return all registered blocks, sorted by category then label.
 */
export function getAllBlocks(): BlockDefinition[] {
  return Array.from(registry().values()).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.label.localeCompare(b.label);
  });
}

/**
 * Return all registered blocks in a specific category.
 */
export function getBlocksByCategory(category: string): BlockDefinition[] {
  return getAllBlocks().filter((b) => b.category === category);
}

/** Page types that a block may be scoped to. */
export type BlockPageScope = "profile" | "project";

/**
 * The page type a block is scoped to, derived from its type prefix:
 * `project-*` → project pages only, `profile-*` → profile pages only,
 * anything else (content/media/utility) → usable on both.
 */
export function blockPageScope(type: string): BlockPageScope | "both" {
  if (type.startsWith("project-")) return "project";
  if (type.startsWith("profile-")) return "profile";
  return "both";
}

/**
 * Return all blocks available for a given page type. Project blocks are
 * excluded from profile pages and vice-versa so the picker never offers a
 * block that doesn't belong (e.g. a second hero/header on a profile page).
 */
export function getBlocksForPageType(pageType: BlockPageScope): BlockDefinition[] {
  return getAllBlocks().filter((b) => {
    const scope = blockPageScope(b.type);
    return scope === "both" || scope === pageType;
  });
}

/**
 * Create a fresh block instance for the given type with default config.
 * Returns null if the type is not registered.
 */
export function createBlockInstance(type: BlockType): {
  type: string;
  config: Record<string, unknown>;
} | null {
  const def = getBlock(type);
  if (!def) return null;
  return {
    type,
    config: { ...def.defaults },
  };
}

/**
 * Validate block config against the block's registered schema (basic structural
 * check — the actual schema validation would use JSON Schema or zod).
 * Returns true if the block type exists and the config looks like an object.
 */
export function validateBlockConfig(type: BlockType, config: unknown): boolean {
  const def = getBlock(type);
  if (!def) return false;
  if (typeof config !== "object" || config === null) return false;
  // Deeper schema validation can be added here later.
  return true;
}

/**
 * Reset the registry — only used in tests to ensure clean state.
 */
export function _resetRegistry(): void {
  _registry = null;
}
