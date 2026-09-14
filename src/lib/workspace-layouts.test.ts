import { Folder, Clock } from "lucide-react";
import { describe, expect, it } from "vitest";

import {
  mergeLayout,
  DASHBOARD_LAYOUT_PRESETS,
  DASHBOARD_MODULES,
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
  it("packs work, collaboration, discovery, and evidence into compact rows", () => {
    const layout = stackDefault(DASHBOARD_MODULES);
    expect(layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))).toEqual([
      // Work → collaboration → discovery → evidence, two rows per line.
      { i: "projects", x: 0, y: 0, w: 6, h: 3 },
      { i: "applications", x: 6, y: 0, w: 6, h: 3 },
      { i: "challenges", x: 0, y: 4, w: 6, h: 3 },
      { i: "connections", x: 6, y: 4, w: 6, h: 3 },
      { i: "suggested-projects", x: 0, y: 8, w: 6, h: 3 },
      { i: "suggested-creators", x: 6, y: 8, w: 6, h: 3 },
      { i: "trending-skills", x: 0, y: 12, w: 6, h: 3 },
      { i: "activity", x: 6, y: 12, w: 6, h: 3 },
    ]);
  });

  it("clamps layouts saved before the compact rows down to the row scale", () => {
    const result = mergeLayout(DASHBOARD_MODULES, [{ i: "projects", x: 0, y: 20, w: 8, h: 9 }]);

    expect(result.items.find(({ i }) => i === "projects")).toMatchObject({ h: 4 });
  });
});

describe("dashboard layout presets", () => {
  it("offers guided presets without changing the freeform module registry", () => {
    expect(DASHBOARD_LAYOUT_PRESETS.map(({ id }) => id)).toEqual([
      "build-center",
      "network-center",
    ]);
  });
});

describe("mergeLayout", () => {
  it("removes retired modules and shifts surviving dashboard modules upward", () => {
    const result = mergeLayout(
      modules,
      [
        { i: "today", x: 0, y: 0, w: 12, h: 6 },
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
