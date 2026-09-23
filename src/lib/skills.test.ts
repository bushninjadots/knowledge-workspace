import { describe, it, expect } from "vitest";
import type { Skill, SkillActivityCounts } from "@/hooks/use-current-user";
import { groupSkillsByCategory, skillActivityTotal } from "./skills";

const skill = (overrides: Partial<Skill>): Skill => ({
  id: overrides.id ?? "null",
  slug: overrides.slug ?? "skill",
  name: overrides.name ?? "Skill",
  category: overrides.category ?? "Development",
  description: overrides.description ?? null,
  tools: overrides.tools ?? null,
});

describe("groupSkillsByCategory", () => {
  it("groups skills by category in first-appearance order", () => {
    const groups = groupSkillsByCategory([
      skill({ id: "1", slug: "react", name: "React", category: "Development" }),
      skill({ id: "2", slug: "figma", name: "Figma", category: "Design" }),
      skill({ id: "3", slug: "vue", name: "Vue", category: "Development" }),
    ]);

    expect(groups.map((g) => g.category)).toEqual(["Development", "Design"]);
    expect(groups[0].skills.map((s) => s.slug)).toEqual(["react", "vue"]);
    expect(groups[1].skills.map((s) => s.slug)).toEqual(["figma"]);
  });

  it("keeps skills in the order they arrive within a category", () => {
    const groups = groupSkillsByCategory([
      skill({ id: "1", slug: "b", category: "Development" }),
      skill({ id: "2", slug: "a", category: "Development" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].skills.map((s) => s.slug)).toEqual(["b", "a"]);
  });

  it("returns an empty array for an empty catalog", () => {
    expect(groupSkillsByCategory([])).toEqual([]);
  });

  it("does not emit categories that have no skills", () => {
    const groups = groupSkillsByCategory([]);
    expect(groups).toEqual([]);
  });
});

describe("skillActivityTotal", () => {
  it("sums sharing + growing + projects", () => {
    const stats: SkillActivityCounts = { sharing: 18, growing: 11, projects: 7, needs: 2 };
    expect(skillActivityTotal(stats)).toBe(36);
  });

  it("counts open needs separately from trending activity", () => {
    const stats: SkillActivityCounts = { sharing: 0, growing: 0, projects: 0, needs: 5 };
    expect(skillActivityTotal(stats)).toBe(0);
  });

  it("treats missing stats as zero (no invented activity)", () => {
    expect(skillActivityTotal(undefined)).toBe(0);
  });
});
