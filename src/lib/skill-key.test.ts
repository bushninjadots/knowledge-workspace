import { describe, expect, it } from "vitest";
import { skillKey, skillKeyMap } from "./skill-key";

describe("skillKey", () => {
  it("gives a catalog name and its slug the same key", () => {
    expect(skillKey("Tailwind CSS")).toBe(skillKey("tailwind-css"));
    expect(skillKey("UI Design")).toBe("ui-design");
    expect(skillKey("  Mixing & Mastering ")).toBe("mixing-mastering");
  });

  it("maps names and slugs back to the display name", () => {
    const map = skillKeyMap([{ name: "C++", slug: "cpp" }, { name: "React" }]);
    expect(map.get(skillKey("cpp"))).toBe("C++");
    expect(map.get(skillKey("react"))).toBe("React");
  });
});
