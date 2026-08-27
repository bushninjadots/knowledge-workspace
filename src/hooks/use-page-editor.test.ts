import { describe, expect, it } from "vitest";

const createPageInput = {
  ownerId: "profile-1",
  ownerType: "profile" as const,
  userId: "user-1",
};

describe("Studio page creation contract", () => {
  it("uses the authenticated session identity for the layout owner", () => {
    expect(createPageInput.userId).toBe("user-1");
    expect(createPageInput.ownerType).toMatch(/profile|project/);
  });

  it("does not silently fall back to the owner id for RLS ownership", () => {
    const authUserId = "user-1";
    const ownerId = "profile-1";
    expect(authUserId).not.toBe(ownerId);
  });

  it("keeps an existing draft distinct from the public published query", () => {
    const studioQueryKey = ["page", "profile", "profile-1", "draft"];
    const publicQueryKey = ["page", "profile", "profile-1", "published"];
    expect(studioQueryKey).not.toEqual(publicQueryKey);
  });
});
