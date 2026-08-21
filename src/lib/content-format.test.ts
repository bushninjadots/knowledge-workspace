import { describe, it, expect } from "vitest";
import { htmlToMarkdown, markdownToHtml } from "./content-format";

describe("htmlToMarkdown", () => {
  it("converts headings, emphasis, and links", () => {
    const md = htmlToMarkdown(
      '<h1>Title</h1><p>Some <strong>bold</strong> <a href="https://x.y">link</a></p>',
    );
    expect(md).toContain("# Title");
    expect(md).toContain("**bold**");
    expect(md).toContain("[link](https://x.y)");
  });

  it("preserves fenced code blocks with their language", () => {
    const md = htmlToMarkdown('<pre><code class="language-python">print("hi")</code></pre>');
    expect(md).toContain("```python");
    expect(md).toContain('print("hi")');
  });
});

describe("markdownToHtml", () => {
  it("converts markdown back to HTML elements", () => {
    const html = markdownToHtml("# Title\n\nSome **bold** text.");
    expect(html).toMatch(/<h1>/);
    expect(html).toMatch(/<strong>bold<\/strong>/);
  });

  it("round-trips through both converters", () => {
    const original = "<h2>Plan</h2><ul><li>one</li><li>two</li></ul>";
    const roundTripped = markdownToHtml(htmlToMarkdown(original));
    expect(roundTripped).toMatch(/<h2>Plan<\/h2>/);
    // Tiptap renders list item text wrapped in a paragraph.
    expect(roundTripped).toMatch(/<li><p>one<\/p><\/li>/);
  });
});
