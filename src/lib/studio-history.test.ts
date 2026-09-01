import { describe, expect, it } from "vitest";
import { createStudioHistory } from "./studio-history";

const snapshot = { layout: { sections: [] }, config: { radius: "soft" } } as never;

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
});
