import {
  BarChart as IconBarChart,
  BookOpen as IconBookOpen,
  Calendar as IconCalendar,
  Clock as IconClock,
  Film as IconFilm,
  Folder as IconFolder,
  GraduationCap as IconGraduationCap,
  Link as IconLink,
  Sparkles as IconSparkles,
  Swords as IconSwords,
  Ticket as IconTicket,
  UserRound as IconUserRound,
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
    defaultW: 4,
    defaultH: 8,
    minW: 3,
    maxW: 12,
    minH: 3,
    maxH: 12,
  },
  {
    id: "challenges",
    title: "Challenges",
    icon: IconSwords,
    defaultW: 6,
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
    defaultW: 6,
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
    id: "projects",
    title: "Work",
    icon: IconSparkles,
    defaultW: 12,
    defaultH: 14,
    minW: 6,
    maxW: 12,
    minH: 6,
    maxH: 22,
  },
  {
    id: "overview",
    title: "Direction",
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
    id: "communities",
    title: "Community",
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
    title: "Contributions",
    icon: IconCalendar,
    defaultW: 12,
    defaultH: 12,
    minW: 6,
    maxW: 12,
    minH: 5,
    maxH: 20,
  },
];

// Public Studios use a separate registry and storage field. The identity
// header remains fixed; these sections are the public story a person can
// rearrange, resize, pin, or hide.
export const PUBLIC_STUDIO_MODULES: WorkspaceModule[] = [
  {
    id: "featured-work",
    title: "Featured work",
    icon: IconSparkles,
    defaultW: 8,
    defaultH: 10,
    minW: 4,
    maxW: 12,
    minH: 5,
    maxH: 16,
  },
  {
    id: "contributions",
    title: "Contributions",
    icon: IconFolder,
    defaultW: 4,
    defaultH: 10,
    minW: 4,
    maxW: 12,
    minH: 5,
    maxH: 18,
  },
  {
    id: "evidence-shelf",
    title: "Evidence shelf",
    icon: IconFilm,
    defaultW: 12,
    defaultH: 10,
    minW: 6,
    maxW: 12,
    minH: 5,
    maxH: 16,
  },
  {
    id: "activity",
    title: "Contribution activity",
    icon: IconCalendar,
    defaultW: 12,
    defaultH: 12,
    minW: 6,
    maxW: 12,
    minH: 6,
    maxH: 20,
  },
  {
    id: "skills-share",
    title: "Skills they share",
    icon: IconGraduationCap,
    defaultW: 7,
    defaultH: 12,
    minW: 4,
    maxW: 12,
    minH: 6,
    maxH: 20,
  },
  {
    id: "skills-growing",
    title: "Skills they’re growing",
    icon: IconBookOpen,
    defaultW: 5,
    defaultH: 8,
    minW: 4,
    maxW: 12,
    minH: 4,
    maxH: 16,
  },
  {
    id: "links",
    title: "Links",
    icon: IconLink,
    defaultW: 5,
    defaultH: 8,
    minW: 4,
    maxW: 12,
    minH: 4,
    maxH: 16,
  },
  {
    id: "about",
    title: "About",
    icon: IconUserRound,
    defaultW: 7,
    defaultH: 9,
    minW: 4,
    maxW: 12,
    minH: 4,
    maxH: 16,
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

export const DASHBOARD_LAYOUT_PRESETS: WorkspaceLayoutPreset[] = [
  {
    ...createPreset(
      DASHBOARD_MODULES,
      {
        projects: { x: 0, y: 0, w: 8, h: 9 },
        applications: { x: 8, y: 0, w: 4, h: 8 },
        activity: { x: 0, y: 18, w: 12, h: 10 },
      },
      ["projects"],
    ),
    id: "build-center",
    label: "Build center",
    description: "Keep your projects and current work in front.",
  },
  {
    ...createPreset(
      DASHBOARD_MODULES,
      {
        "suggested-projects": { x: 0, y: 0, w: 6, h: 9 },
        "suggested-creators": { x: 6, y: 0, w: 6, h: 8 },
        "trending-skills": { x: 0, y: 10, w: 6, h: 8 },
        activity: { x: 0, y: 19, w: 12, h: 10 },
      },
      ["suggested-projects", "suggested-creators"],
    ),
    id: "network-center",
    label: "Network center",
    description: "Make discovery and new collaborators more prominent.",
  },
];

export const PROFILE_LAYOUT_PRESETS: WorkspaceLayoutPreset[] = [
  {
    ...createPreset(
      PROFILE_MODULES,
      {
        overview: { x: 0, y: 0, w: 12, h: 18 },
        projects: { x: 0, y: 19, w: 12, h: 14 },
        skills: { x: 0, y: 34, w: 12, h: 14 },
      },
      ["projects"],
    ),
    id: "studio-work-first",
    label: "Work first",
    description: "Put your projects and contribution context before secondary detail.",
  },
  {
    ...createPreset(
      PROFILE_MODULES,
      {
        skills: { x: 0, y: 0, w: 12, h: 14 },
        communities: { x: 0, y: 15, w: 12, h: 10 },
        activity: { x: 0, y: 26, w: 12, h: 12 },
      },
      ["skills", "activity"],
    ),
    id: "studio-community",
    label: "Community and evidence",
    description: "Lead with skills, communities, and the work you have contributed.",
  },
];

export const PUBLIC_STUDIO_PRESETS: WorkspaceLayoutPreset[] = [
  {
    ...createPreset(
      PUBLIC_STUDIO_MODULES,
      {
        "featured-work": { x: 0, y: 0, w: 8, h: 10 },
        contributions: { x: 8, y: 0, w: 4, h: 10 },
        "evidence-shelf": { x: 0, y: 11, w: 12, h: 10 },
        activity: { x: 0, y: 22, w: 12, h: 12 },
      },
      ["featured-work"],
    ),
    id: "work-first",
    label: "Work first",
    description: "Lead with the project you want people to remember.",
  },
  {
    ...createPreset(
      PUBLIC_STUDIO_MODULES,
      {
        "skills-share": { x: 0, y: 0, w: 7, h: 12 },
        "featured-work": { x: 7, y: 0, w: 5, h: 10 },
        contributions: { x: 7, y: 11, w: 5, h: 10 },
        "evidence-shelf": { x: 0, y: 22, w: 12, h: 10 },
        "skills-growing": { x: 0, y: 33, w: 6, h: 8 },
        links: { x: 6, y: 13, w: 6, h: 8 },
      },
      ["skills-share"],
    ),
    id: "collaboration-first",
    label: "Collaboration first",
    description: "Make it obvious how people can work with you.",
  },
  {
    ...createPreset(
      PUBLIC_STUDIO_MODULES,
      {
        "featured-work": { x: 0, y: 0, w: 7, h: 10 },
        "skills-growing": { x: 7, y: 0, w: 5, h: 8 },
        about: { x: 7, y: 9, w: 5, h: 9 },
        "evidence-shelf": { x: 0, y: 19, w: 12, h: 10 },
        activity: { x: 0, y: 30, w: 12, h: 12 },
      },
      ["featured-work", "skills-growing"],
    ),
    id: "learning-first",
    label: "Learning first",
    description: "Lead with your direction, experiments, and progress.",
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
