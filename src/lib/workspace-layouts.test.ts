import { Folder, Clock } from "lucide-react";
import { describe, expect, it } from "vitest";

import {
  mergeLayout,
  DASHBOARD_LAYOUT_PRESETS,
  DASHBOARD_MODULES,
  PROFILE_LAYOUT_PRESETS,
  PUBLIC_STUDIO_MODULES,
  PUBLIC_STUDIO_PRESETS,
  stackDefault,
  type WorkspaceModule,
} from "./workspace-layouts";

const modules: WorkspaceModule[] = [
  {
    id: "projects",
    title: "Your projects",
    icon: Folder,
    defaultW: 8,
    defaultH: 9,
  },
  {
    id: "activity",
    title: "Recent activity",
    icon: Clock,
    defaultW: 12,
    defaultH: 10,
  },
];

describe("dashboard hierarchy", () => {
  it("packs work, collaboration, discovery, and evidence into intentional rows", () => {
    const layout = stackDefault(DASHBOARD_MODULES);
    expect(layout.slice(0, 2).map(({ i, x, y }) => ({ i, x, y }))).toEqual([
      { i: "projects", x: 0, y: 0 },
      { i: "applications", x: 8, y: 0 },
    ]);
    expect(layout.slice(2, 4).map(({ i, x, y }) => ({ i, x, y }))).toEqual([
      { i: "challenges", x: 0, y: 10 },
      { i: "connections", x: 6, y: 10 },
    ]);
    expect(layout.slice(4, 7).every(({ y }) => y === 19)).toBe(true);
    expect(layout[7]).toMatchObject({ i: "activity", x: 0, y: 29, w: 12 });
  });
});

describe("public Studio layout", () => {
  it("exposes a stable work-first set of public sections", () => {
    expect(PUBLIC_STUDIO_MODULES.map(({ id }) => id)).toEqual([
      "featured-work",
      "contributions",
      "activity",
      "skills-share",
      "skills-growing",
      "links",
      "about",
    ]);
    expect(PUBLIC_STUDIO_MODULES[0].defaultW).toBe(8);
    expect(PUBLIC_STUDIO_MODULES[1].defaultW).toBe(4);
  });

  it("offers guided presets without changing the freeform module registry", () => {
    expect(PUBLIC_STUDIO_PRESETS.map(({ id }) => id)).toEqual([
      "work-first",
      "collaboration-first",
      "learning-first",
    ]);
    expect(
      PUBLIC_STUDIO_PRESETS.every((preset) => preset.items.length === PUBLIC_STUDIO_MODULES.length),
    ).toBe(true);
    expect(PUBLIC_STUDIO_PRESETS[0].pinned).toContain("featured-work");
    expect(DASHBOARD_LAYOUT_PRESETS.map(({ id }) => id)).toEqual([
      "build-center",
      "network-center",
    ]);
    expect(PROFILE_LAYOUT_PRESETS.map(({ id }) => id)).toEqual([
      "studio-work-first",
      "studio-community",
    ]);
  });
});

describe("mergeLayout", () => {
  it("removes retired modules and shifts surviving dashboard modules upward", () => {
    const result = mergeLayout(
      modules,
      [
        { i: "welcome", x: 0, y: 0, w: 12, h: 6 },
        { i: "projects", x: 0, y: 12, w: 8, h: 9 },
        { i: "activity", x: 0, y: 23, w: 12, h: 10 },
      ],
      [],
      [],
      undefined,
      true,
    );

    expect(result.items.map(({ i, y }) => ({ i, y }))).toEqual([
      { i: "projects", y: 0 },
      { i: "activity", y: 11 },
    ]);
  });

  it("does not shift for an unrelated unknown module", () => {
    const result = mergeLayout(
      modules,
      [
        { i: "future-module", x: 0, y: 0, w: 12, h: 4 },
        { i: "projects", x: 0, y: 12, w: 8, h: 9 },
      ],
      [],
      [],
      undefined,
      true,
    );

    expect(result.items.find(({ i }) => i === "projects")?.y).toBe(12);
  });

  it("preserves current layouts when no retired module is present", () => {
    const result = mergeLayout(modules, [
      { i: "projects", x: 0, y: 4, w: 8, h: 9 },
      { i: "activity", x: 0, y: 15, w: 12, h: 10 },
    ]);

    expect(result.items.map(({ i, y }) => ({ i, y }))).toEqual([
      { i: "projects", y: 4 },
      { i: "activity", y: 15 },
    ]);
  });
});
