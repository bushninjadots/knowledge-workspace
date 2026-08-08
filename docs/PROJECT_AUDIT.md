# Tethyr Project Audit

> Conducted: August 8, 2026
> Status: Initial audit complete — high-priority items remediated, remaining debt tracked below.

---

## Executive Summary

The codebase is in strong health. The app builds, typechecks, boots, and every runtime
path exercised responds correctly. No secrets are committed, RLS is comprehensively
enforced, and security headers are shipped. The issues found were **technical debt,
not broken functionality** — and the highest-ROI items (lint, dependencies, CI coverage)
have been remediated in this pass.

---

## Baseline Results (before fixes)

| Check | Before | After |
|---|---|---|
| `tsc --noEmit` | ✅ 0 errors | ✅ 0 errors |
| `vitest run` | ✅ 33/33 | ✅ 33/33 |
| `npm run build` | ✅ | ✅ |
| Route smoke test | ✅ | ✅ |
| `eslint .` | ❌ 577 problems (486 errors / 91 warnings) | ✅ 0 errors / 83 warnings |
| `npm audit` | ❌ 5 vulns (3 high) | ⚠️ 1 low (esbuild, dev-only) |
| `bun audit` | ❌ 17 vulns (12 high) | ⚠️ 1 low (esbuild, dev-only) |

---

## Remediated (this pass)

### 1. Lint debt eliminated
- **486 Prettier formatting errors** auto-fixed via `eslint . --fix`. Lint now passes with
  0 errors; only `no-explicit-any` / react-hooks warnings remain.
- The repo had drifted from its own formatter (`.prettierrc`), meaning CI lint was red.
- **Formatter pinned for reproducibility**: the dual lockfiles (npm + bun) had resolved
  different prettier/eslint/vite/tailwind versions, so lint results depended on which
  package manager installed node_modules. Pinned `prettier` (3.9.6), `eslint` (9.39.5),
  `vite` (8.2.1), `tailwindcss` (4.3.3) to exact versions in `package.json` — lint and
  build output are now deterministic regardless of package manager.

### 2. Dependency vulnerabilities resolved + refreshed
- `npm audit fix`: postcss 8.5.15→8.5.26, js-yaml 4.1.1→4.3.1, nanoid 3.3.11/12→3.3.18.
  **All 3 high-severity advisories cleared.**
- bun.lock was stale (frozen-lockfile workflow). Full re-resolve: **17 vulns → 1 low**
  (esbuild via `tsx`/`lovable-tagger`, Windows dev-server only; no in-range fix exists).
- **Dependency refresh:** all direct deps bumped to latest in-range (react 19.2.8,
  @tiptap 3.29.2, @supabase/supabase-js 2.112.2, @tanstack/* latest, @radix-ui/* latest).
  `package.json` and **both lockfiles** are in sync and verified: typecheck, lint, tests,
  build, and route smoke all pass on the new versions.
- `bunfig.toml` supply-chain guard (`frozenLockfile`, `minimumReleaseAge`) untouched.

### 3. CI hardened (`.github/workflows/ci.yml`)
Added to the existing typecheck/lint/test/build pipeline:
- **Route smoke test** (`npm run smoke`) via `oven-sh/setup-bun` — boots the dev server
  and asserts public routes + 404 + client-auth boundary.
- **Dependency audit** — `npm audit --audit-level=moderate` (tolerates the known low).
- **RLS regression job** (`db-rls`) — fresh local Postgres via the official Supabase CLI:
  `supabase start` → `db reset` → `test db` (26 pgTAP tests in
  `supabase/tests/rls_regression.sql`) → `stop`. This closes the gap where migrations
  shipped with RLS verified only manually.

### 4. Typed-client refactor started
The full generated `Database` type (2,727 lines) exists but ~110 `(supabase as any)`
casts bypassed it. Converted to the typed client (verified by `tsc`):
- `src/hooks/use-follow.ts`
- `src/hooks/use-signed-url.ts`
- `src/hooks/use-project-repos.ts`
- `src/hooks/use-layout-preferences.ts`
- `src/hooks/use-current-user.ts` (2 casts)
- `src/lib/reputation.ts` (typed `award_earned_achievements` RPC)

---

## Remaining tracked debt

### High
- **~95 remaining `(supabase as any)` casts** across ~25 files (`use-projects.ts`,
  `use-sessions.ts`, `use-community.ts`, `use-community-spaces.ts`, `use-challenges.ts`,
  `use-notifications.ts`, `dashboard.tsx`, `explore.tsx`, `u.$handle.tsx`,
  `skills.$slug.tsx`, and components). Column typos and shape mismatches compile silently.
  Convert file-by-file (pattern proven in the hooks above); regenerate `types.ts` first
  (`supabase gen types`) so new tables/columns are covered.

### Medium
- **Test coverage is thin for ~50k LOC.** Only 5 test files / 33 tests. No tests for the
  largest surfaces (explore, dashboard, community, sessions, skills, messages, library,
  notifications, auth flows). Coverage provider not installed — add `@vitest/coverage-v8`
  and enforce a floor for core hooks/routes.
- **Giant route files** — `explore.tsx` (~770 lines), `skills.$slug.tsx` (~580),
  `dashboard.tsx` (~500), `u.$handle.tsx`. Query logic inlined at route level; extract to
  hooks/selectors for testability.

### Low / Process
- **CSP uses `'unsafe-inline' 'unsafe-eval'`** for `script-src` (Vite/Tiptap necessity) and
  broad `img-src https:` / `connect-src *.supabase.co`. Tighten before launch.
- **3 open critical UX items** (see `docs/UX_AUDIT.md`): no "Create Project" button in the
  navbar / dashboard / explore; Library can't share items to projects.
- **Git history quality**: repeated generic squashed messages ("to many to mention",
  "reporting tools and admin roles"). Commit messages are lost context.
- **Lint warnings** (83): mostly `no-explicit-any` (tied to the refactor above) plus 3
  react-hooks `exhaustive-deps` warnings in `projects.$id.tsx`, `use-layout-preferences.ts`
  usage, and `dashboard.tsx` — fix alongside the typed refactor.

---

## Recurring verification commands

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint . (0 errors expected)
npm test            # vitest run
npm run build       # vite build (SSR)
npm run smoke       # route smoke test (needs bun)
npm audit --audit-level=moderate
bun audit           # dev-side audit (frozen bun.lock)
supabase db reset && supabase test db   # RLS regression suite (local)
```
