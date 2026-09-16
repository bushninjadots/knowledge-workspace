import {
  Clock as IconClock,
  Folder as IconFolder,
  Kanban as IconKanban,
  Sparkles as IconSparkles,
  Star as IconStar,
  Swords as IconSwords,
  Ticket as IconTicket,
  Users as IconUsers,
  type LucideIcon,
} from "lucide-react";
import type { PersistedLayoutItem } from "@/hooks/use-layout-preferences";

// ---------------------------------------------------------------------------
// Module registry — a module is a stable, addressable piece of a page that a
// user can reorder, resize, hide, pin, and persist.
// ---------------------------------------------------------------------------

export type WorkspaceModule = {
  id: string;
  title: string;
  icon: LucideIcon;
  /** Default width in grid columns (12-col grid). */
  defaultW: number;
  /** Default height in grid rows. */
  defaultH: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  /** Whether this module can be hidden by the user (default true). */
  hideable?: boolean;
  /** Whether this module can be pinned (default true). */
  pinnable?: boolean;
};

export const GRID_COLS = 12;
export const ROW_HEIGHT = 22;
export const GRID_MARGIN: [number, number] = [14, 14];

export type WorkspaceLayoutPreset = {
  id: string;
  label: string;
  description: string;
  items: PersistedLayoutItem[];
  hidden: string[];
  pinned: string[];
};

// ---------------------------------------------------------------------------
// Dashboard modules — each maps to an existing dashboard section.
// ---------------------------------------------------------------------------

// Priority surfaces stay in the page flow so the dashboard answers "what's next?"
// before the user enters the customizable workspace below.
// "week" is retired because it duplicated the welcome header's reputation
// badge and overlapped with the Recent activity (evidence) module — a
// pure-stat surface that didn't earn its place in the default workspace.
export const RETIRED_DASHBOARD_MODULE_IDS = ["today", "next-steps", "week"] as const;

// Every dashboard module renders one compact row — label, a line of real
// content, and the action that leads to the surface where that content lives
// in full. So widths pair two rows per line and heights fit a two-line row;
// the priority zone above the workspace carries the depth (G13).
export const DASHBOARD_MODULES: WorkspaceModule[] = [
  {
    id: "projects",
    title: "Your projects",
    icon: IconFolder,
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    maxW: 12,
    minH: 2,
    maxH: 4,
  },
  {
    id: "roadmap",
    title: "Roadmap",
    icon: IconKanban,
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    maxW: 12,
    minH: 2,
    maxH: 4,
  },
  {
    id: "applications",
    title: "Applications",
    icon: IconTicket,
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    maxW: 12,
    minH: 2,
    maxH: 4,
  },
  {
    id: "challenges",
    title: "Challenges",
    icon: IconSwords,
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    maxW: 12,
    minH: 2,
    maxH: 4,
  },
  {
    id: "connections",
    title: "Connections",
    icon: IconUsers,
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    maxW: 12,
    minH: 2,
    maxH: 4,
  },
  {
    id: "suggested-projects",
    title: "Projects for you",
    icon: IconFolder,
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    maxW: 12,
    minH: 2,
    maxH: 4,
  },
  {
    id: "suggested-creators",
    title: "People you'd connect with",
    icon: IconUsers,
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    maxW: 12,
    minH: 2,
    maxH: 4,
  },
  {
    id: "trending-skills",
    title: "Trending skills",
    icon: IconSparkles,
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    maxW: 12,
    minH: 2,
    maxH: 4,
  },
  {
    id: "watchlist",
    title: "Watchlist",
    icon: IconStar,
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    maxW: 12,
    minH: 2,
    maxH: 4,
  },
  {
    id: "activity",
    title: "Recent activity",
    icon: IconClock,
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    maxW: 12,
    minH: 2,
    maxH: 4,
  },
];

// ---------------------------------------------------------------------------
// Default layout helpers
// ---------------------------------------------------------------------------

/**
 * Build a default layout that mirrors the current page structure: greedy
 * row-packing so full-width modules take their own row while narrower modules
 * (e.g. 8-col content + 4-col rail) sit side by side.
 */
export function stackDefault(modules: WorkspaceModule[]): PersistedLayoutItem[] {
  const items: PersistedLayoutItem[] = [];
  let y = 0;
  let x = 0;
  let rowH = 0;
  for (const m of modules) {
    const w = Math.min(m.defaultW, GRID_COLS);
    if (x + w > GRID_COLS) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    items.push({
      i: m.id,
      x,
      y,
      w,
      h: m.defaultH,
      minW: m.minW,
      maxW: m.maxW,
      minH: m.minH,
      maxH: m.maxH,
    });
    x += w;
    rowH = Math.max(rowH, m.defaultH);
  }
  return items;
}

function createPreset(
  modules: WorkspaceModule[],
  overrides: Record<string, Partial<PersistedLayoutItem>>,
  pinned: string[] = [],
): WorkspaceLayoutPreset {
  const defaults = stackDefault(modules);
  const items = defaults.map((item) => ({ ...item, ...(overrides[item.i] ?? {}) }));
  return {
    id: "preset",
    label: "Preset",
    description: "A starting arrangement",
    items,
    hidden: [],
    pinned,
  };
}

// Presets only decide what leads: with every module a single compact row, the
// choice that matters is which rows rise to the top of the workspace.
export const DASHBOARD_LAYOUT_PRESETS: WorkspaceLayoutPreset[] = [
  {
    ...createPreset(DASHBOARD_MODULES, {}, ["projects"]),
    id: "build-center",
    label: "Build center",
    description: "Keep your projects and current work in front.",
  },
  {
    ...createPreset(DASHBOARD_MODULES, {}, ["suggested-projects", "suggested-creators"]),
    id: "network-center",
    label: "Network center",
    description: "Make discovery and new collaborators more prominent.",
  },
];

/**
 * Merge a saved layout with the module registry:
 * - drops items whose module no longer exists
 * - clamps sizes to each module's min/max
 * - appends new modules at sensible default positions
 */
export function mergeLayout(
  modules: WorkspaceModule[],
  saved?: PersistedLayoutItem[] | null,
  hidden?: string[],
  pinned?: string[],
  defaults?: PersistedLayoutItem[] | null,
  migrateRetiredModules = false,
): { items: PersistedLayoutItem[]; hidden: string[]; pinned: string[] } {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const defaultById = new Map((defaults ?? []).map((d) => [d.i, d]));
  const savedItems = saved ?? [];
  const hasRetiredModules =
    migrateRetiredModules &&
    savedItems.some((item) =>
      RETIRED_DASHBOARD_MODULE_IDS.includes(
        item.i as (typeof RETIRED_DASHBOARD_MODULE_IDS)[number],
      ),
    );
  const survivingYs = savedItems.filter((item) => byId.has(item.i)).map((item) => item.y);
  const legacyYOffset = hasRetiredModules && survivingYs.length > 0 ? Math.min(...survivingYs) : 0;
  const items: PersistedLayoutItem[] = [];

  for (const m of modules) {
    const savedItem = savedItems.find((s) => s.i === m.id);
    const defItem = defaultById.get(m.id);
    const w = clampDim(savedItem?.w ?? defItem?.w ?? m.defaultW, m.minW ?? 1, m.maxW ?? GRID_COLS);
    const h = clampDim(savedItem?.h ?? defItem?.h ?? m.defaultH, m.minH ?? 1, m.maxH ?? 20);
    items.push({
      i: m.id,
      x: clampDim(savedItem?.x ?? defItem?.x ?? 0, 0, GRID_COLS - w),
      y: Math.max(0, (savedItem?.y ?? defItem?.y ?? 0) - legacyYOffset),
      w,
      h,
      minW: m.minW,
      maxW: m.maxW,
      minH: m.minH,
      maxH: m.maxH,
    });
  }

  return {
    items,
    hidden: (hidden ?? []).filter((id) => byId.has(id)),
    pinned: (pinned ?? []).filter((id) => byId.has(id)),
  };
}

function clampDim(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
