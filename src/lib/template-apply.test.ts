import { describe, expect, it } from "vitest";
import { applyTemplateSections, sanitizeTemplateSections } from "./template-apply";
import { createDefaultProfileLayout } from "@/lib/default-layouts";
import "@/components/tethyr/blocks/register-all";

describe("sanitizeTemplateSections", () => {
  it("returns [] for nullish or non-array input", () => {
    expect(sanitizeTemplateSections(null)).toEqual([]);
    expect(sanitizeTemplateSections(undefined)).toEqual([]);
    expect(sanitizeTemplateSections({})).toEqual([]);
    expect(sanitizeTemplateSections("nope")).toEqual([]);
  });

  it("keeps renderable blocks and renumbers positions", () => {
    const raw = [
      {
        id: "s1",
        position: 7,
        layout: "two_column",
        blocks: [
          { id: "b1", type: "profile-bio", position: 4, config: { showGoals: true } },
          { id: "b2", type: "profile-skills", position: 9, config: {} },
        ],
      },
    ];
    const sections = sanitizeTemplateSections(raw);
    expect(sections).toHaveLength(1);
    expect(sections[0].layout).toBe("two_column");
    expect(sections[0].position).toBe(0);
    expect(sections[0].blocks.map((b) => b.position)).toEqual([0, 1]);
    expect(sections[0].blocks[0].config).toEqual({ showGoals: true });
  });

  it("drops unknown block types and empty sections", () => {
    const raw = [
      {
        id: "s1",
        blocks: [
          { id: "b1", type: "totally-made-up-block", config: {} },
          { id: "b2", type: "profile-bio", config: {} },
        ],
      },
      { id: "s2", blocks: [{ id: "b3", type: "another-fake", config: {} }] },
      { id: "s3", blocks: "not-an-array" },
    ];
    const sections = sanitizeTemplateSections(raw);
    expect(sections).toHaveLength(1);
    expect(sections[0].blocks.map((b) => b.type)).toEqual(["profile-bio"]);
  });

  it("heals unknown section layouts to full", () => {
    const raw = [
      { id: "s1", layout: "quantum_grid", blocks: [{ id: "b1", type: "profile-bio", config: {} }] },
    ];
    expect(sanitizeTemplateSections(raw)[0].layout).toBe("full");
  });

  it("maps legacy section layout names to their closest current composition", () => {
    const raw = [
      { id: "s1", layout: "hero", blocks: [{ id: "b1", type: "profile-bio", config: {} }] },
    ];
    expect(sanitizeTemplateSections(raw)[0].layout).toBe("feature");
  });

  it("drops sections whose visible flag is explicitly false", () => {
    const raw = [
      {
        id: "s1",
        visible: false,
        blocks: [{ id: "b1", type: "profile-bio", config: {} }],
      },
    ];
    expect(sanitizeTemplateSections(raw)).toEqual([]);
  });
});

describe("applyTemplateSections", () => {
  const layout = createDefaultProfileLayout();

  it("returns the layout untouched when the template has no sections", () => {
    expect(applyTemplateSections(layout, [])).toBe(layout);
  });

  it("puts template sections first and keeps the member's other sections behind", () => {
    // A template that only covers identity: header block.
    const template = sanitizeTemplateSections([
      {
        id: "tpl-identity",
        layout: "full",
        blocks: [{ id: "t1", type: "profile-header", config: {} }],
      },
    ]);
    const next = applyTemplateSections(layout, template);
    expect(next.sections[0].id).toBe("tpl-identity");
    // The live identity section is replaced (covered by marker); every other
    // original section survives.
    const liveIdentity = layout.sections.find((s) =>
      s.blocks.some((b) => b.type === "profile-header"),
    );
    for (const section of layout.sections) {
      if (section.id === liveIdentity?.id) {
        expect(next.sections.some((s) => s.id === section.id)).toBe(false);
        continue;
      }
      expect(next.sections.some((s) => s.id === section.id)).toBe(true);
    }
  });

  it("drops live sections whose marker the template covers, never their blocks elsewhere", () => {
    const template = sanitizeTemplateSections([
      {
        id: "tpl-projects",
        layout: "full",
        blocks: [{ id: "t1", type: "profile-projects", config: { presentation: "minimal-list" } }],
      },
    ]);
    const next = applyTemplateSections(layout, template);
    // The live projects section is replaced by the template's.
    const liveProjects = layout.sections.find((s) =>
      s.blocks.some((b) => b.type === "profile-projects"),
    );
    expect(next.sections.some((s) => s.id === liveProjects?.id)).toBe(false);
    expect(next.sections[0].blocks[0].config.presentation).toBe("minimal-list");
    // Other live sections remain.
    expect(next.sections.length).toBe(layout.sections.length);
  });

  it("never mutates the input layout", () => {
    const before = JSON.stringify(layout);
    const template = sanitizeTemplateSections([
      { id: "tpl-x", layout: "full", blocks: [{ id: "t1", type: "profile-bio", config: {} }] },
    ]);
    applyTemplateSections(layout, template);
    expect(JSON.stringify(layout)).toBe(before);
  });

  it("is deterministic: the same template JSON produces byte-identical layouts", () => {
    // Same untrusted JSON in → same normalized layout out, every time. This is
    // what makes the published page render the same on every load: the stored
    // arrangement is a pure function of the template, not of when/how it was
    // applied.
    const raw = [
      {
        id: "tpl-identity",
        layout: "feature",
        blocks: [
          { id: "t1", type: "profile-header", config: { showTagline: true } },
          { id: "t2", type: "profile-projects", config: { presentation: "spotlight" } },
        ],
      },
      { id: "tpl-bio", layout: "full", blocks: [{ id: "t3", type: "profile-bio", config: {} }] },
    ];
    const first = JSON.stringify(applyTemplateSections(layout, sanitizeTemplateSections(raw)));
    for (let i = 0; i < 5; i++) {
      expect(JSON.stringify(applyTemplateSections(layout, sanitizeTemplateSections(raw)))).toBe(
        first,
      );
    }
    // And a JSON round-trip of the result re-applies to itself byte-for-byte.
    const applied = JSON.parse(first);
    expect(JSON.stringify(applyTemplateSections(applied, sanitizeTemplateSections(raw)))).toBe(
      first,
    );
  });
});
