import {
  BarChart as IconBarChart,
  Calendar as IconCalendar,
  Clock as IconClock,
  Folder as IconFolder,
  GraduationCap as IconGraduationCap,
  Sparkles as IconSparkles,
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

// ---------------------------------------------------------------------------
// Dashboard modules — each maps to an existing dashboard section.
// ---------------------------------------------------------------------------

// Priority surfaces stay in the page flow so the dashboard answers "what's next?"
// before the user enters the customizable workspace below.
// "week" is retired because it duplicated the welcome header's reputation
// badge and overlapped with the Recent activity (evidence) module — a
// pure-stat surface that didn't earn its place in the default workspace.
export const RETIRED_DASHBOARD_MODULE_IDS = ["welcome", "today", "next-steps", "week"] as const;

export const DASHBOARD_MODULES: WorkspaceModule[] = [
  {
    id: "projects",
    title: "Your projects",
    icon: IconFolder,
    defaultW: 8,
    defaultH: 9,
    minW: 4,
    maxW: 12,
    minH: 4,
    maxH: 14,
  },
  {
    id: "applications",
    title: "Applications",
    icon: IconTicket,
    defaultW: 8,
    defaultH: 8,
    minW: 4,
    maxW: 12,
    minH: 3,
    maxH: 12,
  },
  {
    id: "challenges",
    title: "Challenges",
    icon: IconSwords,
    defaultW: 8,
    defaultH: 8,
    minW: 4,
    maxW: 12,
    minH: 3,
    maxH: 12,
  },
  {
    id: "connections",
    title: "Connections",
    icon: IconUsers,
    defaultW: 8,
    defaultH: 8,
    minW: 4,
    maxW: 12,
    minH: 3,
    maxH: 12,
  },
  {
    id: "suggested-projects",
    title: "Projects for you",
    icon: IconFolder,
    defaultW: 4,
    defaultH: 9,
    minW: 3,
    maxW: 12,
    minH: 4,
    maxH: 14,
  },
  {
    id: "suggested-creators",
    title: "People you'd connect with",
    icon: IconUsers,
    defaultW: 4,
    defaultH: 8,
    minW: 3,
    maxW: 12,
    minH: 3,
    maxH: 12,
  },
  {
    id: "trending-skills",
    title: "Trending skills",
    icon: IconSparkles,
    defaultW: 4,
    defaultH: 8,
    minW: 3,
    maxW: 12,
    minH: 3,
    maxH: 12,
  },
  {
    id: "activity",
    title: "Recent activity",
    icon: IconClock,
    defaultW: 12,
    defaultH: 10,
    minW: 6,
    maxW: 12,
    minH: 5,
    maxH: 16,
  },
];

// ---------------------------------------------------------------------------
// Profile modules — the identity header + sidebar stay fixed; the content
// area beneath is a workspace of modules.
// ---------------------------------------------------------------------------

export const PROFILE_MODULES: WorkspaceModule[] = [
  {
    id: "overview",
    title: "Overview",
    icon: IconBarChart,
    defaultW: 12,
    defaultH: 18,
    minW: 6,
    maxW: 12,
    minH: 8,
    maxH: 28,
  },
  {
    id: "skills",
    title: "Skills",
    icon: IconGraduationCap,
    defaultW: 12,
    defaultH: 14,
    minW: 6,
    maxW: 12,
    minH: 6,
    maxH: 22,
  },
  {
    id: "projects",
    title: "Projects",
    icon: IconSparkles,
    defaultW: 12,
    defaultH: 14,
    minW: 6,
    maxW: 12,
    minH: 6,
    maxH: 22,
  },
  {
    id: "communities",
    title: "Communities",
    icon: IconUsers,
    defaultW: 12,
    defaultH: 10,
    minW: 6,
    maxW: 12,
    minH: 4,
    maxH: 16,
  },
  {
    id: "activity",
    title: "Activity",
    icon: IconCalendar,
    defaultW: 12,
    defaultH: 12,
    minW: 6,
    maxW: 12,
    minH: 5,
    maxH: 20,
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
