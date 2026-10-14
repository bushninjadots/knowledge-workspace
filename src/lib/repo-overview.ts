// ── "How this project works", without AI ──────────────────────────────────────
// From a repo's README, manifest files and folder layout, write the page a
// new contributor needs: what it is, how to run it, what it's built with,
// where things live and where to start reading. Pure — the GitHub fetching
// lives in code-docs-server.ts.

export type RepoSnapshot = {
  name: string;
  description: string | null;
  readme: string | null;
  /** Every file path in the repo (as the tree API lists them). */
  paths: string[];
  /** Parsed package.json, if there is one. */
  packageJson: {
    name?: string;
    description?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | null;
  url?: string | null;
};

const FOLDER_MEANING: Record<string, string> = {
  src: "the application's source code",
  app: "app routes and screens",
  pages: "pages / routes",
  components: "reusable UI components",
  lib: "shared helpers and logic",
  utils: "small shared utilities",
  hooks: "React hooks (data and state)",
  api: "API endpoints",
  server: "server-side code",
  routes: "routes / pages",
  public: "static files served as-is (images, icons)",
  assets: "images, fonts and other assets",
  styles: "stylesheets",
  test: "tests",
  tests: "tests",
  __tests__: "tests",
  spec: "tests",
  e2e: "end-to-end tests",
  docs: "documentation",
  scripts: "developer scripts (build, QA, maintenance)",
  supabase: "database migrations and Supabase functions",
  migrations: "database migrations",
  prisma: "database schema (Prisma)",
  db: "database code",
  config: "configuration",
  cmd: "command-line entry points",
  internal: "internal packages",
  pkg: "packages",
  packages: "packages in a monorepo",
  apps: "apps in a monorepo",
  examples: "example code",
  ".github": "GitHub workflows and templates (CI)",
  infra: "infrastructure as code",
  deploy: "deployment config",
  bin: "executables",
};

const STACK: [RegExp, string][] = [
  [/^next$/, "Next.js"],
  [/^react$/, "React"],
  [/^vue$/, "Vue"],
  [/^svelte$|^@sveltejs\/kit$/, "Svelte"],
  [/^@angular\/core$/, "Angular"],
  [/^@tanstack\/react-start$/, "TanStack Start"],
  [/^@tanstack\/react-router$/, "TanStack Router"],
  [/^vite$/, "Vite"],
  [/^express$/, "Express"],
  [/^fastify$/, "Fastify"],
  [/^hono$/, "Hono"],
  [/^@nestjs\/core$/, "NestJS"],
  [/^tailwindcss$/, "Tailwind CSS"],
  [/^@supabase\/supabase-js$/, "Supabase"],
  [/^prisma$|^@prisma\/client$/, "Prisma"],
  [/^drizzle-orm$/, "Drizzle"],
  [/^electron$/, "Electron"],
  [/^react-native$|^expo$/, "React Native"],
  [/^typescript$/, "TypeScript"],
  [/^vitest$/, "Vitest"],
  [/^jest$/, "Jest"],
  [/^playwright$|^@playwright\/test$/, "Playwright"],
  [/^three$/, "Three.js"],
  [/^@anthropic-ai\/sdk$/, "Claude API"],
];

const MANIFESTS: [string, string, string][] = [
  ["Cargo.toml", "Rust (Cargo)", "cargo run"],
  ["go.mod", "Go", "go run ."],
  ["pyproject.toml", "Python", "pip install -e . (or uv / poetry)"],
  ["requirements.txt", "Python", "pip install -r requirements.txt"],
  ["Gemfile", "Ruby", "bundle install"],
  ["composer.json", "PHP", "composer install"],
  ["pom.xml", "Java (Maven)", "mvn package"],
  ["build.gradle", "Java/Kotlin (Gradle)", "./gradlew build"],
  ["build.gradle.kts", "Kotlin (Gradle)", "./gradlew build"],
  ["pubspec.yaml", "Dart / Flutter", "flutter run"],
  ["mix.exs", "Elixir", "mix deps.get"],
  ["Dockerfile", "Docker", "docker build ."],
  ["docker-compose.yml", "Docker Compose", "docker compose up"],
  ["Makefile", "Make", "make"],
];

const SCRIPT_MEANING: Record<string, string> = {
  dev: "start the app locally while you work",
  start: "start the app",
  build: "build for production",
  test: "run the tests",
  lint: "check code style",
  typecheck: "check types",
  format: "format the code",
  preview: "preview the production build",
  e2e: "run end-to-end tests",
};

const ENTRY_FILES = [
  "src/main.tsx",
  "src/main.ts",
  "src/index.tsx",
  "src/index.ts",
  "src/App.tsx",
  "src/app.tsx",
  "app/page.tsx",
  "app/layout.tsx",
  "pages/index.tsx",
  "src/routes/__root.tsx",
  "src/server.ts",
  "index.js",
  "index.ts",
  "server.js",
  "main.py",
  "app.py",
  "manage.py",
  "src/main.rs",
  "src/lib.rs",
  "main.go",
  "cmd/main.go",
  "lib/main.dart",
];

/** The README's first real paragraph (no badges, headings or HTML). */
export function readmeIntro(readme: string | null): string | null {
  if (!readme) return null;
  const blocks = readme
    .replace(/<[^>]+>/g, " ")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(
      (b) =>
        b &&
        !b.startsWith("#") &&
        !/^(\[!\[|!\[)/.test(b) &&
        !/^[-*_]{3,}$/.test(b) &&
        !b.startsWith("```") &&
        b.replace(/[^A-Za-z]/g, "").length > 30,
    );
  return blocks[0]?.replace(/\s+/g, " ").slice(0, 600) ?? null;
}

export function repoOverviewMarkdown(repo: RepoSnapshot): string {
  const paths = repo.paths.filter(
    (p) => !/(^|\/)(node_modules|dist|build|\.next|vendor)\//.test(p),
  );
  const has = (file: string) => paths.some((p) => p.toLowerCase() === file.toLowerCase());
  const pkg = repo.packageJson;
  const out: string[] = [`# How ${pkg?.name ?? repo.name} works`, ""];

  const intro = repo.description ?? pkg?.description ?? readmeIntro(repo.readme);
  if (intro) out.push(intro, "");
  if (repo.url) out.push(`Source: ${repo.url}`, "");

  // Run it
  const run: string[] = [];
  if (pkg?.scripts) {
    const pm = has("pnpm-lock.yaml")
      ? "pnpm"
      : has("yarn.lock")
        ? "yarn"
        : has("bun.lock") || has("bun.lockb")
          ? "bun"
          : "npm";
    run.push(`1. Install: \`${pm} install\``);
    const known = Object.keys(SCRIPT_MEANING).filter((s) => pkg.scripts?.[s]);
    known.forEach((s, i) =>
      run.push(
        `${i + 2}. \`${pm === "npm" && s !== "start" && s !== "test" ? "npm run" : pm} ${s}\` — ${SCRIPT_MEANING[s]}`,
      ),
    );
  }
  for (const [file, label, command] of MANIFESTS)
    if (has(file) && !(file === "Makefile" && run.length)) run.push(`- ${label}: \`${command}\``);
  if (has(".env.example") || has(".env.sample"))
    run.push("- Copy `.env.example` to `.env` and fill in the values first.");
  if (run.length) out.push("## Run it locally", "", ...run, "");

  // Built with
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const stack = STACK.filter(([re]) => Object.keys(deps).some((d) => re.test(d))).map(([, n]) => n);
  const langs = new Set(
    MANIFESTS.filter(([f]) => has(f) && !/Docker|Make/.test(f)).map(([, l]) => l),
  );
  const built = [...new Set([...stack, ...langs])];
  if (built.length) out.push("## Built with", "", built.join(" · "), "");

  // Where things live
  const top = new Map<string, number>();
  for (const p of paths) {
    const [head, ...rest] = p.split("/");
    if (rest.length) top.set(head, (top.get(head) ?? 0) + 1);
  }
  const folders = [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  if (folders.length) {
    out.push("## Where things live", "");
    for (const [name, count] of folders)
      out.push(
        `- \`${name}/\` — ${FOLDER_MEANING[name] ?? `${count} file${count === 1 ? "" : "s"}`}`,
      );
    // One level deeper inside src/ is usually where the map is.
    const src = new Map<string, number>();
    for (const p of paths) {
      const parts = p.split("/");
      if (parts[0] === "src" && parts.length > 2) src.set(parts[1], (src.get(parts[1]) ?? 0) + 1);
    }
    const inner = [...src.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (inner.length)
      out.push(
        "",
        "Inside `src/`:",
        "",
        ...inner.map(([n, c]) => `- \`src/${n}/\` — ${FOLDER_MEANING[n] ?? `${c} files`}`),
      );
    out.push("");
  }

  // Start reading here
  const entries = ENTRY_FILES.filter((f) => has(f));
  if (entries.length)
    out.push("## Start reading here", "", ...entries.slice(0, 5).map((f) => `- \`${f}\``), "");

  // Contribute
  const contrib = ["CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "LICENSE"].filter((f) => has(f));
  const tests = paths.filter((p) =>
    /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[jt]sx?$|_test\.go$/.test(p),
  ).length;
  if (contrib.length || tests) {
    out.push("## Contributing", "");
    if (has("CONTRIBUTING.md"))
      out.push("- Read `CONTRIBUTING.md` first — it has the project's rules.");
    if (tests)
      out.push(
        `- There ${tests === 1 ? "is 1 test file" : `are ${tests} test files`}; run the tests before opening a pull request.`,
      );
    if (has("LICENSE")) out.push("- Licensed — see `LICENSE`.");
    out.push("");
  }

  out.push(
    `_${paths.length} files scanned. Written by Tethyr from the repository — edit anything that's off._`,
  );
  return out.join("\n").trimEnd() + "\n";
}
