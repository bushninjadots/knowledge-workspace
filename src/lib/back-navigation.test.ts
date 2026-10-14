import { describe, expect, it } from "vitest";
import { backFallback, showsBack } from "./back-navigation";

describe("back navigation", () => {
  it("shows Back on detail pages and never on hubs", () => {
    for (const hub of ["/", "/dashboard", "/skills", "/community", "/library"]) {
      expect(showsBack(hub)).toBe(false);
    }
    for (const detail of ["/projects/1", "/u/sam", "/spaces/x/settings", "/library/shared/1"]) {
      expect(showsBack(detail)).toBe(true);
    }
  });

  it("falls back to the section's hub", () => {
    expect(backFallback("/projects/1")).toBe("/explore");
    expect(backFallback("/u/sam")).toBe("/explore");
    expect(backFallback("/challenges/7")).toBe("/challenges");
    expect(backFallback("/spaces/x/reports")).toBe("/community");
    expect(backFallback("/library/shared/1")).toBe("/");
    expect(backFallback("/library/9")).toBe("/library");
    expect(backFallback("/unknown/9")).toBe("/");
  });
});
