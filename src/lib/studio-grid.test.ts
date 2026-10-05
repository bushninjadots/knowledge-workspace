import { describe, expect, it } from "vitest";
import type { LayoutSection } from "@/lib/page-blocks";
import { sectionLabel } from "./studio-grid";

const section = (patch: Partial<LayoutSection>) =>
  ({ id: "s1", layout: "full", blocks: [], ...patch }) as LayoutSection;

describe("sectionLabel", () => {
  it("uses the section's own title", () => {
    expect(sectionLabel(section({ title: "Featured Work" }))).toBe("Featured Work");
  });

  it("names untitled sections in words, never by layout id", () => {
    expect(sectionLabel(section({ layout: "feature" }))).toBe("Featured area");
    expect(sectionLabel(section({ layout: "two_column" }))).toBe("Two-column area");
  });

  it("treats a blank title as untitled", () => {
    expect(sectionLabel(section({ title: "   ", layout: "full" }))).toBe("Full-width area");
  });
});
