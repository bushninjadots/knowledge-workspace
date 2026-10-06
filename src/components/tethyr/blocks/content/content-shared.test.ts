import { describe, expect, it } from "vitest";
import { listItems, safeHref, str } from "./content-shared";
import { blockTitleText, isBlockTitleHidden } from "../block-title";
import { blockTitleVars } from "@/lib/studio-config";

describe("safeHref", () => {
  it("keeps web links and adds a missing scheme", () => {
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("example.com")).toBe("https://example.com/");
  });
  it("turns an email address into a mailto link", () => {
    expect(safeHref("hi@example.com")).toBe("mailto:hi@example.com");
    expect(safeHref("mailto:hi@example.com")).toBe("mailto:hi@example.com");
  });
  it("refuses script and data URLs", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,hi")).toBeNull();
    expect(safeHref("   ")).toBeNull();
  });
});

describe("list and string config", () => {
  it("drops blank items and trims values", () => {
    expect(
      listItems(
        { items: [{ value: " 12 ", label: "" }, { value: "", label: "  " }, "x"] },
        "items",
      ),
    ).toEqual([{ value: "12", label: "" }]);
    expect(listItems({}, "items")).toEqual([]);
    expect(str({ a: "  hi " }, "a")).toBe("hi");
    expect(str({ a: 3 }, "a")).toBe("");
  });
});

describe("block titles", () => {
  it("uses the member's own title, else the block's", () => {
    expect(blockTitleText({ title: "  My work " }, "Projects")).toBe("My work");
    expect(blockTitleText({ title: "  " }, "Projects")).toBe("Projects");
  });
  it("honours a block's default visibility until the member sets one", () => {
    expect(isBlockTitleHidden({}, true)).toBe(true);
    expect(isBlockTitleHidden({ hideTitle: false }, true)).toBe(false);
    expect(isBlockTitleHidden({}, false)).toBe(false);
  });
  it("styles titles without var() references the canvas would resolve too early", () => {
    for (const style of ["label", "heading", "hidden"] as const) {
      for (const [key, value] of Object.entries(blockTitleVars(style))) {
        if (key !== "--bt-family") expect(value).not.toMatch(/var\(/);
      }
    }
    expect(blockTitleVars("hidden")["--bt-height"]).toBe("0px");
  });
});
