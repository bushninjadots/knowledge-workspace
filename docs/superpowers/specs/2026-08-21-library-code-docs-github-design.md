# Library Code/Docs Workspaces + GitHub File Sync — Design

Date: 2026-08-21
Status: Approved (pending implementation)

## Problem

The Library item page (`src/routes/_authenticated/library.$id.tsx`) has a
Docs/Code workspace toggle that is cosmetic: both modes render the identical
rich-text editor and nothing about output changes. Related findings from the
audit:

1. **Toggle does nothing.** `workspaceMode` only swaps the banner icon/text.
2. **Format mismatch.** The Library editor stores Tiptap HTML, while the project
   README editor (`src/components/tethyr/project/readme-editor.tsx`) already
   reads/writes Markdown via `@tiptap/markdown`. GitHub content is Markdown, so
   any future GitHub pull would render broken.
3. **No language picker.** Code blocks cannot get a language assigned from the
   UI at all; `src/lib/lowlight.ts` registers only JavaScript, TypeScript,
   JSON, and XML/HTML.
4. **Unsafe/inflexible preview.** Preview injects stored content with raw
   `dangerouslySetInnerHTML`; it cannot render Markdown and is unsanitized.
5. **Excerpts break on non-HTML.** `item-card.tsx` strips HTML tags only;
   Markdown items would show raw `#`/`**` syntax.

## Goals

- Make the Docs and Code workspaces real and correct in their output format.
- Support the most common programming languages for syntax highlighting, with
  a UI to pick a language for a code block.
- Let an owner link a library note/document to a file in one of their GitHub
  repositories and pull updates manually (opt-in). No auto-sync, no push.

## Non-goals

- Two-way sync or pushing commits to GitHub.
- Automatic/background syncing.
- Migrating existing HTML items to Markdown (Approach 3 was rejected).

## Design

### 1. Data model (one migration)

```sql
ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS content_format TEXT NOT NULL DEFAULT 'html'
    CHECK (content_format IN ('html','markdown'));

ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS github_source JSONB;
```

- `content_format`: `'html'` (rich text) or `'markdown'`. Existing rows default
  to `'html'`, so nothing changes for current items.
- `github_source`: `null` when unlinked; otherwise
  `{ "repo": "owner/name", "path": "README.md", "branch": "main", "synced_at": ISO8601, "sha": "..." }`.
- Update generated types in `src/integrations/supabase/types.ts` and the local
  `LibraryItem` type in `src/hooks/use-library.ts`.

### 2. Real Docs / Code workspaces

- **Docs mode**: unchanged — Tiptap rich text storing HTML,
  `content_format='html'`.
- **Code mode**: rebuilt on the pattern proven in `readme-editor.tsx`:
  Tiptap + `@tiptap/markdown`, reading and writing real Markdown source,
  `content_format='markdown'`.
- The toggle switches editors. Each mode saves in its own declared format.
- Switching modes on an item whose `content_format` doesn't match asks for a
  one-time confirmation ("This converts your doc between rich text and
  Markdown") before converting; no silent mangling.

### 3. Correct preview

- HTML items: render through [DOMPurify](https://github.com/cure53/DOMPurify)
  (new dependency, ~20 kB) instead of raw `dangerouslySetInnerHTML`.
- Markdown items: render via `react-markdown` + `remark-gfm`, matching how
  project READMEs render.

### 4. Language support

Extend `src/lib/lowlight.ts` from 4 grammars to:

JavaScript/JSX · TypeScript/TSX · Python · Java · C · C++ · C# · Go · Rust ·
PHP · Ruby · SQL · Bash/Shell · YAML (+ existing HTML/CSS/JSON)

with common aliases (`py`, `sh`, `shell`, `zsh`, `golang`, `yml`, `cs`, `cpp`,
…).

Add a **language dropdown** to the editor toolbar that appears when the cursor
is inside a code block, using Tiptap's `setCodeBlockLanguage`. This is the only
way users can currently assign a language in the rich-text surface.

### 5. Format-aware excerpts

`getExcerpt` in `item-card.tsx` becomes format-aware: strip tags for HTML
items; strip common Markdown markers (headings, emphasis, fences, links) for
Markdown items so cards read cleanly.

### 6. GitHub file link + manual sync

Server functions in `src/lib/github-server.ts` (token stays server-side):

- `fetchRepoFileServer({ fullName, path, ref? })` — GitHub contents API with
  raw media type; returns `{ text, sha }`. Error mapping consistent with
  `fetchRepoReadme`: 404 → not found, 401 → unauthorized, 403/429 → rate
  limited, network failure → null.
- `syncLibraryItemFromGithub({ itemId })` — owner-only (RLS enforces owner
  writes); fetches the linked file, stores its text into `content`, sets
  `content_format='markdown'`, updates `github_source.synced_at` and `.sha`.
  Idempotent by SHA: re-syncing an unchanged file is a no-op.

UI on the library item page (note/document types only, owner actions):

- **Link GitHub file** → dialog with repo picker (existing `listGithubRepos`
  server function), file path input defaulting to `README.md`, optional branch.
  Linking alone does not overwrite content until the first sync.
- Once linked: **Sync from GitHub** button, last-synced time, and
  `repo/path` display. If there are unsaved local edits, sync asks for
  confirmation before overwriting.
- **Unlink** removes the link without touching content.

### 7. Error handling

- 404 → "File not found in that repo — check the path/branch."
- Rate limited → retry-later message.
- Unauthorized → point the user at reconnecting GitHub in their profile.
- Binary/non-UTF8 files → rejected with a clear message.
- All surfaced through the existing `friendlyError` + toast patterns.

### 8. Testing

- Unit tests (vitest, following `src/lib/github.test.ts` style):
  - lowlight registry completeness and alias coverage.
  - Markdown excerpt stripping.
  - `github_source` parse/validation helpers.
  - Sync SHA idempotence logic with mocked fetch.
- Regression gates: `npm run test`, `npm run typecheck`, `npm run lint`.

## Files touched (expected)

- `supabase/migrations/20260821XXXXXX_library_content_format_github.sql`
  (new; timestamp assigned at implementation, following the repo's dated
  migration convention)
- `src/lib/lowlight.ts`
- `src/components/tethyr/library/note-editor.tsx`
- `src/components/tethyr/library/markdown-editor.tsx` (new, or shared with
  readme-editor)
- `src/components/tethyr/library/github-link-dialog.tsx` (new)
- `src/routes/_authenticated/library.$id.tsx`
- `src/components/tethyr/library/item-card.tsx`
- `src/hooks/use-library.ts`
- `src/lib/github-server.ts`, `src/lib/github.ts`
- `src/integrations/supabase/types.ts`

## Decisions

- Approach 1 chosen over minimal patch (fragile format sniffing) and full
  Markdown unification (migration blast radius).
- Manual pull-only sync per user request ("so it updates but that should be an
  option").
- Project link is _not_ required to link a GitHub file — any note/document can
  be linked directly by its owner.
