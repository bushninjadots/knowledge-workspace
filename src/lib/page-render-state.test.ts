import { describe, expect, it } from "vitest";

type PageStatus = "draft" | "published";

function resolvePageState({
  isOwner,
  previewMode,
}: {
  isOwner: boolean;
  previewMode?: "private" | "public";
}): { includeDraft: boolean; renderState: PageStatus } {
  const isPreview = previewMode === "private" || previewMode === "public";
  return {
    includeDraft: isPreview && isOwner,
    renderState: isPreview && isOwner ? "draft" : "published",
  };
}

describe("page render state", () => {
  it("keeps the normal owner route published-only", () => {
    expect(resolvePageState({ isOwner: true })).toEqual({
      includeDraft: false,
      renderState: "published",
    });
  });

  it("uses the draft only for an owner preview", () => {
    expect(resolvePageState({ isOwner: true, previewMode: "private" })).toEqual({
      includeDraft: true,
      renderState: "draft",
    });
    expect(resolvePageState({ isOwner: true, previewMode: "public" })).toEqual({
      includeDraft: true,
      renderState: "draft",
    });
  });

  it("does not grant draft access to non-owners", () => {
    expect(resolvePageState({ isOwner: false, previewMode: "private" })).toEqual({
      includeDraft: false,
      renderState: "published",
    });
  });
});
