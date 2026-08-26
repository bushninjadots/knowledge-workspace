# Library Code/Docs Workspaces + GitHub File Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Library's Docs/Code workspaces real (HTML vs Markdown output), add syntax highlighting for the most common languages with a picker UI, and let owners link a note/document to a GitHub repo file with a manual "Sync from GitHub" action.

**Architecture:** One migration adds `content_format` (`html`|`markdown`) and `github_source` (JSONB) to `library_items`. The existing `NoteEditor` becomes format-aware (Tiptap `@tiptap/markdown` when in Code mode) instead of spawning a second editor component. GitHub pulls reuse the server-side token plumbing in `src/lib/github-server.ts`; sync is owner-only, manual, and idempotent by blob SHA.

**Tech Stack:** TanStack Start/Router, React Query, Supabase, Tiptap v3 (+`@tiptap/markdown`), lowlight/highlight.js, react-markdown+remark-gfm, DOMPurify (new dep), vitest/jsdom.

**Spec:** `docs/superpowers/specs/2026-08-21-library-code-docs-github-design.md`

## Global Constraints

- Existing items must keep working unchanged: default `content_format='html'`, no data migration.
- The GitHub token never reaches the browser; all GitHub fetches go through server functions in `src/lib/github-server.ts`.
- No auto-sync, no background jobs, no push-to-GitHub. Manual pull only.
- Follow Tethyr design constitution: smallest change, no new card containers, `rounded-lg`/`rounded-xl` radii, no gradients/glows.
- Commands: `npm run test` (vitest, jsdom), `npm run typecheck`, `npm run lint`. Tests live next to sources as `*.test.ts(x)` and are picked up automatically.
- Do not rewrite published git history (Lovable-connected repo).

---

### Task 1: Migration + type updates

**Files:**

- Create: `supabase/migrations/20260821090000_library_content_format_github.sql`
- Modify: `src/integrations/supabase/types.ts` (library_items Row/Insert/Update, ~lines 639-696)
- Modify: `src/hooks/use-library.ts` (LibraryItem type ~line 8, useUpdateItem input ~line 227)
- Create: `src/lib/github-source.ts`
- Test: `src/lib/github-source.test.ts`

**Interfaces:**

- Produces: `type GithubSource = { repo: string; path: string; branch: string | null; synced_at: string | null; sha: string | null }`
- Produces: `parseGithubSource(raw: unknown): GithubSource | null`
- Produces: `LibraryItem.content_format: "html" | "markdown"`, `LibraryItem.github_source: GithubSource | null`
- Produces: `useUpdateItem` accepts `content_format?: "html" | "markdown"` and `github_source?: GithubSource | null`

- [ ] **Step 1: Write the failing test for parseGithubSource**

Create `src/lib/github-source.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseGithubSource } from "./github-source";

describe("parseGithubSource", () => {
  it("parses a valid source object", () => {
    expect(
      parseGithubSource({
        repo: "owner/repo",
        path: "README.md",
        branch: "main",
        synced_at: "2026-08-21T00:00:00Z",
        sha: "abc123",
      }),
    ).toEqual({
      repo: "owner/repo",
      path: "README.md",
      branch: "main",
      synced_at: "2026-08-21T00:00:00Z",
      sha: "abc123",
    });
  });

  it("allows null branch/synced_at/sha (linked but not yet synced)", () => {
    expect(parseGithubSource({ repo: "o/r", path: "docs/x.md" })).toEqual({
      repo: "o/r",
      path: "docs/x.md",
      branch: null,
      synced_at: null,
      sha: null,
    });
  });

  it("returns null for non-objects and missing required fields", () => {
    expect(parseGithubSource(null)).toBeNull();
    expect(parseGithubSource("nope")).toBeNull();
    expect(parseGithubSource({ path: "README.md" })).toBeNull();
    expect(parseGithubSource({ repo: "", path: "README.md" })).toBeNull();
    expect(parseGithubSource({ repo: "o/r" })).toBeNull();
  });

  it("coerces unknown extras away and rejects wrong types", () => {
    expect(parseGithubSource({ repo: "o/r", path: "p", extra: 1 })?.repo).toBe("o/r");
    expect(parseGithubSource({ repo: 42, path: "p" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/github-source.test.ts`
Expected: FAIL — cannot resolve `./github-source`.

- [ ] **Step 3: Implement github-source.ts**

Create `src/lib/github-source.ts`:

```ts
// Shape of library_items.github_source (JSONB). Kept as a pure module so both
// client and server code share one parser with strict validation.
export type GithubSource = {
  repo: string;
  path: string;
  branch: string | null;
  synced_at: string | null;
  sha: string | null;
};

export function parseGithubSource(raw: unknown): GithubSource | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.repo !== "string" || !obj.repo.trim()) return null;
  if (typeof obj.path !== "string" || !obj.path.trim()) return null;
  return {
    repo: obj.repo,
    path: obj.path,
    branch: typeof obj.branch === "string" && obj.branch.trim() ? obj.branch : null,
    synced_at: typeof obj.synced_at === "string" && obj.synced_at ? obj.synced_at : null,
    sha: typeof obj.sha === "string" && obj.sha ? obj.sha : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/github-source.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Create the migration**

Create `supabase/migrations/20260821090000_library_content_format_github.sql`:

```sql
-- Library workspaces can store rich text (HTML) or Markdown, and an item can
-- be linked to a file in a GitHub repository for manual pull-sync.
-- Existing rows keep working unchanged: they default to 'html' and stay
-- unlinked (github_source NULL).

ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS content_format TEXT NOT NULL DEFAULT 'html'
    CHECK (content_format IN ('html', 'markdown'));

ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS github_source JSONB;
```

- [ ] **Step 6: Update generated Supabase types**

In `src/integrations/supabase/types.ts`, inside `library_items` (Row at ~line 640, Insert ~line 659, Update ~line 678), add to **all three** blocks (alphabetical position):

Row:

```ts
content_format: string;
github_source: Json | null;
```

Insert:

```ts
          content_format?: string
          github_source?: Json | null
```

Update:

```ts
          content_format?: string
          github_source?: Json | null
```

(`Json` is already defined at the top of this generated file.)

- [ ] **Step 7: Update use-library.ts types**

In `src/hooks/use-library.ts`:

Add import at top (with the other local imports):

```ts
import { parseGithubSource, type GithubSource } from "@/lib/github-source";
```

Extend `LibraryItem` (~line 8):

```ts
export type LibraryItem = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: "note" | "document" | "link" | "upload";
  collection_id: string | null;
  url: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  thumbnail_url: string | null;
  is_pinned: boolean;
  is_favorite: boolean;
  project_id: string | null;
  reading_progress: number;
  content_format: "html" | "markdown";
  github_source: GithubSource | null;
  created_at: string;
  updated_at: string;
};
```

Extend the `useUpdateItem` mutation input (~line 227) with two fields:

```ts
    mutationFn: async (input: {
      id: string;
      title?: string;
      content?: string;
      collection_id?: string | null;
      project_id?: string | null;
      is_pinned?: boolean;
      is_favorite?: boolean;
      reading_progress?: number;
      url?: string;
      content_format?: "html" | "markdown";
      github_source?: GithubSource | null;
    }) => {
```

In `useLibraryItem`'s queryFn, after building the return object (~line 193), normalize the JSONB column so consumers always see a validated shape:

```ts
return {
  ...item,
  tags,
  collection,
  content_format: item.content_format === "markdown" ? "markdown" : "html",
  github_source: parseGithubSource(item.github_source),
} as LibraryItemWithTags;
```

(replacing the existing `return { ...item, tags, collection } as LibraryItemWithTags;`)

Also in `useLibraryItems`' list query mapping, apply the same normalization if it maps rows through a plain cast — inspect the function and wherever it returns raw rows, add `github_source: parseGithubSource(row.github_source)` handling equivalent to the single-item hook.

- [ ] **Step 8: Verify**

Run: `npm run typecheck && npx vitest run src/lib/github-source.test.ts`
Expected: typecheck clean, test PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260821090000_library_content_format_github.sql src/integrations/supabase/types.ts src/hooks/use-library.ts src/lib/github-source.ts src/lib/github-source.test.ts
git commit -m "feat(library): content_format + github_source columns and shared parser"
```

---

### Task 2: Syntax highlighting languages + code language options

**Files:**

- Modify: `src/lib/lowlight.ts` (full rewrite)
- Test: `src/lib/lowlight.test.ts` (new)

**Interfaces:**

- Produces: default export `lowlight` (unchanged contract for editors)
- Produces: `CODE_LANGUAGE_OPTIONS: { value: string; label: string }[]` — canonical values match registered lowlight names/aliases exactly; first entry `{ value: "none", label: "Plain text" }` meaning "clear the language".

- [ ] **Step 1: Write the failing test**

Create `src/lib/lowlight.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import lowlight, { CODE_LANGUAGE_OPTIONS } from "./lowlight";

describe("lowlight registry", () => {
  const languages = [
    "javascript",
    "js",
    "jsx",
    "typescript",
    "ts",
    "tsx",
    "python",
    "py",
    "java",
    "c",
    "cpp",
    "csharp",
    "cs",
    "go",
    "golang",
    "rust",
    "php",
    "ruby",
    "sql",
    "bash",
    "sh",
    "shell",
    "zsh",
    "yaml",
    "yml",
    "xml",
    "html",
    "css",
    "json",
  ];

  it.each(languages)("has a grammar registered for %s", (lang) => {
    expect(lowlight.registered(lang)).toBe(true);
  });
});

describe("CODE_LANGUAGE_OPTIONS", () => {
  it("starts with a plain-text option that clears the language", () => {
    expect(CODE_LANGUAGE_OPTIONS[0]).toEqual({ value: "none", label: "Plain text" });
  });

  it("only offers languages lowlight can actually highlight", () => {
    for (const opt of CODE_LANGUAGE_OPTIONS.slice(1)) {
      expect(lowlight.registered(opt.value)).toBe(true);
    }
  });

  it("covers the ten most common languages plus the rest of the set", () => {
    const values = CODE_LANGUAGE_OPTIONS.map((o) => o.value);
    for (const required of [
      "javascript",
      "typescript",
      "python",
      "java",
      "c",
      "cpp",
      "csharp",
      "go",
      "rust",
      "php",
      "ruby",
      "sql",
      "bash",
      "yaml",
      "html",
      "css",
      "json",
    ]) {
      expect(values).toContain(required);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/lowlight.test.ts`
Expected: FAIL — `CODE_LANGUAGE_OPTIONS` not exported; most `registered()` checks false.

- [ ] **Step 3: Rewrite lowlight.ts**

Replace the contents of `src/lib/lowlight.ts` with:

```ts
// Curated syntax-highlighting instance for the Tiptap code-block extension.
//
// The default `common` bundle pulls in dozens of grammars; register the
// languages that actually appear in project READMEs and library notes — the
// ten most common programming languages plus markup/data formats. Unknown
// languages remain readable as plain text while keeping the editor chunk
// small enough for a fast first open.
import { createLowlight } from "lowlight";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import php from "highlight.js/lib/languages/php";
import ruby from "highlight.js/lib/languages/ruby";
import sql from "highlight.js/lib/languages/sql";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";

const lowlight = createLowlight({
  javascript,
  json,
  typescript,
  xml,
  css,
  python,
  java,
  c,
  cpp,
  csharp,
  go,
  rust,
  php,
  ruby,
  sql,
  bash,
  yaml,
});

// Common aliases users type in code fences.
lowlight.register("html", xml);
lowlight.register("js", javascript);
lowlight.register("jsx", javascript);
lowlight.register("ts", typescript);
lowlight.register("tsx", typescript);
lowlight.register("py", python);
lowlight.register("sh", bash);
lowlight.register("shell", bash);
lowlight.register("zsh", bash);
lowlight.register("golang", go);
lowlight.register("yml", yaml);
lowlight.register("cs", csharp);

/**
 * Options for the editor's code-block language picker. Values must match
 * registered lowlight names/aliases so highlighting actually applies; the
 * leading "none" entry clears the block's language.
 */
export const CODE_LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "Plain text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash / Shell" },
  { value: "yaml", label: "YAML" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
];

export default lowlight;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/lowlight.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lowlight.ts src/lib/lowlight.test.ts
git commit -m "feat(editor): highlight 10 most common languages + expose picker options"
```

---

### Task 3: Format-aware excerpts

**Files:**

- Create: `src/lib/library-excerpt.ts`
- Test: `src/lib/library-excerpt.test.ts`
- Modify: `src/components/tethyr/library/item-card.tsx` (getExcerpt ~lines 50-55, usage ~line 70)

**Interfaces:**

- Produces: `getItemExcerpt(content: string, format: "html" | "markdown"): string` — max 120 chars + ellipsis.

- [ ] **Step 1: Write the failing test**

Create `src/lib/library-excerpt.test.ts`:

````ts
import { describe, it, expect } from "vitest";
import { getItemExcerpt } from "./library-excerpt";

describe("getItemExcerpt", () => {
  it("strips HTML tags for html items", () => {
    expect(getItemExcerpt("<p>Hello <b>world</b></p>", "html")).toBe("Hello world");
  });

  it("strips common markdown markers for markdown items", () => {
    const md = "# Title\n\nSome **bold** and _italic_ text with `code`.";
    expect(getItemExcerpt(md, "markdown")).toBe("Title Some bold and italic text with code.");
  });

  it("flattens markdown links and images to their text/src", () => {
    expect(getItemExcerpt("See [docs](https://x.y) now", "markdown")).toBe("See docs now");
    expect(getItemExcerpt("![logo](img.png)", "markdown")).toBe("logo");
  });

  it("ignores fenced code block markers", () => {
    const md = "Intro\n\n```js\nconst x = 1;\n```\n\nOutro";
    const out = getItemExcerpt(md, "markdown");
    expect(out).not.toContain("```");
    expect(out).toContain("Intro");
    expect(out).toContain("Outro");
  });

  it("truncates to 120 chars with an ellipsis", () => {
    const out = getItemExcerpt("a".repeat(300), "html");
    expect(out.length).toBe(121);
    expect(out.endsWith("…")).toBe(true);
  });

  it("returns empty string for empty content", () => {
    expect(getItemExcerpt("", "markdown")).toBe("");
  });
});
````

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/library-excerpt.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement library-excerpt.ts**

Create `src/lib/library-excerpt.ts`:

````ts
// Card excerpts for library items. HTML items strip tags; Markdown items get
// their syntax markers flattened so cards read like prose either way.

const MAX_LENGTH = 120;

function truncate(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > MAX_LENGTH ? trimmed.slice(0, MAX_LENGTH) + "…" : trimmed;
}

function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function markdownToText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ") // fenced blocks
    .replace(/`([^`]*)`/g, "$1") // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images → alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → text
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^>\s?/gm, "") // blockquotes
    .replace(/^\s*[-*+]\s+/gm, "") // bullets
    .replace(/^\s*\d+\.\s+/gm, "") // ordered lists
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/~~(.*?)~~/g, "$1"); // strikethrough
}

export function getItemExcerpt(content: string, format: "html" | "markdown"): string {
  if (!content) return "";
  return truncate(format === "markdown" ? markdownToText(content) : htmlToText(content));
}
````

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/library-excerpt.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it in item-card.tsx**

In `src/components/tethyr/library/item-card.tsx`:

Delete the local `getExcerpt` function (~lines 50-56) and replace its call site (~line 70):

```ts
const excerpt = getItemExcerpt(item.content, item.content_format ?? "html");
```

Add import:

```ts
import { getItemExcerpt } from "@/lib/library-excerpt";
```

(`item.content_format ?? "html"` keeps cards working before any data refresh.)

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck && npx vitest run src/lib/library-excerpt.test.ts`
Expected: clean.

```bash
git add src/lib/library-excerpt.ts src/lib/library-excerpt.test.ts src/components/tethyr/library/item-card.tsx
git commit -m "feat(library): format-aware card excerpts"
```

---

### Task 4: fetchRepoFile in shared GitHub helpers

**Files:**

- Modify: `src/lib/github.ts` (add after `fetchRepoReadme`, ~line 123)
- Test: `src/lib/github.test.ts` (add describe block)

**Interfaces:**

- Produces: `type RepoFileResult = { text: string | null; sha: string | null; notFound: boolean; rateLimited: boolean; unauthorized: boolean }`
- Produces: `fetchRepoFile(fullName: string, path: string, ref?: string, token?: string): Promise<RepoFileResult>`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/github.test.ts` (inside the existing imports, add `fetchRepoFile` to the import list from `"./github"`):

```ts
describe("fetchRepoFile", () => {
  it("fetches raw content and sha via the contents API", async () => {
    const content = btoa("# Hello file");
    const fetch = mockFetch(async (url) =>
      url.includes("api.github.com/repos/owner/repo/contents/README.md")
        ? Response.json({ content, encoding: "base64", sha: "abc123" })
        : new Response("nf", { status: 404 }),
    );
    const result = await fetchRepoFile("owner/repo", "README.md");
    expect(result).toEqual({
      text: "# Hello file",
      sha: "abc123",
      notFound: false,
      rateLimited: false,
      unauthorized: false,
    });
    expect(String(fetch.mock.calls[0][0])).toContain("repos/owner/repo/contents/README.md");
  });

  it("passes the ref as a query param and the token as a header", async () => {
    const fetch = mockFetch(async () =>
      Response.json({ content: btoa("x"), encoding: "base64", sha: "s" }),
    );
    await fetchRepoFile("owner/repo", "docs/a b.md", "dev", "ghp_secret");
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toContain("docs/a%20b.md");
    expect(String(url)).toContain("ref=dev");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer ghp_secret");
  });

  it("decodes multi-byte UTF-8 correctly", async () => {
    mockFetch(async () =>
      Response.json({
        content: btoa(String.fromCharCode(...new TextEncoder().encode("# héllo ✓"))),
        encoding: "base64",
        sha: "s",
      }),
    );
    const result = await fetchRepoFile("owner/repo", "README.md");
    expect(result.text).toBe("# héllo ✓");
  });

  it("flags missing files as notFound", async () => {
    mockFetch(async () => new Response("nf", { status: 404 }));
    const result = await fetchRepoFile("owner/repo", "missing.md");
    expect(result.notFound).toBe(true);
    expect(result.text).toBeNull();
  });

  it("flags 401 as unauthorized and 403/429 as rate-limited", async () => {
    mockFetch(async () => new Response("nope", { status: 401 }));
    expect((await fetchRepoFile("owner/repo", "f", undefined, "bad")).unauthorized).toBe(true);

    mockFetch(async () => new Response("limit", { status: 403 }));
    expect((await fetchRepoFile("owner/repo", "f")).rateLimited).toBe(true);
  });

  it("flags binary content via null bytes after decoding", async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x00, 0x03]); // PK zip header w/ NUL
    mockFetch(async () =>
      Response.json({
        content: btoa(String.fromCharCode(...bytes)),
        encoding: "base64",
        sha: "s",
      }),
    );
    const result = await fetchRepoFile("owner/repo", "file.zip");
    expect(result.text).toBeNull();
    expect(result.notFound).toBe(false);
    expect(result.rateLimited).toBe(false);
    expect(result.unauthorized).toBe(false);
  });

  it("surfaces network failures as a generic miss", async () => {
    mockFetch(async () => {
      throw new TypeError("down");
    });
    const result = await fetchRepoFile("owner/repo", "README.md");
    expect(result).toEqual({
      text: null,
      sha: null,
      notFound: false,
      rateLimited: false,
      unauthorized: false,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/github.test.ts`
Expected: FAIL — `fetchRepoFile` is not exported.

- [ ] **Step 3: Implement fetchRepoFile**

In `src/lib/github.ts`, add after `fetchRepoReadme` (before `GithubCommitLite`):

```ts
export type RepoFileResult = {
  text: string | null;
  /** Git blob SHA of the fetched file — used for idempotent re-sync. */
  sha: string | null;
  notFound: boolean;
  rateLimited: boolean;
  unauthorized: boolean;
};

function decodeBase64Utf8(b64: string): string {
  const bytes = Uint8Array.from(atob(b64.replace(/\n/g, "")), (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Fetch a single file from a repository via the contents API (JSON accept so
 * we also get the blob SHA for idempotent sync). Path segments are encoded
 * individually so spaces and slashes survive. Binary content (NUL byte after
 * decode) is rejected with text=null rather than surfaced as garbage.
 */
export async function fetchRepoFile(
  fullName: string,
  path: string,
  ref?: string,
  token?: string,
): Promise<RepoFileResult> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const search = new URLSearchParams();
  if (ref) search.set("ref", ref);
  const qs = search.size ? `?${search.toString()}` : "";

  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response | null;
  try {
    res = await fetchWithTimeout(
      `https://api.github.com/repos/${fullName}/contents/${encodedPath}${qs}`,
      { headers },
    );
  } catch {
    res = null;
  }
  if (!res)
    return { text: null, sha: null, notFound: false, rateLimited: false, unauthorized: false };
  if (res.status === 404)
    return { text: null, sha: null, notFound: true, rateLimited: false, unauthorized: false };
  if (res.status === 401)
    return { text: null, sha: null, notFound: false, rateLimited: false, unauthorized: true };
  if (res.status === 403 || res.status === 429)
    return { text: null, sha: null, notFound: false, rateLimited: true, unauthorized: false };
  if (!res.ok)
    return { text: null, sha: null, notFound: false, rateLimited: false, unauthorized: false };

  try {
    const json = (await res.json()) as { content?: string; encoding?: string; sha?: string };
    if (json.encoding !== "base64" || typeof json.content !== "string")
      return {
        text: null,
        sha: json.sha ?? null,
        notFound: false,
        rateLimited: false,
        unauthorized: false,
      };
    const text = decodeBase64Utf8(json.content);
    const binary = text.includes("\u0000");
    return {
      text: binary ? null : text,
      sha: json.sha ?? null,
      notFound: false,
      rateLimited: false,
      unauthorized: false,
    };
  } catch {
    return { text: null, sha: null, notFound: false, rateLimited: false, unauthorized: false };
  }
}
```

Note: `fetchWithTimeout` already catches network errors and returns null, so the try/catch here is belt-and-braces for `.json()` failures only — keep it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/github.test.ts`
Expected: PASS (existing + 7 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/github.ts src/lib/github.test.ts
git commit -m "feat(github): fetchRepoFile with sha + binary detection"
```

---

### Task 5: Server functions — link metadata fetch + sync

**Files:**

- Modify: `src/lib/github-server.ts` (append at end)

**Interfaces:**

- Consumes: `fetchRepoFile` from Task 4, `getStoredToken` (already in file).
- Produces: `fetchRepoFileServer({ fullName, path, ref? }): Promise<RepoFileResult>` (POST, auth-required)
- Produces: `syncLibraryItemFromGithub({ itemId }): Promise<SyncResult>` where

```ts
type SyncResult =
  | { ok: true; updated: boolean; source: GithubSource }
  | {
      ok: false;
      reason:
        | "not_linked"
        | "forbidden"
        | "not_found"
        | "rate_limited"
        | "unauthorized"
        | "binary"
        | "network";
    };
```

- Produces: `linkLibraryItemGithub({ itemId, repo, path, branch }): Promise<{ ok: boolean; reason?: "forbidden" }>`

- [ ] **Step 1: Add imports and server functions**

In `src/lib/github-server.ts`, extend the import from `"./github"`:

```ts
import {
  fetchRepoCommits,
  fetchRepoFile,
  fetchRepoMeta,
  fetchRepoReadme,
  fetchUserRepos,
  validateGitHubToken,
  type GithubCommitLite,
  type GithubRepoLite,
  type RepoFileResult,
  type RepoMeta,
  type RepoReadmeResult,
} from "./github";
import { parseGithubSource, type GithubSource } from "./github-source";
```

Append at the end of the file:

```ts
/** Fetch an arbitrary repo file on the server, using the stored token when present. */
export const fetchRepoFileServer = createServerFn({ method: "POST" })
  .validator((d: { fullName: string; path: string; ref?: string }) => ({
    fullName: d.fullName.trim(),
    path: d.path.replace(/^\/+/, "").trim(),
    ref: d.ref?.trim() || undefined,
  }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }): Promise<RepoFileResult> => {
    const token = await getStoredToken(context.userId);
    return fetchRepoFile(data.fullName, data.path, data.ref, token ?? undefined);
  });

/** Attach (or replace) a GitHub file link on a library item. Owner-only. */
export const linkLibraryItemGithub = createServerFn({ method: "POST" })
  .validator((d: { itemId: string; repo: string; path: string; branch?: string }) => ({
    itemId: d.itemId.trim(),
    repo: d.repo.trim(),
    path: d.path.replace(/^\/+/, "").trim(),
    branch: d.branch?.trim() || null,
  }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item } = await supabaseAdmin
      .from("library_items")
      .select("id, user_id")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item || item.user_id !== context.userId)
      return { ok: false as const, reason: "forbidden" as const };

    const source: GithubSource = {
      repo: data.repo,
      path: data.path,
      branch: data.branch,
      synced_at: null,
      sha: null,
    };
    const { error } = await supabaseAdmin
      .from("library_items")
      .update({ github_source: source })
      .eq("id", data.itemId);
    if (error) throw error;
    return { ok: true as const, source };
  });

/** Remove a GitHub file link without touching the item's content. Owner-only. */
export const unlinkLibraryItemGithub = createServerFn({ method: "POST" })
  .validator((d: { itemId: string }) => ({ itemId: d.itemId.trim() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item } = await supabaseAdmin
      .from("library_items")
      .select("id, user_id")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item || item.user_id !== context.userId)
      return { ok: false as const, reason: "forbidden" as const };

    const { error } = await supabaseAdmin
      .from("library_items")
      .update({ github_source: null })
      .eq("id", data.itemId);
    if (error) throw error;
    return { ok: true as const };
  });

export type SyncResult =
  | { ok: true; updated: boolean; source: GithubSource }
  | {
      ok: false;
      reason:
        | "not_linked"
        | "forbidden"
        | "not_found"
        | "rate_limited"
        | "unauthorized"
        | "binary"
        | "network";
    };

/**
 * Pull the linked GitHub file into a library item. Owner-only, manual, and
 * idempotent by blob SHA: syncing an unchanged file leaves content untouched.
 * Pulled content is Markdown by definition of the source format.
 */
export const syncLibraryItemFromGithub = createServerFn({ method: "POST" })
  .validator((d: { itemId: string }) => ({ itemId: d.itemId.trim() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }): Promise<SyncResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item } = await supabaseAdmin
      .from("library_items")
      .select("id, user_id, github_source")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item || item.user_id !== context.userId) return { ok: false, reason: "forbidden" };
    const source = parseGithubSource(item.github_source);
    if (!source) return { ok: false, reason: "not_linked" };

    const token = await getStoredToken(context.userId);
    const result = await fetchRepoFile(
      source.repo,
      source.path,
      source.branch ?? undefined,
      token ?? undefined,
    );
    if (result.unauthorized) return { ok: false, reason: "unauthorized" };
    if (result.rateLimited) return { ok: false, reason: "rate_limited" };
    if (result.notFound) return { ok: false, reason: "not_found" };
    if (!result.text) return { ok: false, reason: "binary" };
    if (source.sha && result.sha === source.sha) return { ok: true, updated: false, source };

    const synced: GithubSource = {
      ...source,
      synced_at: new Date().toISOString(),
      sha: result.sha,
    };
    const { error } = await supabaseAdmin
      .from("library_items")
      .update({ content: result.text, content_format: "markdown", github_source: synced })
      .eq("id", data.itemId);
    if (error) throw error;
    return { ok: true, updated: true, source: synced };
  });
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`
Expected: clean. (Server functions are thin over the tested `fetchRepoFile`; ownership guards mirror `syncGithubProjectActivity`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/github-server.ts
git commit -m "feat(library): server functions to link/unlink/sync GitHub files"
```

---

### Task 6: Format-aware NoteEditor + code-block language picker

**Files:**

- Modify: `src/components/tethyr/library/note-editor.tsx`
- Create: `src/lib/content-format.ts`
- Test: `src/lib/content-format.test.ts`

**Interfaces:**

- Consumes: `CODE_LANGUAGE_OPTIONS` (Task 2), `@tiptap/markdown` (installed).
- Produces: `NoteEditor({ content, onChange, editable?, format?: "html" | "markdown" })` — when `format="markdown"` the editor reads/writes Markdown strings; default `"html"` preserves current behavior.
- Produces: `htmlToMarkdown(html: string): string`, `markdownToHtml(md: string): string` in `src/lib/content-format.ts`.

- [ ] **Step 1: Write the failing converter tests**

Create `src/lib/content-format.test.ts`:

````ts
import { describe, it, expect } from "vitest";
import { htmlToMarkdown, markdownToHtml } from "./content-format";

describe("htmlToMarkdown", () => {
  it("converts headings, emphasis, and links", () => {
    const md = htmlToMarkdown(
      '<h1>Title</h1><p>Some <strong>bold</strong> <a href="https://x.y">link</a></p>',
    );
    expect(md).toContain("# Title");
    expect(md).toContain("**bold**");
    expect(md).toContain("[link](https://x.y)");
  });

  it("preserves fenced code blocks with their language", () => {
    const md = htmlToMarkdown('<pre><code class="language-python">print("hi")</code></pre>');
    expect(md).toContain("```python");
    expect(md).toContain('print("hi")');
  });
});

describe("markdownToHtml", () => {
  it("converts markdown back to HTML elements", () => {
    const html = markdownToHtml("# Title\n\nSome **bold** text.");
    expect(html).toMatch(/<h1>/);
    expect(html).toMatch(/<strong>bold<\/strong>/);
  });

  it("round-trips through both converters", () => {
    const original = "<h2>Plan</h2><ul><li>one</li><li>two</li></ul>";
    const roundTripped = markdownToHtml(htmlToMarkdown(original));
    expect(roundTripped).toMatch(/<h2>Plan<\/h2>/);
    expect(roundTripped).toMatch(/<li>one<\/li>/);
  });
});
````

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/content-format.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement content-format.ts**

Create `src/lib/content-format.ts`:

```ts
// One-off conversions between the Library's two storage formats. These run
// only when a user explicitly switches an item between Docs (HTML) and Code
// (Markdown) modes, so a headless Tiptap instance per call is fine.
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Image } from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";

function conversionExtensions() {
  return [
    StarterKit.configure({ codeBlock: false }),
    Link,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Image.configure({ HTMLAttributes: { class: "max-w-full" } }),
    Markdown,
  ];
}

export function htmlToMarkdown(html: string): string {
  const editor = new Editor({ extensions: conversionExtensions(), content: html });
  try {
    return editor.getMarkdown();
  } finally {
    editor.destroy();
  }
}

export function markdownToHtml(markdown: string): string {
  const editor = new Editor({
    extensions: conversionExtensions(),
    content: markdown,
    contentType: "markdown",
  });
  try {
    return editor.getHTML();
  } finally {
    editor.destroy();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/content-format.test.ts`
Expected: PASS.

- [ ] **Step 5: Make NoteEditor format-aware and add the language picker**

In `src/components/tethyr/library/note-editor.tsx`:

1. Add imports:

```ts
import { Markdown } from "@tiptap/markdown";
import { CODE_LANGUAGE_OPTIONS } from "@/lib/lowlight";
```

2. Change the component signature:

```ts
export function NoteEditor({
  content,
  onChange,
  editable = true,
  format = "html",
}: {
  content: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  format?: "html" | "markdown";
}) {
```

3. In `useEditor`: add `immediatelyRender: false,` as the first option (SSR/Suspense-safe, matches ReadmeEditor), conditionally include the Markdown extension, and switch the serializer:

```ts
const editor = useEditor({
  immediatelyRender: false,
  extensions: [
    StarterKit.configure({
      codeBlock: false,
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: "text-brand-green underline" },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    CodeBlockLowlight.configure({ lowlight }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    ExternalImage,
    SignedImage,
    Dropcursor.configure({ color: "var(--brand-green)", width: 2 }),
    ...(format === "markdown" ? [Markdown] : []),
  ],
  content,
  ...(format === "markdown" ? { contentType: "markdown" as const } : {}),
  editable,
  editorProps: {
    attributes: {
      class: "prose-custom focus:outline-none min-h-[60vh] px-4 py-6 text-sm leading-relaxed",
    },
  },
  onUpdate: ({ editor: e }) => {
    if (!onChange) return;
    onChange(format === "markdown" ? e.getMarkdown() : e.getHTML());
  },
});
```

4. External-content sync effect — make it format-aware:

```ts
useEffect(() => {
  if (!editor) return;
  const current = format === "markdown" ? editor.getMarkdown() : editor.getHTML();
  if (content !== current) {
    editor.commands.setContent(content, {
      ...(format === "markdown" ? { contentType: "markdown" as const } : {}),
      emitUpdate: false,
    });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [content]);
```

5. Add the language picker to `Toolbar`. Inside the `Toolbar` component (after the `addTable` helper), add:

```tsx
const activeLanguage = (editor.getAttributes("codeBlock").language as string | undefined) ?? "";
```

and render this select right after the Code block ToolbarButton (still inside the same flex group, before the following `<Separator>`):

```tsx
{
  editor.isActive("codeBlock") && (
    <select
      value={activeLanguage === "" ? "none" : activeLanguage}
      onChange={(e) => {
        const next = e.target.value;
        editor
          .chain()
          .focus()
          .setCodeBlockLanguage(next === "none" ? null : next)
          .run();
      }}
      aria-label="Code block language"
      className="h-8 rounded-lg border border-border/50 bg-background px-2 text-xs text-foreground outline-none"
    >
      {CODE_LANGUAGE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck && npm run test`
Expected: all green (existing NoteEditor usages compile against the optional prop).

```bash
git add src/components/tethyr/library/note-editor.tsx src/lib/content-format.ts src/lib/content-format.test.ts
git commit -m "feat(library): format-aware NoteEditor with code-block language picker"
```

---

### Task 7: Route integration — real modes, safe preview, GitHub link UI

**Files:**

- Modify: `src/routes/_authenticated/library.$id.tsx`
- Create: `src/components/tethyr/library/github-link-dialog.tsx`

**Interfaces:**

- Consumes: everything from Tasks 1-6 (`content_format`, `parseGithubSource`, converters, `listGithubRepos`, `fetchRepoFileServer`, `linkLibraryItemGithub`, `unlinkLibraryItemGithub`, `syncLibraryItemFromGithub`, `SyncResult`).
- Consumes: `useCurrentUser()` → `{ userId }`; `useQueryClient` from `@tanstack/react-query`; `libraryKeys.item(id)` from `@/hooks/use-library` (verify exact export name before use — it is used by `useUpdateItem`'s onSuccess).

- [ ] **Step 1: Install DOMPurify**

```bash
npm install dompurify
```

(v3 ships its own TypeScript types.)

- [ ] **Step 2: Create the GitHub link dialog**

Create `src/components/tethyr/library/github-link-dialog.tsx`:

```tsx
// Dialog for linking a library note/document to a file in one of the owner's
// GitHub repositories. Linking stores repo/path/branch only — nothing is
// pulled until the owner presses "Sync from GitHub".
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listGithubRepos } from "@/lib/github-server";
import { linkLibraryItemGithub } from "@/lib/github-server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

export function GithubLinkDialog({
  open,
  onOpenChange,
  itemId,
  initial,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  initial?: { repo: string; path: string; branch: string | null };
  onLinked: () => void;
}) {
  const [repo, setRepo] = useState(initial?.repo ?? "");
  const [path, setPath] = useState(initial?.path ?? "README.md");
  const [branch, setBranch] = useState(initial?.branch ?? "");

  const repos = useQuery({
    queryKey: ["github-repos"],
    queryFn: () => listGithubRepos(),
    enabled: open,
  });

  const submit = async () => {
    if (!repo.trim() || !path.trim()) return;
    const result = await linkLibraryItemGithub({
      data: { itemId, repo: repo.trim(), path: path.trim(), branch: branch.trim() || undefined },
    });
    if (result.ok) {
      onLinked();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link GitHub file</DialogTitle>
          <DialogDescription>
            Pick one of your repositories and the file to pull from. Nothing changes until you press
            “Sync from GitHub”.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="gh-repo">Repository</Label>
            {repos.isLoading ? (
              <div className="flex h-9 items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading repositories…
              </div>
            ) : (repos.data?.length ?? 0) > 0 ? (
              <select
                id="gh-repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                className="h-9 w-full rounded-lg border border-border/60 bg-background px-2 text-sm outline-none focus:border-primary"
              >
                <option value="">Choose a repository…</option>
                {repos.data!.map((r) => (
                  <option key={r.full_name} value={r.full_name}>
                    {r.full_name}
                    {r.private ? " (private)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-muted-foreground">
                No repositories found — connect GitHub in your profile first.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gh-path">File path</Label>
            <Input
              id="gh-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="README.md"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gh-branch">Branch (optional)</Label>
            <Input
              id="gh-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="Default branch"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!repo.trim() || !path.trim()}>
            Link file
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Note: check how other callers pass arguments to these server functions (TanStack Start v1 uses `linkLibraryItemGithub({ data: {...} })`). Match the call convention already used by `saveGithubToken`/`syncGithubProjectActivity` call sites (see `project-repos.tsx` / profile settings) and mirror it exactly.

- [ ] **Step 3: Wire the route**

In `src/routes/_authenticated/library.$id.tsx`:

1. Replace the placeholder paragraph (the `<p className="mt-3 text-[11px] …">` about publishing/GitHub sync, ~lines 290-294) and the later "GitHub sync" info box (~lines 380-394) with the real UI described below.

2. Add imports:

```ts
import { useQueryClient } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { Markdown as ReactMarkdown } from "react-markdown"; // alias to avoid clashing with tiptap import if added later
import remarkGfm from "remark-gfm";
import { Github, RefreshCw, Unlink } from "lucide-react";
import { libraryKeys } from "@/hooks/use-library"; // verify named export; adjust to actual
import { syncLibraryItemFromGithub, unlinkLibraryItemGithub } from "@/lib/github-server";
import { GithubLinkDialog } from "@/components/tethyr/library/github-link-dialog";
import { htmlToMarkdown, markdownToHtml } from "@/lib/content-format";
```

3. State/mode wiring inside `LibraryItemPage`:

```ts
const queryClient = useQueryClient();
const [workspaceMode, setWorkspaceMode] = useState<"docs" | "code">("docs");
const [ghDialogOpen, setGhDialogOpen] = useState(false);

// Sync local state when item loads
useEffect(() => {
  if (item) {
    setTitle(item.title);
    setContent(item.content);
    setProjectId(item.project_id ?? null);
    setWorkspaceMode(item.content_format === "markdown" ? "code" : "docs");
    setHasChanges(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [item?.id]);
```

Mode switching with explicit conversion (replaces the bare `setWorkspaceMode` calls in the toggle buttons):

```ts
function handleModeSwitch(target: "docs" | "code") {
  if (target === workspaceMode) return;
  const currentFormat = workspaceMode === "code" ? "markdown" : "html";
  const targetFormat = target === "code" ? "markdown" : "html";
  if (currentFormat !== targetFormat && content.trim()) {
    const confirmed = window.confirm(
      target === "code"
        ? "Convert this doc to Markdown? Rich-text formatting is translated as faithfully as possible."
        : "Convert this Markdown into rich text?",
    );
    if (!confirmed) return;
    setContent(target === "code" ? htmlToMarkdown(content) : markdownToHtml(content));
  }
  setWorkspaceMode(target);
  setHasChanges(true);
}
```

Toggle buttons call `handleModeSwitch("docs")` / `handleModeSwitch("code")`.

4. Save includes the format:

```ts
function handleSave() {
  if (!item) return;
  updateItem.mutate(
    {
      id: item.id,
      title,
      content,
      project_id: projectId,
      content_format: workspaceMode === "code" ? "markdown" : "html",
    },
    {
      onSuccess: () => {
        setHasChanges(false);
        toast.success("Saved");
      },
      onError: (err) => {
        toast.error(friendlyError(err, "Save failed"));
      },
    },
  );
}
```

5. Preview becomes format-aware and sanitized (replaces the `preview ?` article):

```tsx
{
  preview ? (
    workspaceMode === "code" ? (
      <article className="prose-custom min-h-[60vh] rounded-xl border card-border bg-surface/40 px-4 py-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </article>
    ) : (
      <article
        className="prose-custom min-h-[60vh] rounded-xl border card-border bg-surface/40 px-4 py-6"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
      />
    )
  ) : (
    <NoteEditor
      content={content}
      onChange={handleContentChange}
      format={workspaceMode === "code" ? "markdown" : "html"}
    />
  );
}
```

6. Editor description text reflects the mode (the banner copy stays as-is otherwise).

7. GitHub section — replace the old info box with (rendered for note/document types):

```tsx
{
  (item.type === "note" || item.type === "document") && isOwner && (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-surface/30 px-3 py-2 text-xs">
      <Github className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {item.github_source ? (
        <>
          <span className="font-medium text-foreground">
            {item.github_source.repo}/{item.github_source.path}
          </span>
          {item.github_source.branch && (
            <span className="text-muted-foreground">· {item.github_source.branch}</span>
          )}
          <span className="text-muted-foreground">
            ·{" "}
            {item.github_source.synced_at
              ? `Synced ${new Date(item.github_source.synced_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
              : "Not synced yet"}
          </span>
          <span className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            disabled={syncGithub.isPending}
            onClick={() => {
              if (
                hasChanges &&
                !window.confirm(
                  "Syncing replaces your unsaved edits with the GitHub version. Continue?",
                )
              )
                return;
              syncGithub.mutate(item.id);
            }}
          >
            {syncGithub.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Sync from GitHub
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            disabled={unlinkGithub.isPending}
            onClick={() => unlinkGithub.mutate(item.id)}
          >
            <Unlink className="h-3 w-3" />
            Unlink
          </Button>
        </>
      ) : (
        <>
          <span className="text-muted-foreground">
            Pull updates from a file in your GitHub repository — always on your terms.
          </span>
          <span className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setGhDialogOpen(true)}
          >
            <Github className="h-3 w-3" />
            Link GitHub file
          </Button>
        </>
      )}
    </div>
  );
}
{
  (item.type === "note" || item.type === "document") && (
    <GithubLinkDialog
      open={ghDialogOpen}
      onOpenChange={setGhDialogOpen}
      itemId={item.id}
      onLinked={() => {
        queryClient.invalidateQueries({ queryKey: libraryKeys.item(item.id) });
        toast.success("GitHub file linked");
      }}
    />
  );
}
```

with the mutations defined near the top of the component:

```ts
const isOwner = !!me?.userId && item?.user_id === me.userId;

const syncGithub = useMutation({
  mutationFn: (itemId: string) => syncLibraryItemFromGithub({ data: { itemId } }),
  onSuccess: (result) => {
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: libraryKeys.item(id) });
      toast.success(result.updated ? "Synced from GitHub" : "Already up to date");
      setHasChanges(false);
    } else {
      const messages: Record<string, string> = {
        not_found: "File not found in that repo — check the path/branch.",
        rate_limited: "GitHub rate limit hit — try again in a few minutes.",
        unauthorized: "GitHub rejected the saved token — reconnect it in your profile.",
        binary: "That file looks binary — link a text/Markdown file instead.",
        not_linked: "This item has no GitHub file linked.",
        forbidden: "Only the owner can sync this item.",
        network: "Couldn't reach GitHub — try again.",
      };
      toast.error(messages[result.reason] ?? "Sync failed");
    }
  },
});

const unlinkGithub = useMutation({
  mutationFn: (itemId: string) => unlinkLibraryItemGithub({ data: { itemId } }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: libraryKeys.item(id) });
    toast.success("GitHub link removed");
  },
});
```

Import `useMutation` alongside `useQueryClient` from `@tanstack/react-query`.

**Call-convention check:** confirm how existing code invokes server functions with validators (search for `saveGithubToken(` or `syncGithubProjectActivity(` call sites) and copy that exact convention — TanStack Start versions differ between `{ data }` and positional args. Adjust all three call sites above to match.

**`libraryKeys` check:** verify the export name in `src/hooks/use-library.ts` (used internally as `libraryKeys.item(variables.id)`); if it isn't exported, export it or inline the literal query key used by the hooks.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run test && npm run lint`
Expected: all green.

Manual smoke (optional but recommended): `npm run dev`, open a library note → toggle Docs/Code (confirm dialog appears, content converts), preview renders per format, language picker appears inside a code block.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_authenticated/library.\$id.tsx src/components/tethyr/library/github-link-dialog.tsx package.json package-lock.json
git commit -m "feat(library): real Docs/Code modes, safe preview, GitHub file link + sync"
```

---

### Task 8: Full verification gates

**Files:** none (verification only)

- [ ] **Step 1: Run the full suite**

```bash
npm run test && npm run typecheck && npm run lint
```

Expected: all pass.

- [ ] **Step 2: Route smoke**

```bash
npm run smoke
```

Expected: pass (route still renders).

- [ ] **Step 3: Fix anything found, then final commit if needed**

If gates surfaced fixes, commit them with a focused message, e.g.:

```bash
git add -A
git commit -m "fix(library): address review findings from workspace/sync work"
```

---

## Self-review notes (completed during planning)

- Spec coverage: content_format + github_source migration (Task 1), 14-language registry + aliases (Task 2), excerpts (Task 3), fetchRepoFile (Task 4), server fns incl. idempotent SHA sync (Task 5), format-aware editor + language picker (Task 6), mode switching with confirmation, sanitized/react-markdown preview, link/sync/unlink UI (Task 7), gates (Task 8).
- Two conventions flagged for implementer verification in Task 7: server-fn call convention and `libraryKeys` export name — both have explicit resolution instructions.
