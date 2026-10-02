import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isDefinitelyEmptyBlock, shouldRenderSectionInView } from "@/lib/studio-visibility";
import { registerBlock, _resetRegistry } from "@/lib/block-registry";
import type { LayoutBlockInstance, LayoutSection } from "@/lib/page-blocks";

function section(blocks: LayoutSection["blocks"]): LayoutSection {
  return { id: "s1", position: 0, layout: "full", blocks };
}

function block(
  id: string,
  visible = true,
  type = "profile-gallery",
  config: Record<string, unknown> = {},
): LayoutBlockInstance {
  return { id, type, position: 0, config, visible };
}

describe("isDefinitelyEmptyBlock", () => {
  beforeEach(() => {
    _resetRegistry();
    // Minimal stand-ins for the two content-source families.
    registerBlock({
      type: "text",
      category: "content",
      label: "Text",
      description: "",
      icon: "Type",
      defaults: { content: "" },
      contentSource: "config",
      component: () => null,
    });
    registerBlock({
      type: "profile-bio",
      category: "content",
      label: "Bio",
      description: "",
      icon: "User",
      defaults: {},
      component: () => null,
    });
  });

  afterEach(() => {
    _resetRegistry();
  });

  it("classifies a config-driven block with empty config as empty", () => {
    expect(isDefinitelyEmptyBlock(block("a", true, "text"))).toBe(true);
  });

  it("classifies a config-driven block with blank content as empty", () => {
    expect(isDefinitelyEmptyBlock(block("a", true, "text", { content: "   " }))).toBe(true);
  });

  it("keeps a config-driven block with content", () => {
    expect(isDefinitelyEmptyBlock(block("a", true, "text", { content: "Hello" }))).toBe(false);
  });

  it("never statically classifies a data-driven block, even with empty config", () => {
    // profile-bio reads DB content and reports emptiness at runtime — an
    // empty config says nothing about whether the block will render content.
    expect(isDefinitelyEmptyBlock(block("a", true, "profile-bio"))).toBe(false);
  });

  it("fails open for unregistered block types", () => {
    expect(isDefinitelyEmptyBlock(block("a", true, "mystery-block"))).toBe(false);
  });
});

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
