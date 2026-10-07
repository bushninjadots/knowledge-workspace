import { describe, expect, it } from "vitest";
import {
  HISTORY_LIMIT,
  INITIAL_STUDIO_EDITOR_STATE,
  MERGE_WINDOW_MS,
  studioEditorReducer as reduce,
  type StudioEditorState,
} from "./studio-editor-state";
import { DEFAULT_STUDIO_CONFIG } from "./studio-config";
import type { PageLayout } from "./page-blocks";
import type { GStudioConfig } from "@/components/tethyr/studio/g-studio-surface";

const config = DEFAULT_STUDIO_CONFIG as GStudioConfig;
const layoutWith = (title: string): PageLayout => ({
  sections: [
    {
      id: "s1",
      layout: "full",
      position: 0,
      blocks: [{ id: "b1", type: "profile-bio", position: 0, visible: true, config: { title } }],
    },
  ],
});
const titleOf = (state: StudioEditorState) =>
  state.doc?.layout.sections[0]?.blocks[0]?.config.title;

function seeded(): StudioEditorState {
  return reduce(INITIAL_STUDIO_EDITOR_STATE, {
    type: "seed",
    layout: layoutWith("A"),
    config,
    themeId: null,
    arranged: [],
  });
}

describe("studio editor state", () => {
  it("seeds a clean document with no history", () => {
    const state = seeded();
    expect(titleOf(state)).toBe("A");
    expect(state.saved?.layout.sections[0]?.blocks[0]?.config.title).toBe("A");
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
  });

  it("records the state before each edit, and undo/redo mirror each other", () => {
    let state = seeded();
    state = reduce(state, { type: "edit", layout: layoutWith("B"), now: 0 });
    state = reduce(state, { type: "edit", layout: layoutWith("C"), now: 5000 });
    expect(state.past.map((d) => d.layout.sections[0]?.blocks[0]?.config.title)).toEqual([
      "A",
      "B",
    ]);
    state = reduce(state, { type: "undo" });
    expect(titleOf(state)).toBe("B");
    state = reduce(state, { type: "undo" });
    expect(titleOf(state)).toBe("A");
    expect(reduce(state, { type: "undo" })).toBe(state);
    state = reduce(state, { type: "redo" });
    state = reduce(state, { type: "redo" });
    expect(titleOf(state)).toBe("C");
    expect(state.future).toEqual([]);
  });

  it("merges rapid edits with the same key into one undo step", () => {
    let state = seeded();
    for (const [i, letter] of ["B", "Bo", "Bob"].entries()) {
      state = reduce(state, {
        type: "edit",
        layout: layoutWith(letter),
        mergeKey: "block:b1:config",
        now: i * 100,
      });
    }
    expect(state.past).toHaveLength(1);
    state = reduce(state, {
      type: "edit",
      layout: layoutWith("Bobby"),
      mergeKey: "block:b1:config",
      now: 200 + MERGE_WINDOW_MS,
    });
    expect(state.past).toHaveLength(2);
    expect(titleOf(reduce(state, { type: "undo" }))).toBe("Bob");
  });

  it("a new edit clears redo", () => {
    let state = seeded();
    state = reduce(state, { type: "edit", layout: layoutWith("B"), now: 0 });
    state = reduce(state, { type: "undo" });
    expect(state.future).toHaveLength(1);
    state = reduce(state, { type: "edit", layout: layoutWith("X"), now: 5000 });
    expect(state.future).toEqual([]);
  });

  it(`keeps at most ${HISTORY_LIMIT} steps`, () => {
    let state = seeded();
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      state = reduce(state, { type: "edit", layout: layoutWith(`v${i}`), now: i * 5000 });
    }
    expect(state.past).toHaveLength(HISTORY_LIMIT);
  });

  it("undo puts back the theme, borders and arranged areas too", () => {
    let state = seeded();
    state = reduce(state, {
      type: "edit",
      themeId: "t1",
      borders: { cardBorders: "accent", cardBorderColor: "" },
      arranged: ["s1"],
      now: 0,
    });
    expect(state.doc?.themeId).toBe("t1");
    state = reduce(state, { type: "undo" });
    expect(state.doc?.themeId).toBeNull();
    expect(state.doc?.borders.cardBorders).toBe("neutral");
    // The area was marked arranged before the edit, so the step keeps it.
    expect(state.doc?.arranged).toEqual(["s1"]);
  });

  it("a drag is one step: checkpoint, then silent adjustments", () => {
    let state = seeded();
    state = reduce(state, { type: "checkpoint", now: 0 });
    state = reduce(state, { type: "adjust", update: () => layoutWith("drag 1") });
    state = reduce(state, { type: "adjust", update: () => layoutWith("drag 2") });
    expect(state.past).toHaveLength(1);
    expect(titleOf(reduce(state, { type: "undo" }))).toBe("A");
    expect(reduce(state, { type: "adjust", update: () => null })).toBe(state);
  });

  it("fitting heights changes working and saved layouts alike, with no undo step", () => {
    const state = reduce(seeded(), {
      type: "fit",
      sectionId: "s1",
      grid: [],
      apply: (layout) => ({
        ...layout,
        sections: layout.sections.map((s) => ({ ...s, grid: [] })),
      }),
    });
    expect(state.doc?.layout.sections[0]?.grid).toEqual([]);
    expect(state.saved?.layout.sections[0]?.grid).toEqual([]);
    expect(state.past).toEqual([]);
  });

  it("saving moves the baseline", () => {
    let state = reduce(seeded(), { type: "edit", layout: layoutWith("B"), now: 0 });
    state = reduce(state, { type: "saved", layout: state.doc!.layout, config });
    expect(state.saved?.layout.sections[0]?.blocks[0]?.config.title).toBe("B");
  });

  it("a restore can be undone through the carried step", () => {
    const before = seeded();
    const restored = reduce(before, {
      type: "seed",
      layout: layoutWith("restored"),
      config,
      themeId: null,
      arranged: [],
      carry: before.doc!,
    });
    expect(titleOf(restored)).toBe("restored");
    expect(titleOf(reduce(restored, { type: "undo" }))).toBe("A");
  });

  it("keeps card borders read before the page loaded", () => {
    let state = reduce(INITIAL_STUDIO_EDITOR_STATE, {
      type: "seedBorders",
      borders: { cardBorders: "custom", cardBorderColor: "#123456" },
    });
    state = reduce(state, {
      type: "seed",
      layout: layoutWith("A"),
      config,
      themeId: null,
      arranged: [],
    });
    expect(state.doc?.borders).toEqual({ cardBorders: "custom", cardBorderColor: "#123456" });
  });
});
