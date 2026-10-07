import { describe, expect, it } from "vitest";
import { skillsFromLanguages } from "./github-skills";

const catalog = [
  { id: "ts", name: "TypeScript" },
  { id: "py", name: "Python" },
  { id: "bash", name: "Bash" },
  { id: "go", name: "Go" },
  { id: "web", name: "HTML & CSS" },
  { id: "ios", name: "Swift / iOS" },
];

describe("skills from GitHub languages", () => {
  it("matches languages to the catalog, most-used first", () => {
    const result = skillsFromLanguages(
      ["TypeScript", "Python", "TypeScript", null, "Jupyter Notebook", "Haskell"],
      catalog,
    );
    expect(result.map((r) => [r.skill.id, r.repos])).toEqual([
      ["py", 2],
      ["ts", 2],
    ]);
  });

  it("maps GitHub's names onto the catalog's and skips skills already chosen", () => {
    const result = skillsFromLanguages(["Shell", "Go"], catalog, new Set(["go"]));
    expect(result.map((r) => r.skill.id)).toEqual(["bash"]);
  });

  it("matches each part of a combined catalog name", () => {
    const result = skillsFromLanguages(["HTML", "CSS", "Swift", "Ruby"], catalog);
    expect(result.map((r) => [r.skill.id, r.repos])).toEqual([
      ["web", 2],
      ["ios", 1],
    ]);
  });
});
