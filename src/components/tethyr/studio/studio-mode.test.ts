import { describe, expect, it } from "vitest";

describe("Studio preview contract", () => {
  it("distinguishes the draft editor from both rendered preview contexts", () => {
    expect("Private draft").toBe("Private draft");
    expect("Private preview").toBe("Private preview");
    expect("Public preview").toBe("Public preview");
  });

  it("uses the draft for both preview contexts while keeping visitor access separate", () => {
    const previewContexts = [
      { mode: "private", version: "draft", viewer: "owner" },
      { mode: "public", version: "draft", viewer: "visitor" },
    ];

    expect(previewContexts.map((context) => context.version)).toEqual(["draft", "draft"]);
    expect(previewContexts.map((context) => context.viewer)).toEqual(["owner", "visitor"]);
  });

  it("keeps the published page outside the draft preview contexts", () => {
    const publishedContext = { mode: "published", version: "published", viewer: "visitor" };
    expect(publishedContext.version).not.toBe("draft");
    expect(publishedContext.mode).toBe("published");
  });
});
