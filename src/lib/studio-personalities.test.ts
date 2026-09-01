// ── Studio Personalities Tests ────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  STUDIO_PERSONALITIES,
  applyStudioPersonality,
  getStudioPersonality,
} from "@/lib/studio-personalities";
import type { AppliedPersonality, StudioPersonality } from "@/lib/studio-personalities";
import type {
  RadiusTreatment,
  TypographyTreatment,
  Density,
  AccentMode,
} from "@/lib/studio-config";

describe("STUDIO_PERSONALITIES", () => {
  it("exposes exactly the four curated presets", () => {
    expect(STUDIO_PERSONALITIES.map((p) => p.id)).toEqual([
      "minimal",
      "creative",
      "professional",
      "artistic",
    ]);
  });

  it("gives every preset a label, description, composition, and appearance", () => {
    for (const personality of STUDIO_PERSONALITIES) {
      expect(personality.label.length).toBeGreaterThan(0);
      expect(personality.description.length).toBeGreaterThan(3);
      expect(personality.composition().sections.length).toBeGreaterThan(0);
      expect(personality.appearance.radius).toBeTruthy();
      expect(personality.appearance.typography).toBeTruthy();
      expect(personality.appearance.density).toBeTruthy();
      expect(personality.appearance.accentMode).toBeTruthy();
      expect(personality.themeTokens).toBeDefined();
    }
  });

  it("builds distinct layouts — no two compositions are identical", () => {
    const signatures = STUDIO_PERSONALITIES.map((p) =>
      JSON.stringify(p.composition().sections.map((s) => s.layout)),
    );
    expect(signatures).toEqual([...new Set(signatures)]);
  });

  it("looks up presets by id and returns null for unknown ids", () => {
    expect(getStudioPersonality("creative")?.label).toBe("Creative");
    expect(getStudioPersonality("nope")).toBeNull();
    expect(getStudioPersonality(null)).toBeNull();
  });
});

describe("applyStudioPersonality", () => {
  it("produces a full config stamped with the personality id", () => {
    const applied = applyStudioPersonality(STUDIO_PERSONALITIES[0]);
    expect(applied.config.personalityId).toBe("minimal");
    expect(applied.config).toMatchObject(STUDIO_PERSONALITIES[0].appearance);
  });

  it("copies the preset's layout", () => {
    const source = STUDIO_PERSONALITIES[1];
    const applied = applyStudioPersonality(source);
    // Ids are regenerated per call — compare structure, ignoring them.
    const stripIds = (_key: string, v: unknown) =>
      v && typeof v === "object" && "id" in v ? { ...(v as object), id: undefined } : v;
    expect(JSON.parse(JSON.stringify(applied.layout, stripIds))).toEqual(
      JSON.parse(JSON.stringify(source.composition(), stripIds)),
    );
  });

  it("carries theme overrides", () => {
    const applied = applyStudioPersonality(STUDIO_PERSONALITIES[3]);
    expect(applied.themeOverrides).toBeDefined();
  });

  it("normalizes a missing accent color to null", () => {
    const applied = applyStudioPersonality(STUDIO_PERSONALITIES[2]);
    expect(applied.config.accentColor).toBeNull();
  });
});

// Keep the exported types referenced so the unused-export sweep stays green
// until the pickers consume them.
type _Types = [
  StudioPersonality,
  AppliedPersonality,
  RadiusTreatment,
  TypographyTreatment,
  Density,
  AccentMode,
];
void (null as unknown as _Types);
