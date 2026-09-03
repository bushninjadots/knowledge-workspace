import { describe, expect, it } from "vitest";
import { createStudioHistory, type StudioSnapshot } from "./studio-history";

const snapshot: StudioSnapshot = {
  layout: { sections: [] },
  config: {
    starterId: null,
    structure: "wide",
    personality: "modern",
    radius: "soft",
    density: "comfortable",
    accentMode: "auto",
    accentColor: "#3f8f8a",
    appBackground: "surface",
    publicBackground: "default",
  },
  themeId: "",
};

describe("studio history", () => {
  it("stores one cloned snapshot and consumes it on undo", () => {
    const history = createStudioHistory();
    history.capture(snapshot);
    expect(history.canUndo).toBe(true);
    const restored = history.take();
    expect(restored).toEqual(snapshot);
    expect(history.canUndo).toBe(false);
  });

  it("does not expose history after the session snapshot is consumed", () => {
    const history = createStudioHistory();
    expect(history.take()).toBeNull();
    history.capture(snapshot);
    history.clear();
    expect(history.take()).toBeNull();
  });

  it("restores redo state after undo", () => {
    const history = createStudioHistory();
    const first: StudioSnapshot = {
      ...snapshot,
      config: { ...snapshot.config, radius: "sharp" },
    };
    const second: StudioSnapshot = {
      ...snapshot,
      config: { ...snapshot.config, radius: "soft" },
    };

    history.record(first);
    expect(history.undo(second)).toEqual(first);
    expect(history.canRedo).toBe(true);
    expect(history.redo(first)).toEqual(second);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it("keeps only the most recent snapshots within the configured limit", () => {
    const history = createStudioHistory(2);
    const first: StudioSnapshot = {
      ...snapshot,
      config: { ...snapshot.config, radius: "sharp" },
    };
    const second: StudioSnapshot = {
      ...snapshot,
      config: { ...snapshot.config, radius: "soft" },
    };
    const third: StudioSnapshot = {
      ...snapshot,
      config: { ...snapshot.config, density: "compact" },
    };

    history.record(first);
    history.record(second);
    history.record(third);

    expect(history.take()).toEqual(third);
    expect(history.take()).toEqual(second);
    expect(history.take()).toBeNull();
  });
});
