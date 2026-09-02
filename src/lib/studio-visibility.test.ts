import { describe, expect, it } from "vitest";
import { shouldRenderSectionInView } from "@/lib/studio-visibility";
import type { LayoutSection } from "@/lib/page-blocks";

function section(blocks: LayoutSection["blocks"]): LayoutSection {
  return { id: "s1", position: 0, layout: "full", blocks };
}

function block(id: string, visible = true, type = "profile-gallery") {
  return { id, type, position: 0, config: {} as Record<string, unknown>, visible };
}

describe("shouldRenderSectionInView", () => {
  it("renders a section whose visible block has content", () => {
    const s = section([block("a")]);
    expect(shouldRenderSectionInView(s, new Set())).toBe(true);
    // A block reported empty should collapse it…
    expect(shouldRenderSectionInView(s, new Set(["a"]))).toBe(false);
  });

  it("renders when at least one visible block has content", () => {
    const s = section([block("empty"), block("present")]);
    expect(shouldRenderSectionInView(s, new Set(["empty"]))).toBe(true);
  });

  it("collapses when every visible block is empty", () => {
    const s = section([block("a"), block("b")]);
    expect(shouldRenderSectionInView(s, new Set(["a", "b"]))).toBe(false);
  });

  it("ignores hidden blocks when deciding emptiness", () => {
    // Only visible blocks matter: a fully-hidden section is also dropped even
    // with no reported empties (the layout already excludes it, but the view
    // predicate stays consistent).
    const s = section([block("a", false)]);
    expect(shouldRenderSectionInView(s, new Set())).toBe(false);
  });

  it("renders a section with a mix of hidden and present blocks", () => {
    const s = section([block("hidden", false), block("present", true)]);
    expect(shouldRenderSectionInView(s, new Set())).toBe(true);
  });
});
