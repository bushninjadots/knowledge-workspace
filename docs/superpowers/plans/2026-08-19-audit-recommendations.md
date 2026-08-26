# Audit Recommendations Implementation Plan

## Context

Full site audit completed. 8 key findings already fixed and pushed. These are the remaining recommendations.

## Global Constraints

- All changes must pass `npm run lint`, `npm run typecheck`, and `npm test` (160/160 tests)
- Do not modify any database migrations or Supabase schema
- Follow existing code patterns and conventions
- Do not add new dependencies unless absolutely necessary
- Preserve all existing functionality

## Task 1: Move /dashboard under _authenticated layout

Move `/dashboard` from `src/routes/dashboard.tsx` to `src/routes/_authenticated/dashboard.tsx`. Remove the duplicated `AuthenticatedDashboardLayout` code (~80 lines) and reuse `AuthenticatedShell` from the `_authenticated/route.tsx` layout. The dashboard currently renders its own sidebar, header, mobile menu, and scroll-to-top — all of which already exist in `AuthenticatedShell`. After moving, the dashboard page should just render its content directly since `AuthenticatedShell` provides the chrome.

**Files to modify:**

- Move `src/routes/dashboard.tsx` → `src/routes/_authenticated/dashboard.tsx`
- Remove `AuthenticatedDashboardLayout` component from dashboard.tsx
- Remove duplicated sidebar/header/mobile nav imports and rendering
- The dashboard should render its content directly (useCurrentUser, WorkspaceGrid, etc.)
- Update any hardcoded `/dashboard` links if needed (shouldn't be needed since the path stays the same)

**Risk:** The dashboard currently has `ssr: false` and does auth checks via `DashboardStateBoundary`/`useCurrentUser`. After moving under `_authenticated`, auth is enforced by `beforeLoad` in `_authenticated/route.tsx`, which is actually better.

## Task 2: Fix N+1 profile hydration in 7 hooks

Convert the fetch-then-hydrate pattern to PostgREST embedded resource selects where possible. The pattern is: fetch rows → extract author IDs → batch-fetch profiles → merge back.

**Target hooks:**

- `useProjectUpdates` in `src/hooks/use-projects.ts` (lines ~249-283)
- `useDiscussions` in `src/hooks/use-projects.ts` (lines ~364-412)
- `useDiscussionReplies` in `src/hooks/use-projects.ts` (lines ~467-501)
- `useProjectActivity` in `src/hooks/use-projects.ts` (lines ~726-763)
- `useComments` in `src/hooks/use-community.ts` (lines ~411-458)
- `hydratePosts` in `src/hooks/use-community.ts` (lines ~210-281)
- `fetchConnections` in `src/hooks/use-connections.ts` (lines ~41-61)

**Approach:** Use Supabase PostgREST joins: `.select("*, author:profiles!author_id(id, display_name, handle, avatar_url)")`. This collapses 2-3 round trips into 1. For hooks that need more profile fields, include them in the join select.

## Task 3: Split use-community-spaces.ts (1292 lines)

Break the monolithic file into focused sub-hooks:

- `use-space-members.ts` — member management, bans
- `use-space-chat.ts` — chat messages, real-time subscription
- `use-space-reports.ts` — content reports, moderation
- `use-space-join-requests.ts` — join request management
- `use-space-settings.ts` — space settings mutations
- Keep `use-community-spaces.ts` as the main hook that composes the above

## Task 4: Convert useNotificationsByCategory to database query

Replace JS-side aggregation in `src/hooks/use-notifications.ts` (lines ~135-157) with a database GROUP BY query. Use `.select("type, count").eq("user_id", userId).eq("read_at", null).group("type")` or an RPC function.

## Task 5: Add pagination/limits to unbounded queries

Add `.limit(50)` or cursor-based pagination to:

- `useDiscussions` in `src/hooks/use-projects.ts`
- `useMilestones` in `src/hooks/use-projects.ts`
- `useProjectActivity` in `src/hooks/use-projects.ts`
- `useOpenRoles` in `src/hooks/use-projects.ts`
- `useProjectNeeds` in `src/hooks/use-projects.ts`

## Task 6: Add inline field validation

Replace toast-only validation with inline field errors in:

- `src/routes/signup.tsx` — password length, handle format
- `src/routes/login.tsx` — email required
- `src/routes/reset-password.tsx` — password length, match
- Use existing shadcn `Label` component and add error text below inputs

## Task 7: Create shared test helper

Extract `createFakeSupabase()` from the 4+ test files that copy-paste it into `tests/helpers/fake-supabase.ts`. Update existing tests to import from the shared helper.

## Task 8: Replace window.confirm with styled dialog

Replace `window.confirm("Withdraw request?")` in `src/routes/_authenticated/connections.tsx:142` with a Radix AlertDialog or the existing shadcn dialog pattern.
