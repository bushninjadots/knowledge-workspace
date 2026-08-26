# Code Quality & Architecture Audit

**Date:** 2026-08-20
**Scope:** Full `src/` codebase, `supabase/migrations/`, tooling config
**Baseline:** 262 source files, 39 test files, 115 migrations, typecheck clean, 253 tests passing

---

## Summary

| Severity      | Count  |
| ------------- | ------ |
| P0 — Critical | 0      |
| P1 — High     | 4      |
| P2 — Medium   | 7      |
| P3 — Low      | 4      |
| **Total**     | **15** |

---

## P1 — High

### [P1] Duplicate type definitions: `SkillVerificationLevel` and `SkillExperienceLevel`

**File(s):** `src/hooks/use-current-user.ts:59-60`, `src/components/tethyr/profile-sections.tsx:84,100`
**Issue:** Identical union types defined in two separate modules.
**Evidence:**

```ts
// use-current-user.ts:59
export type SkillVerificationLevel = "self_declared" | "proof_certified" | "community_recognized";
// profile-sections.tsx:84 — identical
export type SkillVerificationLevel = "self_declared" | "proof_certified" | "community_recognized";
```

The same duplication exists for `SkillExperienceLevel`. Route files import from `use-current-user`, while profile components import from `profile-sections`. If either drifts, the types silently diverge.
**Recommendation:** Define each type in exactly one canonical location (likely `use-current-user.ts` since it's the profile data authority) and re-export from the other. Or move them to a shared `src/lib/types.ts`.

---

### [P1] Dead re-export in `use-current-user.ts`

**File(s):** `src/hooks/use-current-user.ts:7,9`
**Issue:** `use-current-user.ts` imports `ProjectRow` and `ActivityRow` from `profile-sections.tsx` and re-exports them, but no consumer imports them from `use-current-user`. All consumers import directly from `profile-sections.tsx`.
**Evidence:**

```ts
// use-current-user.ts:7-9
import type { ProjectRow, ActivityRow } from "@/components/tethyr/profile-sections";
export type { ProjectRow, ActivityRow };
```

Grep for `from.*use-current-user` with `ProjectRow` or `ActivityRow` returns zero results.
**Recommendation:** Remove the dead re-export to reduce confusion about the canonical source.

---

### [P1] `profile-sections.tsx` is a 1693-line monolith

**File(s):** `src/components/tethyr/profile-sections.tsx`
**Issue:** This single file contains 20+ exports spanning unrelated concerns: type definitions (`ProjectStatus`, `ProjectRow`, `ActivityRow`, `SkillVerificationLevel`, `SkillExperienceLevel`, `ProjectSkill`), display constants (`PROJECT_STATUS_LABEL`, `VERIFICATION_LABEL`, `EXPERIENCE_LABEL`, `VERIFICATION_STYLE`), inline components (`SectionCard`, `BannerStrip`, `ChipListCard`, `ProjectsCard`, `ExperienceBadge`, `VerificationBadge`, `TimelineCard`), a full CRUD dialog (`ProjectDialog` at ~640 lines), and a local `relTime` function.
**Evidence:** File is 1693 lines. ESLint would flag complexity warnings if configured for it. The `ProjectDialog` component alone spans lines 942–1582.
**Recommendation:** Split into focused modules:

- `src/lib/project-status.ts` — `ProjectStatus` type and display maps
- `src/components/tethyr/profile/skill-badges.tsx` — `ExperienceBadge`, `VerificationBadge`, skill types
- `src/components/tethyr/profile/project-card.tsx` — `ProjectsCard`
- `src/components/tethyr/profile/project-dialog.tsx` — `ProjectDialog`
- `src/components/tethyr/profile/timeline-card.tsx` — `TimelineCard`, `ActivityRow`
  Keep `profile-sections.tsx` as a barrel re-export for backward compatibility until consumers migrate.

---

### [P1] `as unknown as` type casts in production code (12 instances)

**File(s):**

- `src/routes/u.$handle.tsx:229`
- `src/routes/projects.$id.tsx:297,336,349,354,377`
- `src/hooks/use-current-user.ts:104,186`
- `src/hooks/use-public-studio-layout.ts:26,37`
- `src/lib/seo.ts:118`
  **Issue:** Double casts bypass TypeScript's type checker entirely. These are the production-code equivalent of `@ts-ignore` — they hide real type mismatches between Supabase generated types and application types.
  **Evidence:**

```ts
// projects.$id.tsx:297
project = res.data as unknown as ProjectDetail;
// use-current-user.ts:104
if (!error) return (data ?? null) as unknown as Profile | null;
// use-current-user.ts:186
const projects = (projectsRes.data ?? []) as unknown as ProjectRow[];
```

**Recommendation:** For each cast, either:

1. Fix the Supabase query to select the correct shape (preferred)
2. Define a Zod schema and validate the response
3. At minimum, narrow to a single `as` cast with a comment explaining why the types genuinely differ

---

## P2 — Medium

### [P2] Duplicate `relTime` function (reimplements `timeAgo`)

**File(s):** `src/components/tethyr/profile-sections.tsx:1636-1644`
**Issue:** A local `relTime` function duplicates the shared `timeAgo` from `src/lib/time.ts`. The logic is nearly identical (the only difference is `relTime` uses `30 * 86400` for month threshold while `timeAgo` uses `604800` for week threshold).
**Evidence:**

```ts
// profile-sections.tsx:1636
function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 30 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
```

10 other files correctly import `timeAgo` from `@/lib/time`.
**Recommendation:** Replace `relTime` with `timeAgo` from `@/lib/time`. If the month threshold matters, add `timeAgoLong` to `time.ts`.

---

### [P2] Duplicate `TYPE_ICONS` and `TYPE_COLORS` in library components

**File(s):** `src/components/tethyr/library/library-search-bar.tsx:8-20`, `src/components/tethyr/library/item-card.tsx:18-30`
**Issue:** Identical `TYPE_ICONS` and `TYPE_COLORS` maps duplicated across two library components.
**Evidence:**

```ts
// Both files contain:
const TYPE_ICONS: Record<string, typeof FileText> = {
  note: FileText,
  document: FileText,
  link: Globe,
  upload: Upload,
};
const TYPE_COLORS: Record<string, string> = {
  note: "text-brand-green",
  document: "text-learning",
  link: "text-teaching",
  upload: "text-ai",
};
```

**Recommendation:** Extract to `src/lib/library-types.ts` or a shared constants file in `src/components/tethyr/library/`.

---

### [P2] `ACTION_ICON` map in `composer-bar.tsx` overlaps with `TYPE_ICON` in `post-card.tsx`

**File(s):** `src/components/tethyr/community/composer-bar.tsx:63-78`, `src/components/tethyr/community/post-card.tsx:112-127`
**Issue:** Both maps cover the same `PostType` keys with overlapping but not identical icon choices. `ACTION_ICON` uses `Record<string, ...>` (loses type safety) while `TYPE_ICON` uses `Record<PostType, ...>`.
**Evidence:**

```ts
// composer-bar.tsx — untyped Record<string, ...>
const ACTION_ICON: Record<string, typeof Rocket> = {
  showcase: Rocket, question: HelpCircle, project_update: Rocket, ...
};
// post-card.tsx — typed Record<PostType, ...>
export const TYPE_ICON: Record<PostType, typeof Heart> = {
  showcase: Rocket, question: HelpCircle, project_update: Zap, ...
};
```

Note `project_update` maps to `Rocket` in one and `Zap` in the other.
**Recommendation:** Define a single canonical `POST_TYPE_ICON` map in `src/lib/community-data.ts` (which already owns `POST_TYPE_LABEL`) and use it in both files.

---

### [P2] Direct Supabase calls in components (bypassing hook layer)

**File(s):**

- `src/components/tethyr/profile-sections.tsx:217,224,1003,1020,1027,1033,1141`
- `src/components/tethyr/project/project-role-applications.tsx`
- `src/components/tethyr/project/project-files.tsx`
- `src/components/tethyr/project/project-files-explorer.tsx`
- `src/components/tethyr/project/project-resources.tsx`
- `src/components/tethyr/community/project-card-inline.tsx`
- `src/components/tethyr/community/attach-project-panel.tsx`
- `src/components/tethyr/sessions/schedule-session-wizard.tsx`
  **Issue:** 14 component files call `supabase.from(...)` or `supabase.storage.from(...)` directly instead of going through a hook. This scatters data logic across the UI layer and makes mutations harder to test or refactor.
  **Evidence:** `profile-sections.tsx` alone has 7 direct Supabase calls including `supabase.from("projects").delete()` and `supabase.storage.from("project-media").remove()`.
  **Recommendation:** Move direct Supabase calls into custom hooks (e.g., `useDeleteProject`, `useUploadProjectMedia`) and invalidate relevant query keys from the hook. This aligns with the project's established pattern in `use-projects.ts`, `use-community.ts`, etc.

---

### [P2] Migration naming inconsistency (23 UUID-named vs 92 descriptive)

**File(s):** `supabase/migrations/` — 23 files matching `*_???????-????-????-????-????????.sql`
**Issue:** 23 of 115 migrations use auto-generated UUID names (e.g., `20260803133659_87a8cdae-89df-4eb9-bb3c-8ce01fa19435.sql`) while 92 use descriptive names (e.g., `20260820200000_oauth_profile_names.sql`). The UUID-named migrations are harder to understand at a glance and suggest they were created outside the normal workflow.
**Recommendation:** No action needed for existing migrations (they're already applied). Going forward, enforce descriptive names via a migration template or lint check.

---

### [P2] `data/mocks/` directory contains real constants, not mocks

**File(s):** `src/data/mocks/catalog.ts`, `src/data/mocks/availability.ts`, `src/data/mocks/community-nav.ts`
**Issue:** These files are named `mocks/` but contain production constants (category taxonomy, availability options, navigation structure) imported by production components. The naming is misleading.
**Evidence:**

```ts
// catalog.ts header: "Explore / catalog constants — the shared filter taxonomy"
// Imported by: explore.tsx, project-shelf-header.tsx (production components)
```

**Recommendation:** Rename to `src/data/constants/` or `src/data/catalog/` to reflect their actual role.

---

### [P2] Test coverage gap: 39 tests for 262 source files (15%)

**File(s):** `src/` (project-wide)
**Issue:** Only 39 test files exist. Key untested areas:

- **Routes:** 0 route-level tests (except `settings.test.tsx`)
- **Components:** 18 component tests, but major components like `post-card.tsx` (1200 lines), `composer-bar.tsx` (1058 lines), `project-readme.tsx` (699 lines), `global-search.tsx` (605 lines) have no tests
- **Hooks:** 5 hook tests out of 25+ hooks — `use-community.ts` (631 lines), `use-sessions.ts` (815 lines), `use-library.ts` (706 lines) untested
- **Lib:** 10 lib tests out of 20+ modules — `reputation.ts` (320 lines), `workspace-layouts.ts` (538 lines) untested
  **Recommendation:** Prioritize tests for: (1) complex hooks with mutation logic, (2) security-sensitive validators, (3) the community post composer/parser, (4) workspace layout persistence.

---

## P3 — Low

### [P3] `@ts-expect-error` in `router.tsx:21`

**File(s):** `src/router.tsx:21`
**Issue:** A documented `@ts-expect-error` suppresses a TanStack/React Query serialization type mismatch. The comment explains the issue clearly, so this is acceptable but worth tracking.
**Evidence:**

```ts
// @ts-expect-error DehydratedState fails ValidateSerializableInput
dehydrate: () => ({ queryClientState: dehydrate(queryClient) }),
```

**Recommendation:** No action needed. Track whether TanStack Router resolves this in a future version.

---

### [P3] `const sb = supabase` alias used in 28 files

**File(s):** 28 files across `src/hooks/`, `src/components/`, `src/routes/`
**Issue:** A thin `const sb = supabase` alias is used in 28 files. It provides no functional benefit and adds a layer of indirection. Some files (e.g., `profile-sections.tsx`) use both `sb` and `supabase` interchangeably.
**Recommendation:** Standardize on importing `supabase` directly. Remove `const sb = supabase` lines in new code.

---

### [P3] `console.error` / `console.warn` in production code (9 instances)

**File(s):**

- `src/server.ts:46,76` — SSR error handling (intentional)
- `src/start.ts:14` — middleware error (intentional)
- `src/routes/__root.tsx:42` — root error boundary (intentional)
- `src/lib/sitemap.ts:91` — sitemap generation warning
- `src/lib/seo.ts:26` — SEO metadata warning
- `src/integrations/supabase/client.ts:45`, `auth-middleware.ts:46`, `client.server.ts:45` — Supabase connection diagnostics
  **Issue:** These are intentional server-side/diagnostic logs, not leftover debug statements. However, there's no structured logging — some use `console.error`, some `console.warn`, with no way to control log levels in production.
  **Recommendation:** Acceptable for now. Consider adding a lightweight logger module (e.g., `src/lib/logger.ts`) that can be swapped for structured logging later.

---

### [P3] `use-community.ts` is 631 lines mixing types, queries, and mutations

**File(s):** `src/hooks/use-community.ts`
**Issue:** This hook defines 10+ exported types, 4+ query hooks, and 6+ mutation hooks in a single file. It's imported by 14 other files, creating a high-traffic coupling point.
**Recommendation:** Consider splitting types into `src/lib/community-types.ts` and keeping queries/mutations in `use-community.ts`. Not urgent — the file is well-organized internally with section comments.

---

## Positives

1. **Zero `as any` usage.** ESLint's `@typescript-eslint/no-explicit-any: "warn"` is enforced and the codebase respects it. This is excellent discipline.

2. **Well-documented `@ts-expect-error`.** The single suppression in `router.tsx:21` has a clear comment explaining the upstream type mismatch. No unexplained suppressions.

3. **Clean type system.** No `@ts-ignore` usage anywhere. TypeScript strict mode is clean.

4. **Strong security awareness.** `safeHref`, `isSafeUrl`, `validateImageFile`, `friendlyError` (which strips internal DB errors), and `security-headers.ts` show consistent security hygiene.

5. **Good separation of concerns in lib/.** Modules like `credits.ts`, `reputation.ts`, `notification-destinations.ts`, `profile-completeness.ts`, and `project-seasons.ts` are small, focused, and well-tested where they exist.

6. **Consistent hook patterns.** The established pattern of `const sb = supabase` → query → invalidate is followed consistently across `use-projects.ts`, `use-community.ts`, `use-challenges.ts`, `use-teams.ts`, etc.

7. **Single source of truth for most display constants.** `community-data.ts` owns `POST_TYPE_LABEL`, `QUICK_ACTIONS`, `POST_FLAIRS`. `catalog.ts` owns `PROJECT_CATEGORIES`. `notification-categories.ts` owns `TYPE_CATEGORY`. This is the right pattern — just needs to be extended to the duplicated icon maps.

8. **Migration ordering is consistent.** 92 of 115 migrations use the `YYYYMMDDHHMMSS_descriptive_name.sql` convention. The date-stamped ordering is correct and sequential.

9. **ESLint config is clean and purposeful.** The `no-restricted-imports` rule blocking `server-only`, the `_`-prefix convention for unused params, and the explicit disabling of `react-refresh/only-export-components` all show intentional configuration.

10. **253 tests passing, typecheck clean, build succeeds.** The project is in a healthy baseline state.
