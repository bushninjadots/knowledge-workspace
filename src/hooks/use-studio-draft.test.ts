import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStudioDraft } from "@/hooks/use-studio-draft";
import type { BlockType, PageLayout, ThemeTokens } from "@/lib/page-blocks";

const layout = (blocks: string[]): PageLayout => ({
  sections: [
    {
      id: "sect-1",
      position: 0,
      layout: "full",
      blocks: blocks.map(
        (id, i): NonNullable<PageLayout["sections"][number]["blocks"]>[number] => ({
          id,
          type: "text" as BlockType,
          position: i,
          config: {},
          visible: true,
        }),
      ),
    },
  ],
});

describe("useStudioDraft theme-override save guard", () => {
  it("does NOT mark theme overrides dirty on layout-only edits (plain Save keeps them out of the DB)", () => {
    const { result } = renderHook(() => useStudioDraft(layout(["a"]), null));

    // Simulate an edit that only touches the layout, never the theme.
    act(() => result.current.apply(layout(["a", "b"])));

    expect(result.current.dirty).toBe(true);
    // This is the exact flag handleSave reads before persisting overrides — it
    // must stay false so a layout-only save never writes the merged theme.
    expect(result.current.overridesDirtyRef.current).toBe(false);
  });

  it("marks theme overrides dirty on a theme edit, then clears it on save", () => {
    const overrides: ThemeTokens = { colors: { primary: "#ff0000" } };
    const { result } = renderHook(() => useStudioDraft(layout(["a"]), null));

    act(() => result.current.updateOverrides(overrides));

    expect(result.current.overridesDirtyRef.current).toBe(true);
    expect(result.current.dirty).toBe(true);

    // After a successful save the flag is cleared so the next layout-only
    // save does not re-persist theme overrides.
    act(() => result.current.markSaved());
    expect(result.current.overridesDirtyRef.current).toBe(false);
    expect(result.current.dirty).toBe(false);
  });

  it("tracks overrides independently from the theme edit across undo", () => {
    const overrides: ThemeTokens = { colors: { background: "#000000" } };
    const { result } = renderHook(() => useStudioDraft(layout(["a"]), null));

    act(() => result.current.updateOverrides(overrides));
    expect(result.current.overridesDirtyRef.current).toBe(true);

    // A subsequent layout edit preserves the pending theme flag.
    act(() => result.current.apply(layout(["a", "b"])));
    expect(result.current.overridesDirtyRef.current).toBe(true);

    act(() => result.current.markSaved());
    expect(result.current.overridesDirtyRef.current).toBe(false);
  });
});

describe("useStudioDraft undo/redo staleness", () => {
  it("restores snapshots without stale closures after undo/redo + redo-tail truncation", () => {
    const { result } = renderHook(() => useStudioDraft(layout(["a"])));

    act(() => result.current.apply(layout(["a", "b"])));
    act(() => result.current.apply(layout(["a", "b", "c"])));
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    // Undo to the middle snapshot.
    act(() => result.current.undo());
    expect(result.current.layout.sections[0].blocks.map((b) => b.id)).toEqual(["a", "b"]);
    expect(result.current.canRedo).toBe(true);

    // A new edit while mid-history must truncate the redo tail.
    act(() => result.current.apply(layout(["a", "x"])));
    expect(result.current.canRedo).toBe(false);
    expect(result.current.layout.sections[0].blocks.map((b) => b.id)).toEqual(["a", "x"]);

    // Redo has nothing left to return to.
    act(() => result.current.redo());
    expect(result.current.layout.sections[0].blocks.map((b) => b.id)).toEqual(["a", "x"]);
  });

  it("reports dirty=false when undo returns exactly to the saved snapshot", () => {
    const { result } = renderHook(() => useStudioDraft(layout(["a"])));

    act(() => result.current.apply(layout(["a", "b"])));
    expect(result.current.dirty).toBe(true);

    // Undo back to the initial (saved) snapshot — clean, not false-dirty.
    act(() => result.current.undo());
    expect(result.current.layout.sections[0].blocks.map((b) => b.id)).toEqual(["a"]);
    expect(result.current.dirty).toBe(false);
  });
});

describe("useStudioDraft normalization", () => {
  it("reindexes section and block positions on apply", () => {
    const { result } = renderHook(() => useStudioDraft({ sections: [] }));

    const messy: PageLayout = {
      sections: [
        {
          id: "sect-1",
          position: 99,
          layout: "two_column",
          blocks: [
            { id: "b1", type: "text" as BlockType, position: 42, config: {}, visible: true },
            { id: "b2", type: "text" as BlockType, position: 7, config: {}, visible: true },
          ],
        },
      ],
    };
    act(() => result.current.apply(messy));

    const section = result.current.layout.sections[0];
    expect(section.position).toBe(0);
    expect(section.blocks.map((b) => b.position)).toEqual([0, 1]);
  });
});
