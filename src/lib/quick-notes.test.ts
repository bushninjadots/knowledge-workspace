import { describe, expect, it } from "vitest";
import {
  formatFileSize,
  itemKind,
  linkFallbackTitle,
  noteToHtml,
  parseQuickLink,
  quickNoteFromText,
} from "./quick-notes";

describe("quickNoteFromText", () => {
  it("uses the first line as the title and the rest as paragraphs", () => {
    expect(quickNoteFromText("Ideas\nDark mode\nfor <all>\n\nShip Friday")).toEqual({
      title: "Ideas",
      content: "<p>Dark mode<br>for &lt;all&gt;</p><p>Ship Friday</p>",
    });
  });

  it("is just a title for a one-liner", () => {
    expect(quickNoteFromText("  call Sam about the API  ")).toEqual({
      title: "call Sam about the API",
      content: "",
    });
  });

  it("shortens a long first line and keeps it whole in the body", () => {
    const long = "a".repeat(100);
    const note = quickNoteFromText(long);
    expect(note.title).toHaveLength(80);
    expect(note.title.endsWith("…")).toBe(true);
    expect(note.content).toBe(`<p>${long}</p>`);
  });
});

describe("itemKind", () => {
  it("names uploads by their type", () => {
    expect(itemKind({ type: "upload", file_type: "image/png" })).toBe("image");
    expect(itemKind({ type: "upload", file_type: "video/mp4" })).toBe("video");
    expect(itemKind({ type: "document", file_type: "application/pdf" })).toBe("file");
    expect(itemKind({ type: "note", file_type: null })).toBe("note");
    expect(itemKind({ type: "link", file_type: null })).toBe("link");
  });

  it("formats sizes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatFileSize(null)).toBe("");
  });
});

describe("parseQuickLink", () => {
  it("reads a link on the first line and the note under it", () => {
    expect(parseQuickLink("https://react.dev/learn\nread the effects page")).toEqual({
      url: "https://react.dev/learn",
      note: "read the effects page",
    });
    expect(parseQuickLink("  http://example.com  ")).toEqual({
      url: "http://example.com/",
      note: "",
    });
  });

  it("ignores text, links inside sentences and other schemes", () => {
    expect(parseQuickLink("see https://react.dev")).toBeNull();
    expect(parseQuickLink("javascript:alert(1)")).toBeNull();
    expect(parseQuickLink("ftp://x.org/file")).toBeNull();
    expect(parseQuickLink("just a note")).toBeNull();
  });

  it("titles a link by host and path when the page can't be read", () => {
    expect(linkFallbackTitle("https://www.github.com/acme/repo/")).toBe("github.com/acme/repo");
    expect(noteToHtml("a <b>\n\nc")).toBe("<p>a &lt;b&gt;</p><p>c</p>");
  });
});
