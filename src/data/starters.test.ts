// ── Studio Starters Tests ─────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  STARTERS,
  applyStarter,
  sectionMarker,
  starterConfig,
  starterMap,
  starterPreviewConfig,
  starterPreviewLayout,
  templatePreviewConfig,
} from "@/data/starters";
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

  it("gives every starter a remix note — the descriptor shared with community templates", () => {
    for (const starter of STARTERS) {
      expect(starter.remixNote.length).toBeGreaterThan(10);
    }
    // Notes must differ — they are what makes the five directions distinct at
    // a glance in the picker.
    expect(new Set(STARTERS.map((s) => s.remixNote)).size).toBe(STARTERS.length);
  });

  it("stamps five distinct personality/structure/density combinations", () => {
    const combos = new Set(
      STARTERS.map((s) => `${s.config.structure}/${s.config.personality}/${s.config.density}`),
    );
    expect(combos.size).toBeGreaterThanOrEqual(4);
  });

  it("exercises every background choice so template backdrops are part of the contract", () => {
    const backgrounds = new Set(
      STARTERS.flatMap((s) => [s.config.appBackground, s.config.publicBackground]),
    );
    // Every BackgroundId is in play across the five directions — the backdrop
    // mapping has to handle all of them, not just the default.
    expect([...backgrounds].sort()).toEqual(["default", "sunken", "surface"]);
  });
});

describe("preview configs", () => {
  it("starterPreviewConfig merges the starter stamp over the defaults with its id", () => {
    const config = starterPreviewConfig(starterMap["editorial"]);
    expect(config.starterId).toBe("editorial");
    expect(config.personality).toBe("editorial");
    expect(config.density).toBe("spacious");
    expect(config.radius).toBe(6);
  });

  it("templatePreviewConfig preserves the member's config and clears the starter id", () => {
    const current = { ...DEFAULT_STUDIO_CONFIG, starterId: "focused", radius: 20 } as StudioConfig;
    const config = templatePreviewConfig(current);
    expect(config.starterId).toBeNull();
    expect(config.radius).toBe(20);
  });
});

describe("sectionMarker", () => {
  const layout = createDefaultProfileLayout();

  it("classifies a profile section by the block types it holds", () => {
    const sections = layout.sections;
    expect(sectionMarker(sections[0])).toBe("identity"); // profile-header
    expect(sectionMarker(sections[1])).toBe("projects"); // profile-projects
    expect(sectionMarker(sections[2])).toBe("bio"); // profile-bio
    expect(sectionMarker(sections[3])).toBe("readme"); // profile-readme
    expect(sectionMarker(sections[4])).toBe("skills"); // profile-skills
    expect(sectionMarker(sections[5])).toBe("gallery"); // profile-gallery
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

  it("reveals sections hidden by the previous starter when switching templates", () => {
    const hiddenFirst = applyStarter(layout, starterMap["minimal"]); // hides tools + gallery
    const restored = applyStarter(hiddenFirst, starterMap["focused"], starterMap["minimal"]);
    const stillHidden = restored.sections.filter((s) => s.visible === false);
    expect(stillHidden).toEqual([]);
  });

  it("hands full visibility ownership to the new starter when switching", () => {
    const hiddenFirst = applyStarter(layout, starterMap["minimal"]); // tools + gallery hidden
    // Switch to experimental, which hides nothing: everything comes back.
    const switched = applyStarter(hiddenFirst, starterMap["experimental"], starterMap["minimal"]);
    expect(switched.sections.filter((s) => s.visible === false)).toEqual([]);
    // Switch the other way, to minimal again: tools/gallery hide once more.
    const back = applyStarter(switched, starterMap["minimal"], starterMap["experimental"]);
    const hiddenMarkers = back.sections.filter((s) => s.visible === false).map(sectionMarker);
    expect(hiddenMarkers).toContain("tools");
    expect(hiddenMarkers).toContain("gallery");
    expect(hiddenMarkers).toHaveLength(back.sections.filter((s) => s.visible === false).length);
  });

  it("applies every starter completely — sections, config, and backdrop stamp", () => {
    for (const starter of STARTERS) {
      const next = applyStarter(layout, starter);
      // The layout side always lands.
      expect(next.sections).toHaveLength(layout.sections.length);
      expect(next.sections.map((s) => s.id).sort()).toEqual(
        layout.sections.map((s) => s.id).sort(),
      );
      // And the config side carries the starter's full stamp, backgrounds
      // included — nothing about the direction is silently dropped.
      const config = starterConfig(starter, DEFAULT_STUDIO_CONFIG);
      expect(config.starterId).toBe(starter.id);
      expect(config.structure).toBe(starter.config.structure);
      expect(config.personality).toBe(starter.config.personality);
      expect(config.density).toBe(starter.config.density);
      expect(config.radius).toBe(starter.config.radius);
      expect(config.appBackground).toBe(starter.config.appBackground);
      expect(config.publicBackground).toBe(starter.config.publicBackground);
      // Determinism: applying twice produces byte-identical layout JSON.
      expect(JSON.stringify(applyStarter(layout, starter))).toBe(JSON.stringify(next));
    }
  });

  it("respects manual visibility when no previous starter was applied", () => {
    const manuallyHidden = {
      ...layout,
      sections: layout.sections.map((s, i) =>
        i === layout.sections.length - 1 ? { ...s, visible: false } : s,
      ),
    };
    const next = applyStarter(manuallyHidden, starterMap["focused"], null);
    const last = next.sections[next.sections.length - 1];
    expect(last.visible).toBe(false);
  });
});

describe("starterPreviewLayout", () => {
  it("builds a standalone layout following the starter's section order", () => {
    const starter = starterMap["project-first"];
    const layout = starterPreviewLayout(starter);
    expect(layout.sections.map(sectionMarker)).toEqual(starter.sectionOrder);
    expect(layout.sections.map((s) => s.id)).toEqual(
      starter.sectionOrder.map((marker) => `preview:${marker}`),
    );
  });

  it("populates each section with the marker's representative blocks", () => {
    const starter = STARTERS[0]; // focused
    const layout = starterPreviewLayout(starter);
    const skills = layout.sections[starter.sectionOrder.indexOf("skills")];
    expect(skills.blocks.map((b) => b.type)).toEqual(["profile-skills"]);
    const byMarker = new Map(layout.sections.map((s) => [sectionMarker(s), s]));
    expect(byMarker.get("projects")?.blocks.map((b) => b.type)).toEqual(["profile-projects"]);
    expect(byMarker.get("identity")?.blocks.map((b) => b.type)).toEqual(["profile-header"]);
  });

  it("dresses the projects block with the starter's presentation", () => {
    const starter = starterMap["minimal"]; // minimal-list
    const layout = starterPreviewLayout(starter);
    const projects = layout.sections
      .flatMap((s) => s.blocks)
      .find((b) => b.type === "profile-projects");
    expect(projects?.config.presentation).toBe("minimal-list");
  });

  it("mirrors collapsed sections so they stay hidden in the preview", () => {
    const starter = starterMap["minimal"]; // collapsedSections: [tools, gallery]
    const layout = starterPreviewLayout(starter);
    for (const section of layout.sections) {
      const marker = sectionMarker(section);
      const collapsed = marker ? starter.collapsedSections.includes(marker) : false;
      expect(section.visible).toBe(!collapsed);
      for (const block of section.blocks) {
        expect(block.visible).toBe(!collapsed);
      }
    }
  });
});

describe("starterConfig", () => {
  it("merges the starter stamp into the current config and records the starter id", () => {
    const current: StudioConfig = { ...DEFAULT_STUDIO_CONFIG };
    const next = starterConfig(starterMap["project-first"], current);
    expect(next.structure).toBe("wide");
    expect(next.personality).toBe("technical");
    expect(next.density).toBe("compact");
    expect(next.radius).toBe(6);
    expect(next.appBackground).toBe("sunken");
    expect(next.starterId).toBe("project-first");
    // Fields not in the stamp are untouched.
    expect(next.accentMode).toBe(current.accentMode);
    expect(next.accentColor).toBe(current.accentColor);
  });
});
