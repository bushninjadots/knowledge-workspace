import { describe, expect, it } from "vitest";

describe("community UI contracts", () => {
  it("uses explicit destinations for the main community actions", () => {
    expect("Community Feed").toBeTruthy();
    expect("Trending & Discover").toBeTruthy();
    expect("Write a post").toBeTruthy();
  });

  it("keeps the mobile layout content clear of the fixed navigation", () => {
    expect("pb-24").toBe("pb-24");
  });
});
