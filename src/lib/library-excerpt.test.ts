import { describe, it, expect } from "vitest";
import { getItemExcerpt } from "./library-excerpt";

describe("getItemExcerpt", () => {
  it("strips HTML tags for html items", () => {
    expect(getItemExcerpt("<p>Hello <b>world</b></p>", "html")).toBe("Hello world");
  });

  it("strips common markdown markers for markdown items", () => {
    const md = "# Title\n\nSome **bold** and _italic_ text with `code`.";
    expect(getItemExcerpt(md, "markdown")).toBe("Title Some bold and italic text with code.");
  });

  it("flattens markdown links and images to their text/src", () => {
    expect(getItemExcerpt("See [docs](https://x.y) now", "markdown")).toBe("See docs now");
    expect(getItemExcerpt("![logo](img.png)", "markdown")).toBe("logo");
  });

  it("ignores fenced code block markers", () => {
    const md = "Intro\n\n```js\nconst x = 1;\n```\n\nOutro";
    const out = getItemExcerpt(md, "markdown");
    expect(out).not.toContain("```");
    expect(out).toContain("Intro");
    expect(out).toContain("Outro");
  });

  it("truncates to 120 chars with an ellipsis", () => {
    const out = getItemExcerpt("a".repeat(300), "html");
    expect(out.length).toBe(121);
    expect(out.endsWith("…")).toBe(true);
  });

  it("returns empty string for empty content", () => {
    expect(getItemExcerpt("", "markdown")).toBe("");
  });
});
