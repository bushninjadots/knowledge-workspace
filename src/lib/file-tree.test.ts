import { describe, it, expect } from "vitest";
import { buildTree, treeToAscii, type TreeFile } from "@/lib/file-tree";

/**
 * The Files explorer and the README tab's "Project structure" block both render
 * from this, so a nesting or ordering bug shows up as a wrong diagram in a
 * public README — and nothing tested it.
 */
const file = (name: string, dir?: string): TreeFile => ({ name, dir });

describe("buildTree", () => {
  it("keeps the path components as separate nested nodes", () => {
    const root = buildTree([file("Workspace.tsx", "src/components")]);

    const src = root.children.get("src");
    expect(src?.name).toBe("src");
    expect(src?.dir).toBe("src");
    const components = src?.children.get("components");
    expect(components?.dir).toBe("src/components");
    expect(components?.files.map((f) => f.name)).toEqual(["Workspace.tsx"]);
  });

  it("shares a directory node instead of duplicating it", () => {
    const root = buildTree([file("a.ts", "src/lib"), file("b.ts", "src/lib"), file("c.ts", "src")]);

    const src = root.children.get("src");
    expect(src?.children.size).toBe(1);
    expect(src?.children.get("lib")?.files.map((f) => f.name)).toEqual(["a.ts", "b.ts"]);
    expect(src?.files.map((f) => f.name)).toEqual(["c.ts"]);
  });

  it("treats a missing or blank dir as the root", () => {
    const root = buildTree([file("README.md"), file("LICENSE", ""), file("notes.txt", "/")]);
    expect(root.files.map((f) => f.name)).toEqual(["README.md", "LICENSE", "notes.txt"]);
    expect(root.children.size).toBe(0);
  });

  it("ignores empty path segments", () => {
    const root = buildTree([file("x.ts", "src//components/")]);
    expect(root.children.get("src")?.children.get("components")?.files).toHaveLength(1);
  });
});

describe("treeToAscii", () => {
  it("renders directories before files, each sorted, with box-drawing prefixes", () => {
    const tree = buildTree([
      file("zeta.ts", "src"),
      file("alpha.ts", "src"),
      file("Button.tsx", "src/components"),
      file("theme.ts", "src/lib"),
    ]);

    expect(treeToAscii(tree)).toBe(
      [
        "└── src/",
        "    ├── components/",
        "    │   └── Button.tsx",
        "    ├── lib/",
        "    │   └── theme.ts",
        "    ├── alpha.ts",
        "    └── zeta.ts",
      ].join("\n"),
    );
  });

  it("returns an empty string for an empty tree", () => {
    expect(treeToAscii(buildTree([]))).toBe("");
  });
});
