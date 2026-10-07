// ── Layout template tests ────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import "@/components/tethyr/blocks/register-all";
import type { LayoutGridItem, PageLayout } from "@/lib/page-blocks";
import {
  LAYOUT_FAMILIES,
  STARTERS,
  applyStarter,
  sectionMarker,
  starterConfig,
  starterMap,
  starterPreviewConfig,
  starterSketch,
  templatePreviewConfig,
} from "@/data/starters";
import { createDefaultProfileLayout } from "@/lib/default-layouts";
import { composeLayout } from "@/lib/layout-compose";
import {
  DEFAULT_STUDIO_CONFIG,
  normalizeStudioConfig,
  type StudioConfig,
} from "@/lib/studio-config";
import { chooseVisualLanguage } from "@/lib/visual-language";

const blocksOf = (layout: PageLayout) => layout.sections.flatMap((s) => s.blocks);
const overlaps = (a: LayoutGridItem, b: LayoutGridItem) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("the layout catalogue", () => {
  it("offers distinct compositions in every family", () => {
    expect(STARTERS.length).toBeGreaterThanOrEqual(12);
    for (const family of LAYOUT_FAMILIES) {
      expect(STARTERS.some((starter) => starter.family === family)).toBe(true);
    }
    const shapes = STARTERS.map((starter) => JSON.stringify(starterSketch(starter)));
    expect(new Set(shapes).size).toBe(STARTERS.length);
  });

  it("describes each layout by what it does, not its columns", () => {
    for (const starter of STARTERS) {
      expect(starter.feels.length).toBeGreaterThan(40);
      expect(starter.feels).not.toMatch(/\bcolumns?\b.*\blayout\b/i);
      expect(starter.remixNote).toMatch(/^For /);
    }
  });

  it("keeps every width inside the 12-column grid", () => {
    for (const starter of STARTERS) {
      for (const area of starter.composition.areas) {
        for (const row of area.rows) {
          const fixed = row.length === 1 && row[0].x !== undefined;
          const total = row.reduce((sum, slot) => sum + slot.w, fixed ? (row[0].x ?? 0) : 0);
          expect(total, `${starter.id}/${area.key}`).toBeLessThanOrEqual(12);
        }
      }
    }
  });
});

describe("applying a layout", () => {
  const layout = createDefaultProfileLayout();

  it("never deletes, duplicates or edits a block", () => {
    for (const starter of STARTERS) {
      const next = applyStarter(layout, starter);
      const before = blocksOf(layout);
      const after = blocksOf(next).filter((b) => !b.id.startsWith(`block-${starter.id}-`));
      expect(after.map((b) => b.id).sort(), starter.id).toEqual(before.map((b) => b.id).sort());
      for (const block of before) {
        const match = after.find((b) => b.id === block.id)!;
        const { presentation: _p, ...content } = match.config;
        const { presentation: _q, ...original } = block.config;
        expect(content).toEqual(original);
        expect(match.visible).toBe(block.visible);
      }
    }
  });

  it("writes real, non-overlapping grid positions for every block", () => {
    for (const starter of STARTERS) {
      for (const section of applyStarter(layout, starter).sections) {
        const grid = section.grid ?? [];
        expect(grid.map((item) => item.i).sort()).toEqual(section.blocks.map((b) => b.id).sort());
        for (const item of grid) {
          expect(item.x + item.w, `${starter.id}`).toBeLessThanOrEqual(12);
          for (const other of grid) if (other !== item) expect(overlaps(item, other)).toBe(false);
        }
      }
    }
  });

  it("composes differently from one layout to the next", () => {
    const signature = (next: PageLayout) =>
      JSON.stringify(next.sections.map((s) => (s.grid ?? []).map((g) => [g.x, g.w])));
    const results = STARTERS.map((starter) => signature(applyStarter(layout, starter)));
    expect(new Set(results).size).toBeGreaterThanOrEqual(STARTERS.length - 2);
  });

  it("leads with the work in Portfolio and with images in Gallery", () => {
    const portfolio = applyStarter(layout, starterMap.portfolio);
    expect(portfolio.sections[1].blocks[0].type).toBe("profile-projects");
    expect(portfolio.sections[1].grid?.[0]).toMatchObject({ x: 0, w: 12 });
    const gallery = applyStarter(layout, starterMap.gallery);
    expect(gallery.sections[1].blocks[0].type).toBe("profile-gallery");
  });

  it("sets the projects presentation", () => {
    const next = applyStarter(layout, starterMap.archive);
    const projects = blocksOf(next).find((b) => b.type === "profile-projects");
    expect(projects?.config.presentation).toBe("minimal-list");
  });

  it("keeps an area's own title and settings when it reuses it", () => {
    const titled: PageLayout = {
      sections: layout.sections.map((section) =>
        section.blocks.some((b) => b.type === "profile-projects")
          ? { ...section, title: "Things I made", appearance: { accent: "#ff0000" } }
          : section,
      ),
    };
    const next = applyStarter(titled, starterMap.technical);
    const work = next.sections.find((s) => s.blocks.some((b) => b.type === "profile-projects"));
    expect(work?.title).toBe("Things I made");
    expect(work?.appearance?.accent).toBe("#ff0000");
  });

  it("stays well-formed when layouts are applied one after another", () => {
    let current = layout;
    for (const starter of [...STARTERS, ...STARTERS]) {
      current = applyStarter(current, starter);
      const ids = current.sections.map((s) => s.id);
      expect(new Set(ids).size, starter.id).toBe(ids.length);
      const blocks = blocksOf(current).map((b) => b.id);
      expect(new Set(blocks).size).toBe(blocks.length);
    }
  });

  it("drops an area's old title once it has mostly become something else", () => {
    const block = (id: string, type: string, position: number) => ({
      id,
      type,
      position,
      config: {},
      visible: true,
    });
    const page: PageLayout = {
      sections: [
        { id: "h", position: 0, layout: "full", blocks: [block("h1", "profile-header", 0)] },
        {
          id: "net",
          position: 1,
          layout: "full",
          title: "Built with others",
          blocks: [
            block("b1", "profile-skills", 0),
            block("n1", "profile-collaboration-network", 1),
            block("l1", "profile-links", 2),
          ],
        },
      ],
    };
    const next = applyStarter(page, starterMap.technical);
    const stack = next.sections.find((s) => s.blocks.some((b) => b.type === "profile-skills"));
    expect(stack?.title).toBe("Stack");
    const network = next.sections.find((s) =>
      s.blocks.some((b) => b.type === "profile-collaboration-network"),
    );
    expect(network?.blocks.map((b) => b.type)).toEqual([
      "profile-collaboration-network",
      "profile-links",
    ]);
  });

  it("leaves blocks in hidden areas hidden, where they were", () => {
    const hidden: PageLayout = {
      sections: layout.sections.map((section) =>
        section.blocks.some((b) => b.type === "profile-gallery")
          ? { ...section, visible: false }
          : section,
      ),
    };
    const next = applyStarter(hidden, starterMap.gallery);
    const area = next.sections.find((s) => s.blocks.some((b) => b.type === "profile-gallery"));
    expect(area?.visible).toBe(false);
  });
});

describe("content-aware composition", () => {
  const page = (types: string[][]): PageLayout => ({
    sections: types.map((blocks, index) => ({
      id: `s${index}`,
      position: index,
      layout: "full",
      blocks: blocks.map((type, position) => ({
        id: `${type}-${index}-${position}`,
        type,
        position,
        config: {},
        visible: true,
      })),
    })),
  });

  it("skips areas with nothing to show and widens a row's survivors", () => {
    const next = composeLayout(page([["profile-header"], ["profile-projects"]]), {
      areas: [
        { key: "a", rows: [[{ role: "identity", w: 12 }]] },
        { key: "g", rows: [[{ role: "gallery", w: 12 }]] },
        {
          key: "w",
          rows: [
            [
              { role: "projects", w: 8 },
              { role: "quote", w: 4 },
            ],
          ],
        },
      ],
      rest: [6, 6],
    });
    expect(next.sections).toHaveLength(2);
    expect(next.sections[1].grid?.[0]).toMatchObject({ x: 0, w: 12 });
  });

  it("re-flows everything the layout doesn't name with its rhythm", () => {
    const next = composeLayout(page([["profile-header"], ["text", "text", "text"]]), {
      areas: [{ key: "a", rows: [[{ role: "identity", w: 12 }]] }],
      rest: [4, 4, 4],
    });
    expect(next.sections[1].grid?.map((g) => [g.x, g.w])).toEqual([
      [0, 4],
      [4, 4],
      [8, 4],
    ]);
  });

  it("sets phone widths only where the layout asks", () => {
    const next = composeLayout(page([["profile-header", "profile-links"]]), {
      areas: [{ key: "a", rows: [[{ role: "identity", w: 12 }]] }],
      rest: [6, 6],
      phoneHalf: ["links"],
    });
    const links = blocksOf(next).find((b) => b.type === "profile-links");
    const header = blocksOf(next).find((b) => b.type === "profile-header");
    expect(links?.phoneWidth).toBe("half");
    expect(header?.phoneWidth).toBeUndefined();
  });
  it("layers Collage's pieces, and the next layout takes the layering away", () => {
    const composition = (id: string) => STARTERS.find((s) => s.id === id)!.composition;
    const start = createDefaultProfileLayout();
    const collage = composeLayout(start, composition("collage"));
    const layered = blocksOf(collage).filter((b) => b.overlap === "up");
    expect(layered.length).toBeGreaterThan(0);
    // Overlap is drawn, never placed: the grid itself still has no collisions.
    for (const section of collage.sections) {
      const grid = section.grid ?? [];
      grid.forEach((a, i) => grid.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)));
    }
    const editorial = composeLayout(collage, composition("editorial"));
    expect(blocksOf(editorial).some((b) => b.overlap)).toBe(false);
  });
});

describe("For hire", () => {
  const base = (): PageLayout => ({
    sections: [
      {
        id: "work",
        position: 0,
        layout: "full",
        blocks: [{ id: "p", type: "profile-projects", position: 0, config: {}, visible: true }],
      },
      {
        id: "identity",
        position: 1,
        layout: "full",
        blocks: [{ id: "h", type: "profile-header", position: 0, config: {}, visible: true }],
      },
    ],
  });
  const types = (layout: PageLayout) => layout.sections.map((s) => s.blocks.map((b) => b.type));

  it("adds what it needs and composes it in order", () => {
    const applied = applyStarter(base(), starterMap["for-hire"]);
    expect(types(applied)).toEqual([
      ["profile-header"],
      ["highlights"],
      ["profile-projects"],
      ["services", "quote"],
      ["call-to-action"],
    ]);
    expect(applied.sections.at(-1)?.appearance).toEqual({ background: "accent" });
  });

  it("never duplicates on a second application", () => {
    const once = applyStarter(base(), starterMap["for-hire"]);
    const twice = applyStarter(once, starterMap["for-hire"]);
    expect(blocksOf(twice)).toHaveLength(blocksOf(once).length);
  });
});

describe("layouts and the look stay separate", () => {
  it("a layout sets only the page width and its id", () => {
    const styled: StudioConfig = {
      ...DEFAULT_STUDIO_CONFIG,
      ...chooseVisualLanguage("technical"),
      density: "spacious",
      accentColor: "#ff0000",
    };
    const next = starterConfig(starterMap.gallery, styled);
    expect(next).toEqual({ ...styled, structure: "full", starterId: "gallery" });
    expect(starterPreviewConfig(starterMap.gallery, styled)).toEqual(next);
  });

  it("a community template keeps the member's config", () => {
    const current = { ...DEFAULT_STUDIO_CONFIG, starterId: "magazine" } as StudioConfig;
    expect(templatePreviewConfig(current)).toEqual({ ...current, starterId: null });
  });

  it("reads layouts from before compositions as their successors", () => {
    expect(normalizeStudioConfig({ starterId: "focused" }).starterId).toBe("linear");
    expect(normalizeStudioConfig({ starterId: "project-first" }).starterId).toBe("portfolio");
    expect(normalizeStudioConfig({ starterId: "experimental" }).starterId).toBe("collage");
    expect(normalizeStudioConfig({ starterId: "nonsense" }).starterId).toBeNull();
  });
});

describe("sectionMarker", () => {
  it("classifies a profile section by the block types it holds", () => {
    const layout = createDefaultProfileLayout();
    const markers = layout.sections.map(sectionMarker);
    expect(markers).toContain("identity");
    expect(markers).toContain("projects");
  });
});
