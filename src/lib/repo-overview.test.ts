import { describe, expect, it } from "vitest";
import { readmeIntro, repoOverviewMarkdown } from "./repo-overview";

describe("repoOverviewMarkdown", () => {
  it("writes run steps, stack, folders and entry points", () => {
    const md = repoOverviewMarkdown({
      name: "acme/shop",
      description: null,
      readme:
        "# Shop\n\n[![ci](x)](y)\n\nA tiny storefront for indie makers, with carts and Stripe checkout built in.\n",
      url: "https://github.com/acme/shop",
      packageJson: {
        name: "shop",
        scripts: { dev: "vite", build: "vite build", test: "vitest" },
        dependencies: { react: "19", "@supabase/supabase-js": "2" },
        devDependencies: { vite: "7", typescript: "5", vitest: "3" },
      },
      paths: [
        "package.json",
        "pnpm-lock.yaml",
        ".env.example",
        "src/main.tsx",
        "src/components/Cart.tsx",
        "src/components/Button.tsx",
        "src/lib/money.ts",
        "src/lib/money.test.ts",
        "docs/setup.md",
        "node_modules/x/index.js",
        "CONTRIBUTING.md",
      ],
    });
    expect(md).toContain("# How shop works");
    expect(md).toContain("A tiny storefront for indie makers");
    expect(md).toContain("1. Install: `pnpm install`");
    expect(md).toContain("`pnpm dev` — start the app locally while you work");
    expect(md).toContain("Copy `.env.example`");
    expect(md).toContain("React · Vite · Supabase · TypeScript · Vitest");
    expect(md).toContain("- `src/` — the application's source code");
    expect(md).toContain("- `src/components/` — reusable UI components");
    expect(md).toContain("- `src/main.tsx`");
    expect(md).toContain("Read `CONTRIBUTING.md` first");
    expect(md).toContain("There is 1 test file;");
    expect(md).not.toContain("node_modules");
  });

  it("handles non-JS repos", () => {
    const md = repoOverviewMarkdown({
      name: "tool",
      description: "A CLI.",
      readme: null,
      packageJson: null,
      paths: ["Cargo.toml", "src/main.rs", "README.md"],
    });
    expect(md).toContain("- Rust (Cargo): `cargo run`");
    expect(md).toContain("Built with\n\nRust (Cargo)");
    expect(md).toContain("- `src/main.rs`");
  });

  it("finds the README's first real paragraph", () => {
    expect(
      readmeIntro(
        "# T\n\n![b](c)\n\n<p align=center>logo</p>\n\nThis library parses calendar files quickly and safely.",
      ),
    ).toBe("This library parses calendar files quickly and safely.");
    expect(readmeIntro(null)).toBeNull();
  });
});
