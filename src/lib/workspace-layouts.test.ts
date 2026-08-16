import { Folder, Clock } from "lucide-react";
import { describe, expect, it } from "vitest";

import { mergeLayout, type WorkspaceModule } from "./workspace-layouts";

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
