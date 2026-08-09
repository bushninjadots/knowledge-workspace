import { describe, expect, it } from "vitest";
import { computeCategoryBreakdown, getTierProgress } from "./reputation";

describe("reputation tiers", () => {
  it("starts Contributor progress at zero toward Builder", () => {
    const result = getTierProgress(20);

    expect(result.current.name).toBe("Contributor");
    expect(result.next?.name).toBe("Builder");
    expect(result.progress).toBe(0);
  });

  it("calculates progress within the current tier", () => {
    expect(getTierProgress(35).progress).toBe(50);
    expect(getTierProgress(49).progress).toBe(97);
    expect(getTierProgress(50)).toMatchObject({
      current: { name: "Builder" },
      next: { name: "Mentor" },
      progress: 0,
    });
  });

  it("caps the final tier at 100 percent", () => {
    expect(getTierProgress(999)).toMatchObject({
      current: { name: "Legend" },
      next: null,
      progress: 100,
    });
  });
});

describe("reputation category labels", () => {
  it("uses the canonical share and growing language", () => {
    const categories = computeCategoryBreakdown([
      { category: "teaching", points: 3 },
      { category: "learning", points: 2 },
    ]);

    expect(categories.map((category) => category.label)).toEqual([
      "Skills I share",
      "Skills I’m growing",
    ]);
  });
});
