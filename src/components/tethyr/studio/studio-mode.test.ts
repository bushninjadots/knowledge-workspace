import { describe, expect, it } from "vitest";

describe("Studio mode language", () => {
  it("distinguishes editing from the public published view", () => {
    expect("Private draft").toBe("Private draft");
    expect("Public preview").toBe("Public preview");
    expect("Editing private draft · published version live").toContain("published version live");
  });
});
