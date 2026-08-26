# Tethyr Full Site Audit — 2026-08-26

**Scope:** full-stack audit of the Tethyr app: static checks, production-build runtime, security, performance, accessibility, SEO, and design-constitution conformance.

**Method:** `npm run typecheck` · `npm run lint` · `npm test` (372 tests) · `npm run build` · `npm run check:bundle` · `npm run smoke` (route smoke) · production preview server (`nitro preview` from `.output`, cloudflare-module preset) · Lighthouse desktop audit on the production build · authenticated browser walkthrough (Playwright) of dashboard, Creativity Studio, project page, public profile, and landing.

**Bottom line:** The architecture and most flows are in excellent shape — but the **current production build crashes on every page after the first render** (P0), and there is a **confirmed stored-XSS vector** in two block renderers (P0). Neither is caught by the existing test suite because both only manifest in production builds / public rendering paths.

---

## Critical

### C1. Production build crashes every route with "Something went wrong!" (Sentry double-init)

- **Where:** `src/lib/sentry.ts` (`initSentry`) called from `src/routes/__root.tsx` `RootShell` (line 134) on **every** root render.
- **What:** `Sentry.init({ ... replayIntegration() })` throws `Error: Multiple Sentry Session Replay instances are not supported` on the second call. `RootShell` re-renders on SSR, hydration, and every client-side navigation, so `initSentry()` runs multiple times per page in production. The thrown error is caught by the root error boundary → the whole page is replaced by "Something went wrong! / Show Error".
- **Evidence:** In the production build, `initSentry` threw twice (console at 470ms and 530ms) on a single page load; the homepage, `/login`, `/explore`, and `/dashboard` all rendered the error boundary. The first cold load of `/login` rendered fine — the crash appears on the second render pass (hydration re-render / SPA navigation / cached revisit), so real users will hit it on nearly every session.
- **Why tests miss it:** `initSentry()` returns early in `import.meta.env.DEV`, and all automated validation runs in dev mode. Only production builds are affected.
- **Fix:** make `initSentry` idempotent with a module-level guard (e.g. `let initialized = false; if (initialized) return; initialized = true;`).

### C2. Stored XSS in block markdown renderers (project README → public pages)

- **Where:** `src/components/tethyr/blocks/project/about-block.tsx` (`mdToHtml`) and `src/components/tethyr/blocks/content/markdown-block.tsx` (`markdownToHtml`). Both write unsanitized HTML via `dangerouslySetInnerHTML`.
- **What:** The renderers HTML-escape `& < >` but **not `"`**, and never validate URL schemes. Verified outputs:
  - `[x](javascript:location.href='//evil.example')` → `<a href="javascript:location.href='//evil.example'">` — **executes arbitrary JS on click**.
  - `[x](a" onmouseover="location.href=location.href//)` → `<a href="a" onmouseover="location.href=location.href//" ...>` — **attribute breakout, executes JS on hover**.
  - The image rule in `markdown-block.tsx` has the same `src`/`alt` breakout.
- **Impact:** `about-block` renders `projects.readme || vision || description` on every **public project page** (default layout: Hero → About → Status+Team → Activity, and backfill created pages for every existing project). `markdown-block` content is owner-authored but rendered publicly on any page it is placed on. Any project creator can execute script in every visitor's browser (session hijack, phishing, defacement).
- **Why tests miss it:** no tests exercise these renderers with adversarial input.
- **Fix options (smallest first):** escape `"` (and `'`) in addition to `& < >`; reject non-`http(s)`/`mailto` URL schemes; or pass rendered HTML through the already-installed `DOMPurify` (the codebase already uses it in `library.$id.tsx`). Better: replace both local renderers with `react-markdown` (already used for the README tab) so escaping is handled by a maintained library.

---

## High

### H1. CSP blocks Sentry ingestion — error tracking is dead in production

`src/lib/security-headers.ts` `connect-src` allows Supabase/GitHub but not `https://*.ingest.sentry.io` (the configured DSN uses `o4511944457453568.ingest.de.sentry.io`). Verified: every Sentry envelope request is refused. `VITE_SENTRY_DSN` is configured and `replaysOnErrorSampleRate: 1.0`, so the app silently loses all error/performance/replay data.

### H2. CSP blocks blob: workers

`script-src 'self' 'unsafe-inline'` with no `worker-src`/`blob:` — "Creating a worker from 'blob:…' violates CSP" on every production page load (Sentry Replay's worker). Add `worker-src 'self' blob:` (or disable Replay until the CSP is right).

### H3. Bundle budget exceeded

`npm run check:bundle` **fails**: main `index` chunk 731.5 kB raw / **229.6 kB gzip** vs 210 kB gzip budget; `lowlight` chunk 606 kB / 187.9 kB gzip. The Vite config raised `chunkSizeWarningLimit` to 650, which hides the raw-size warning but not the check. (The README editor is code-split; the remaining weight is the client index + lowlight.)

---

## Medium

### M1. 57 new `(supabase as any)` sites in the redesign code

Stage 6 claimed all hand-written `as any` sites were removed, but the block-system hooks and components reintroduced them: `use-templates.ts` (15), `use-fork.ts` (7), `use-page-editor.ts` (7), `use-theme-catalog.ts` (2), `use-page.ts`/`use-theme.ts`/`use-profile-page.ts`/`use-project-page.ts` (8), plus ~17 block components (`project/roles-block`, `milestones-block`, `needs-block`, `credits-block`, `timeline-block`, `evidence-block`, `sessions-block`, `discussions-block`, `repos-block`, `files-block`, `achievements-block`, `gallery-block`, `direction-block`, etc.). Typed `Database` queries should replace these (several blocks already use typed `supabase.from(...)` — the `as any` ones are inconsistent with the codebase's own standard).

### M2. Lint debt: 836 prettier errors + 120 warnings

`npm run lint` reports 956 problems — 836 auto-fixable prettier formatting errors concentrated in the redesign files (studio components, `page-blocks.ts`, `theme-tokens.ts`, hooks, blocks, routes), plus 120 real warnings: unused imports (many lucide icons, `Heading`, `Minus`, `timeAgo`, `useCurrentThemeInfo`, etc.), `@typescript-eslint/no-explicit-any`, one `no-empty` in `direction-block.tsx` (`catch {}`), and react-hooks deps warnings in `studio.tsx`/`page-shell.tsx` (`useCallback` depending on an inline `layout` logical expression). Run `npm run format` and address the warnings.

### M3. `/dev` preview route ships in production

`src/routes/dev.tsx` ("Remove this route before production", per its own banner and comment) is a normal route and **is present in the production bundle** (verified in `.output/server/_ssr/router-*.mjs`). It renders sample blocks with no auth and overrides the page title. Gate it to non-production or remove it before the next release.

### M4. Local DB schema drift (Studio + page queries 400)

Local `layouts` is missing `theme_id` and `pages` is missing `theme_overrides` even though `supabase migration list` marks all migrations applied → PostgREST 400s on `pages`/`layouts` selects; the Creativity Studio shows "This page couldn't be loaded", and every project/profile page fires 400s for the block queries (it degrades gracefully — the Studio's error state is well-built). Root cause: migration files were edited in place after being applied locally (foundation/theme migrations were modified, e.g. `theme_id` added to the `layouts` CREATE TABLE and `20260823170000` re-adds it). Migrations must be immutable. Fix locally with a clean `supabase db reset` (or apply the missing columns by hand); going forward, never edit an applied migration — add a new one.

### M5. sitemap.xml / robots.txt hard-500 when the site URL is unset

`src/lib/sitemap.ts` `publicOrigin()` throws `VITE_PUBLIC_SITE_URL must be configured in production` when the env var is missing/blank → **both endpoints return 500** (verified on the production build; `.env` here has no `VITE_PUBLIC_SITE_URL`). A config typo or missing var in any deployment silently kills every SEO-critical endpoint. Fall back to the request origin (as dev does), or return a graceful 404/empty robots, instead of throwing.

### M6. Landing hydration mismatch (signed image URLs)

`ProjectCardCover` renders a placeholder `<div>` server-side but an `<img src="…signed…">` client-side → React hydration mismatch on the landing page ("Hydration failed… tree will be regenerated on the client"), causing a flash and wasted re-render on every homepage visit. `data.tsx`'s comment claims signed URLs are resolved client-side to keep server/client identical, but the card component renders the image client-side instead of the server placeholder.

---

## Low / polish

- **Dashboard "0 rep"** chip next to the Create button reads as a bug against the seeded reputation data (empty state is legitimate for a brand-new account, but the visual is noisy).
- **Project hero label inconsistency:** the project hero shows both an "Active" badge and a `planning` chip from `stage` — two different status vocabularies in the same card (partly test data, but worth aligning).
- **Contribution heatmap a11y weight:** the 20-week heatmap renders ~140 tooltip nodes into the accessibility tree; consider `aria-hidden` + a single summary label.
- **`fetchLandingStats` swallows errors to 0** — if any count query fails (e.g. anon RLS gap on a table), the marquee silently shows a 0 that looks authoritative. `community_spaces`/`posts`/`comments` returned 0 via the anon key here (empty locally, so likely fine, but the fallback hides real failures).
- **`use-current-user.ts` trending-skills queries are unbounded full-table reads** (`skills`, `profile_skills_teach`, `profile_skills_learn`, `project_skills` without limit) — fine at 154 skills, a scaling risk later.

---

## What's healthy (verified)

- **Typecheck, 372 Vitest tests, production build, and route smoke all pass.** Smoke verifies 200/404 behavior, `robots.txt`, sitemap XML, and private `noindex` headers.
- **Lighthouse (production build, homepage): Performance 99, Accessibility 96, Best Practices 92, SEO 92, Agentic Browsing 100.** FCP/LCP 0.8 s, TBT 0 ms, CLS 0.004.
- **Security posture is strong elsewhere:** service-role key is server-only (`client.server.ts` proxy, never bundled); auth-boundary redirects work; `robots` noindex on private routes; CSP/X-Frame-Options/HSTS/Permissions-Policy headers present; the main README path renders through `react-markdown` (safe); `library.$id.tsx` sanitizes with DOMPurify; RLS suite (71 pgTAP assertions) and challenge-review hardening are in place from prior audits.
- **UX on the primary loop is coherent:** dashboard "Your next move" + focus presets, public profile (Direction → Featured work → Contributions → evidence → skills), project page (workbench → README → people → conversation → evidence) — all render cleanly with strong empty states, and the Creativity Studio degrades gracefully on data errors.
- **Responsive:** mobile viewport (390×844) renders cleanly — nav collapses, grids stack, no overflow.
- **Accessibility foundations:** skip link, `aria-current` nav, labeled dialogs, keyboard coverage for workspace/shelf/nav (from prior phases) — no console a11y warnings on audited pages.

---

## Suggested priority order

1. **C1** — one-line idempotency guard in `initSentry`; unblocks every user.
2. **C2** — sanitize/validate the two block renderers (escape quotes, allowlist URL schemes, or route through DOMPurify/react-markdown); add adversarial renderer tests.
3. **H1 + H2** — add Sentry ingest domain to `connect-src`, add `worker-src 'self' blob:`.
4. **M3** — gate/remove `/dev`.
5. **M5** — graceful fallback in `publicOrigin`.
6. **H3** — investigate index/lowlight chunk splitting (the README editor is already lazy; lowlight could be too).
7. **M1 + M2** — `npm run format`, clear the `as any` sites, fix the warning class (unused imports, `no-empty`, hook deps).
8. **M4** — reset local DB to a clean migration replay; stop editing applied migrations.
9. **M6** — server-render the same placeholder the client shows until the signed URL resolves.
