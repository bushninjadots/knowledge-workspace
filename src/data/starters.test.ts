// ── Studio Starters Tests ─────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { STARTERS, applyStarter, sectionMarker, starterConfig, starterMap } from "@/data/starters";
import { createDefaultProfileLayout } from "@/lib/default-layouts";
import { DEFAULT_STUDIO_CONFIG, type StudioConfig } from "@/lib/studio-config";

describe("STARTERS", () => {
  it("exposes exactly the five starters", () => {
    expect(STARTERS.map((s) => s.id)).toEqual([
      "focused",
      "editorial",
      "project-first",
      "minimal",
      "experimental",
    ]);
    expect(starterMap["focused"]).toBe(STARTERS[0]);
  });

  it("gives every starter a full config stamp, presentation, and sketch", () => {
    for (const starter of STARTERS) {
      expect(starter.name.length).toBeGreaterThan(0);
      expect(starter.tagline.length).toBeGreaterThan(0);
      expect(starter.feels.length).toBeGreaterThan(3);
      expect(starter.config.structure).toBeTruthy();
      expect(starter.config.personality).toBeTruthy();
      expect(starter.config.density).toBeTruthy();
      expect(starter.config.radius).toBeTruthy();
      expect(starter.config.appBackground).toBeTruthy();
      expect(starter.config.publicBackground).toBeTruthy();
      expect(["spotlight", "editorial-grid", "horizontal-scroll", "minimal-list"]).toContain(
        starter.presentation,
      );
      expect(starter.sketch.length).toBeGreaterThan(0);
    }
  });
});

describe("sectionMarker", () => {
  const layout = createDefaultProfileLayout();

  it("classifies a profile section by the block types it holds", () => {
    const sections = layout.sections;
    expect(sectionMarker(sections[0])).toBe("identity"); // profile-header
    expect(sectionMarker(sections[1])).toBe("projects"); // profile-projects
    expect(sectionMarker(sections[2])).toBe("bio"); // profile-bio
    expect(sectionMarker(sections[3])).toBe("skills"); // profile-skills
    expect(sectionMarker(sections[4])).toBe("gallery"); // profile-gallery
  });
});

describe("applyStarter", () => {
  const layout = createDefaultProfileLayout();

  it("is non-destructive: preserves every block id, type, and content config", () => {
    const starter = STARTERS[2]; // project-first
    const next = applyStarter(layout, starter);

    const original = layout.sections.flatMap((s) => s.blocks);
    const applied = next.sections.flatMap((s) => s.blocks);

    expect(applied).toHaveLength(original.length);
    for (const block of original) {
      const match = applied.find((b) => b.id === block.id);
      expect(match).toBeDefined();
      expect(match?.type).toBe(block.type);
      if (block.type === "profile-projects") {
        // A starter re-dresses the presentation but nothing else.
        const { presentation, ...content } = block.config;
        void presentation;
        expect(match?.config).toMatchObject(content);
      } else {
        expect(match?.config).toEqual(block.config);
      }
    }
  });

  it("reorders sections so project-first leads with the projects section", () => {
    const starter = starterMap["project-first"];
    const next = applyStarter(layout, starter);
    expect(sectionMarker(next.sections[0])).toBe("projects");
    expect(next.sections[0].position).toBe(0);
  });

  it("sets the projects presentation on every profile-projects block", () => {
    const starter = starterMap["minimal"]; // presentation: minimal-list
    const next = applyStarter(layout, starter);
    const projectsBlocks = next.sections.flatMap((s) =>
      s.blocks.filter((b) => b.type === "profile-projects"),
    );
    expect(projectsBlocks.length).toBeGreaterThan(0);
    for (const block of projectsBlocks) {
      expect(block.config.presentation).toBe("minimal-list");
    }
  });

  it("hides (never deletes) collapsed sections for the minimal starter", () => {
    const starter = starterMap["minimal"];
    const next = applyStarter(layout, starter);
    const hidden = next.sections.filter((s) => s.visible === false);
    for (const section of hidden) {
      const marker = sectionMarker(section);
      expect(marker && starter.collapsedSections.includes(marker)).toBe(true);
    }
    // Nothing was removed from the layout.
    expect(next.sections).toHaveLength(layout.sections.length);
  });

  it("keeps every section even when a starter does not name it in sectionOrder", () => {
    const starter = STARTERS[1]; // editorial
    const next = applyStarter(layout, starter);
    expect(next.sections.map((s) => s.id).sort()).toEqual(layout.sections.map((s) => s.id).sort());
  });
});

describe("starterConfig", () => {
  it("merges the starter stamp into the current config and records the starter id", () => {
    const current: StudioConfig = { ...DEFAULT_STUDIO_CONFIG };
    const next = starterConfig(starterMap["project-first"], current);
    expect(next.structure).toBe("wide");
    expect(next.personality).toBe("technical");
    expect(next.density).toBe("compact");
    expect(next.radius).toBe("sharp");
    expect(next.appBackground).toBe("sunken");
    expect(next.starterId).toBe("project-first");
    // Fields not in the stamp are untouched.
    expect(next.accentMode).toBe(current.accentMode);
    expect(next.accentColor).toBe(current.accentColor);
  });
});
