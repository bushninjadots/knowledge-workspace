import { describe, expect, it } from "vitest";
import { blockMarkdownToHtml } from "./block-markdown";

describe("blockMarkdownToHtml", () => {
  it("renders headings, bold, italic, and code", () => {
    const html = blockMarkdownToHtml("# Title\n\nSome **bold** and *italic* and `code`.");
    expect(html).toContain("<h1");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain(">code</code>");
  });

  it("renders safe links and images", () => {
    const html = blockMarkdownToHtml("[Tethyr](https://tethyr.app) ![cover](/cover.png)");
    expect(html).toContain('<a href="https://tethyr.app"');
    expect(html).toContain('<img src="/cover.png"');
  });

  it("escapes raw HTML", () => {
    const html = blockMarkdownToHtml("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("blocks javascript: URLs on links", () => {
    const html = blockMarkdownToHtml("[click](javascript:location.href='//evil.example')");
    expect(html).not.toContain("javascript:");
    // The markdown text stays, escaped, as a plain paragraph — no anchor.
    expect(html).toContain("click");
    expect(html).not.toContain("<a ");
  });

  it("blocks javascript: URLs on images", () => {
    const html = blockMarkdownToHtml("![x](javascript:alert(1)//)");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<img ");
  });

  it("prevents attribute breakout via unescaped quotes", () => {
    const html = blockMarkdownToHtml('[hover](a" onmouseover="location.href=location.href//)');
    // The broken URL is rejected outright — the link degrades to plain text
    // and the injected attribute never reaches the DOM.
    expect(html).not.toContain("onmouseover=");
    expect(html).not.toContain('<a href="a"');
    expect(html).not.toContain("&quot;");
    expect(html).toContain(">hover</p>");
  });

  it("blocks non-http URL schemes", () => {
    const html = blockMarkdownToHtml(
      "[data](data:text/html,<script>alert(1)</script>) [vb](vbscript:alert(1)) [ftp](ftp://example.com/file)",
    );
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("data:");
    expect(html).not.toContain("vbscript:");
    expect(html).not.toContain("ftp:");
  });

  it("blocks unsafe schemes with whitespace and mixed casing", () => {
    const html = blockMarkdownToHtml(
      "[one]( JavaScript:alert(1)) [two](java\nscript:alert(1)) [three](data:text/html,payload)",
    );
    expect(html).not.toContain("<a ");
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toContain("data:");
  });

  it("escapes image alt text and rejects image attribute injection", () => {
    const html = blockMarkdownToHtml("![alt](https://tethyr.app/image.png)");
    const injectedHtml = blockMarkdownToHtml(
      '![alt](https://tethyr.app/image.png" onerror="alert(1))',
    );
    expect(html).toContain('<img src="https://tethyr.app/image.png"');
    expect(injectedHtml).not.toContain('onerror="');
  });

  it("escapes quotes in visible markdown text", () => {
    const html = blockMarkdownToHtml("Say \"hello\" and 'welcome'.");
    expect(html).toContain("&quot;hello&quot;");
    expect(html).toContain("&#39;welcome&#39;");
  });

  it("keeps mailto and relative links", () => {
    const html = blockMarkdownToHtml(
      "[mail](mailto:hi@tethyr.app) [rel](../docs/readme) [#top](#top)",
    );
    expect(html).toContain('href="mailto:hi@tethyr.app"');
    expect(html).toContain('href="../docs/readme"');
    expect(html).toContain('href="#top"');
  });

  it("renders images before links so ![alt](src) is not consumed by the link rule", () => {
    const html = blockMarkdownToHtml("![alt text](https://tethyr.app/cover.png)");
    expect(html).toContain("<img ");
    expect(html).not.toContain("!<a ");
  });

  it("keeps formatting markup out of link and image URLs", () => {
    const html = blockMarkdownToHtml("[a](https://ex.com/*x*/) ![b](https://ex.com/**y**.png)");
    expect(html).toContain('href="https://ex.com/*x*/"');
    expect(html).toContain('src="https://ex.com/**y**.png"');
    expect(html).not.toContain("<em>");
    expect(html).not.toContain("<strong>");
  });

  it("does not let a backtick in a URL close the href attribute", () => {
    const html = blockMarkdownToHtml("[a](https://ex.com/`x`) and `code`");
    expect(html).toContain('href="https://ex.com/`x`"');
    expect(html).toContain(">code</code>");
    expect(html.match(/<code/g)).toHaveLength(1);
  });

  it("leaves code bodies unformatted but still formats link text", () => {
    const html = blockMarkdownToHtml("`a *b* c`\n\n[**bold**](https://ex.com)");
    expect(html).toContain(">a *b* c</code>");
    expect(html).toContain("<strong>bold</strong></a>");
  });

  it("strips placeholder delimiter characters from input", () => {
    const html = blockMarkdownToHtml("x\uE0000\uE001y `z`");
    expect(html).not.toMatch(/[\uE000\uE001]/);
    expect(html).toContain("x0y");
  });

  it("groups list items into one list without line breaks between them", () => {
    const html = blockMarkdownToHtml("Intro\n\n- one\n- two\n- three\n\nAfter");
    expect(html.match(/<ul/g)).toHaveLength(1);
    expect(html.match(/<li/g)).toHaveLength(3);
    expect(html).not.toMatch(/<\/li><br \/>/);
    expect(html).toContain("After");
    // The blank line after the list is still a paragraph break, not a <br />.
    expect(html).not.toMatch(/<\/ul><br \/>/);
  });
});
