import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerBlock,
  getBlock,
  getAllBlocks,
  getBlocksByCategory,
  createBlockInstance,
  validateBlockConfig,
  _resetRegistry,
} from "@/lib/block-registry";
import type { BlockDefinition } from "@/lib/page-blocks";

// Minimal block component for testing.
function TestComponent(_props: unknown) {
  return null;
}

const textBlock: BlockDefinition = {
  type: "text",
  category: "content",
  label: "Text",
  description: "A text block",
  icon: "Type",
  defaults: { content: "" },
  component: TestComponent,
};

const headingBlock: BlockDefinition = {
  type: "heading",
  category: "content",
  label: "Heading",
  description: "A heading block",
  icon: "Heading",
  defaults: { content: "", level: 2 },
  component: TestComponent,
};

const mediaBlock: BlockDefinition = {
  type: "image",
  category: "media",
  label: "Image",
  description: "An image block",
  icon: "Image",
  defaults: { src: "" },
  component: TestComponent,
};

describe("block-registry", () => {
  beforeEach(() => {
    _resetRegistry();
  });

  it("registers a block and retrieves it by type", () => {
    registerBlock(textBlock);
    expect(getBlock("text")).toBe(textBlock);
  });

  it("warns and skips when registering the same type twice", () => {
    registerBlock(textBlock);
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Should not throw — duplicate is a no-op with a console warning.
    expect(() => registerBlock(textBlock)).not.toThrow();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Block type "text" already registered'),
    );
    spy.mockRestore();
  });

  it("returns undefined for unregistered types", () => {
    expect(getBlock("nonexistent")).toBeUndefined();
  });

  it("returns all blocks sorted by category then label", () => {
    registerBlock(mediaBlock);
    registerBlock(headingBlock);
    registerBlock(textBlock);

    const all = getAllBlocks();
    expect(all).toHaveLength(3);
    // content comes before media alphabetically
    expect(all[0].type).toBe("heading");
    expect(all[1].type).toBe("text");
    expect(all[2].type).toBe("image");
  });

  it("filters blocks by category", () => {
    registerBlock(textBlock);
    registerBlock(mediaBlock);

    const content = getBlocksByCategory("content");
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("text");
  });

  it("createBlockInstance creates with defaults", () => {
    registerBlock(headingBlock);
    const instance = createBlockInstance("heading");
    expect(instance).toEqual({
      type: "heading",
      config: { content: "", level: 2 },
    });
  });

  it("createBlockInstance returns null for unregistered types", () => {
    expect(createBlockInstance("nonexistent")).toBeNull();
  });

  it("validateBlockConfig succeeds for registered types with object config", () => {
    registerBlock(textBlock);
    expect(validateBlockConfig("text", { content: "hello" })).toBe(true);
  });

  it("validateBlockConfig fails for unregistered types", () => {
    expect(validateBlockConfig("nonexistent", {})).toBe(false);
  });

  it("validateBlockConfig fails for non-object config", () => {
    registerBlock(textBlock);
    expect(validateBlockConfig("text", "string")).toBe(false);
    expect(validateBlockConfig("text", null)).toBe(false);
  });
});