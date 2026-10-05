# Audit 5 — Performance & Bundle Size

**Date:** 2026-08-20
**Auditor:** opencode (automated)
**Scope:** Unbounded queries, lazy loading, bundle size per route, SSR, image optimization, re-renders, large dependencies, code splitting

---

## Summary Table

| Severity | Count | Key Theme                                                              |
| -------- | ----- | ---------------------------------------------------------------------- |
| P0       | 3     | Unbounded Supabase queries that will degrade as data grows             |
| P1       | 5     | Heavy client chunks (lowlight 480KB, main 418KB), missing lazy loading |
| P2       | 4     | Missing limits on social-graph queries, duplicated hydration logic     |
| P3       | 3     | Minor optimization opportunities                                       |

---

## P0 — Unbounded Queries

### [P0] useCurrentUser fetches ALL user projects without limit

**File(s):** `src/hooks/use-current-user.ts:152-159`
**Issue:** The projects query in `fetchCurrentUser()` has no `.limit()`. Every authenticated page load fetches the user's entire project list.
**Impact:** Users with 50+ projects load all project data (including full `*` columns: gallery arrays, resources arrays, links objects) on every page navigation. This blocks the current-user query waterfall.
**Evidence:**

```ts
supabase
  .from("projects")
  .select("*")
  .eq("profile_id", userId)
  .order("is_featured", { ascending: false })
  .order("created_at", { ascending: false }),
```

**Recommendation:** Add `.limit(50)` and consider selecting only the columns needed for the shelf display (id, title, description, status, stage, cover_url, is_featured) instead of `*`.

### [P0] useMyProjects fetches ALL user projects without limit

**File(s):** `src/hooks/use-projects.ts:873-877`
**Issue:** Same as above — `useMyProjects()` fetches every project the user owns with no limit.
**Impact:** Project picker dropdowns and dashboard shelves grow linearly with user's project count.
**Evidence:**

```ts
const { data, error } = await sb
  .from("projects")
  .select("id, title, description, status, stage, cover_url")
  .eq("profile_id", user.id)
  .order("updated_at", { ascending: false });
```

**Recommendation:** Add `.limit(50)` and paginate if needed. The project picker only shows ~10 items.

### [P0] useCommunitySpaces fetches ALL spaces without limit

**File(s):** `src/hooks/use-community-spaces.ts:70-73`
**Issue:** Fetches every community space in the database. As spaces grow, this query returns unbounded data.
**Impact:** The community page load time scales linearly with total space count. Each space also triggers RPC calls for member counts and membership lookups.
**Evidence:**

```ts
const { data: spaces, error } = await sb
  .from("community_spaces")
  .select("*")
  .order("created_at", { ascending: false });
```

**Recommendation:** Add `.limit(100)` and implement cursor-based pagination for the spaces list. Consider a server-side aggregate endpoint for member counts.

---

## P1 — Bundle Size & Heavy Chunks

### [P1] lowlight chunk is 480KB — largest client bundle

**File(s):** `.output/public/assets/lowlight-BJw2BDUf.js` (480KB), `src/lib/lowlight.ts`
**Issue:** Even though `lowlight.ts` only registers 4 languages, the lowlight core + highlight.js runtime produces a 480KB chunk. This is loaded whenever the Tiptap editor (note-editor or readme-editor) is opened.
**Impact:** The library note editor and project README editor both pull in this massive chunk. On first open, users wait for ~480KB of JS to parse and execute before they can type.
**Evidence:** Build output shows `lowlight-BJw2BDUf.js` at 480KB — the single largest client chunk.
**Recommendation:** Lowlight is already code-split (lazy loaded by the editors). Consider using `highlight.js/lib/core` with only the 4 languages and a minimal subset of the lowlight wrapper. Alternatively, evaluate `shiki` which has smaller WASM-based bundles, or use CSS-only syntax highlighting for read-only views.

### [P1] Main app chunk is 418KB — too large for initial load

**File(s):** `.output/public/assets/index-4ndFt-bc.js` (418KB)
**Issue:** The main `index` chunk contains the bulk of the app shell, Radix UI components, TanStack Query, and shared utilities. At 418KB it significantly exceeds the recommended 200KB initial budget.
**Impact:** High Time to Interactive (TTI) on every page. The browser must parse and execute 418KB of JS before any interactivity.
**Evidence:** Build output: `index-4ndFt-bc.js` at 418KB.
**Recommendation:** Audit the main chunk with `vite-bundle-analyzer`. The likely culprits are Radix UI (11 packages) and Supabase client. Consider: (1) lazy-loading Radix components that aren't needed on first paint, (2) using the Supabase client's tree-shakable exports, (3) splitting the QueryClient setup into a smaller initial chunk.

### [P1] client chunk is 205KB — third largest

**File(s):** `.output/public/assets/client-Du_W3t_4.js` (205KB)
**Issue:** The TanStack Start client entry is 205KB before any route code.
**Impact:** Adds to the initial parse time. This is largely framework overhead.
**Evidence:** Build output: `client-Du_W3t_4.js` at 205KB.
**Recommendation:** This is mostly framework code (TanStack Router + Start runtime). Limited optimization possible, but verify no application code is accidentally bundled into this chunk.

### [P1] WorkspaceGrid (react-grid-layout) not lazy-loaded on dashboard

**File(s):** `src/routes/_authenticated/dashboard.tsx:28`, `src/components/tethyr/workspace/workspace-grid.tsx:7`
**Issue:** `WorkspaceGrid` imports `react-grid-layout` (a heavy dependency with CSS) and is imported eagerly in the dashboard route, not lazy-loaded. The dashboard is the first page authenticated users see.
**Impact:** The entire react-grid-layout library and its CSS are loaded on dashboard mount, even though the grid is only one module among many on the dashboard.
**Evidence:**

```tsx
import { WorkspaceGrid } from "@/components/tethyr/workspace/workspace-grid";
```

**Recommendation:** Lazy-load `WorkspaceGrid` since it's below the fold and only renders when the user scrolls to the workspace section.

### [P1] framer-motion imported in 7+ components without code splitting

**File(s):** Multiple files in `src/components/tethyr/`
**Issue:** framer-motion (~384KB) is imported directly in `section-reveal.tsx`, `project-shelf.tsx` (5 sub-files), `landing/data.tsx`, and `cover-gradient.tsx`. While some are lazy-loaded via route-level splitting, the `section-reveal` component is imported eagerly in the landing page and project page.
**Impact:** The framer-motion runtime is pulled into the main bundle via `section-reveal.tsx` which is imported eagerly in `index.tsx` (landing page).
**Evidence:**

```tsx
// src/routes/index.tsx
import { SectionReveal } from "@/components/tethyr/section-reveal";
// src/components/tethyr/section-reveal.tsx
import { motion, useReducedMotion } from "framer-motion";
```

**Recommendation:** Lazy-load `SectionReveal` or extract the `useReducedMotion` check into a tiny wrapper that defers the framer-motion import. Since `SectionReveal` wraps lazy-loaded sections, it should itself be lazy.

---

## P2 — Missing Limits on Social Graph Queries

### [P2] useFollowers and useFollowing have no limit

**File(s):** `src/hooks/use-follow.ts:42-46`, `src/hooks/use-follow.ts:65-69`
**Issue:** Both `useFollowers()` and `useFollowing()` fetch all rows without a `.limit()`.
**Impact:** Popular users with thousands of followers/following generate large responses. The profile page loads all of them at once.
**Evidence:**

```ts
const { data, error } = await sb
  .from("follows")
  .select("follower_id, created_at")
  .eq("following_id", userId)
  .order("created_at", { ascending: false });
// No .limit()
```

**Recommendation:** Add `.limit(200)` and implement "load more" pagination for the followers/following lists.

### [P2] useConnections fetches ALL connections without limit

**File(s):** `src/hooks/use-connections.ts:42-47`
**Issue:** `fetchConnections()` loads every connection row for the user with no limit.
**Impact:** Users with many connections (500+) will see slow dashboard loads as the connections query blocks.
**Evidence:**

```ts
const { data, error } = await supabase
  .from("connections")
  .select(`*, requester:profiles!...`)
  .order("created_at", { ascending: false });
// No .limit()
```

**Recommendation:** Add `.limit(200)` for the dashboard view. The connections list can paginate.

### [P2] useSessions fetches ALL sessions without limit

**File(s):** `src/hooks/use-sessions.ts:144-153`
**Issue:** `fetchSessionsForUser()` returns all sessions (past and future) for the user with no limit.
**Impact:** Users with many sessions generate large responses. The sessions page load time grows linearly.
**Evidence:**

```ts
const { data, error } = await sb
  .from("sessions")
  .select(SESSION_SELECT)
  .or(sessionsForUserFilter(userId, participantSessionIds))
  .order("starts_at", { ascending: true });
// No .limit()
```

**Recommendation:** Add `.limit(100)`. Separate past/future queries so each can be independently bounded.

### [P2] Post hydration logic duplicated 4 times

**File(s):** `src/hooks/use-community.ts:210-270`, `src/hooks/use-follow.ts:132-233`, `src/hooks/use-community-spaces.ts:306-433`
**Issue:** The "hydrate posts with author profiles, action stats, my actions, and comment counts" logic is copy-pasted across `hydratePosts()`, `useFollowingFeed()`, and `useCommunitySpacePosts()`. Each copy makes 4-5 sequential Supabase queries.
**Impact:** Every code path independently fetches the same data shapes. Bugs in one copy may not be fixed in others. The N+1 query pattern (fetch posts → fetch actions → fetch comments) is repeated.
**Evidence:** All three files contain nearly identical loops over actions, stats aggregation, and comment counting.
**Recommendation:** Extract a shared `hydratePosts(postIds: string[])` utility. Consider a Supabase RPC or database view that returns pre-aggregated post stats to eliminate the client-side N+1.

---

## P3 — Minor Optimizations

### [P3] useTrendingSkills fetches ALL skills + ALL teach/learn/project_skills rows

**File(s):** `src/hooks/use-current-user.ts:298-331`
**Issue:** Fetches every row from `profile_skills_teach`, `profile_skills_learn`, and `project_skills` to compute usage counts client-side.
**Impact:** As the user base grows, these tables will have millions of rows. The query will become very slow.
**Recommendation:** Move the trending skills computation to a Supabase RPC or materialized view that returns pre-aggregated counts.

### [P3] useTodaySessions fetches ALL platform sessions for today

**File(s):** `src/hooks/use-sessions.ts:166-180`
**Issue:** `fetchTodaySessions()` filters by date but not by user. It fetches all sessions happening today across the platform. The user-scoped filter is applied in `fetchSessionsForUser` but not here.
**Impact:** Wasted data transfer. The dashboard only shows the user's own sessions.
**Recommendation:** Pass `userId` and filter by `organizer_id` or use the same participant-based filter as `fetchSessionsForUser`.

### [P3] useSpaceReportHistory fetches up to 500 reports unfiltered

**File(s):** `src/hooks/use-space-reports.ts:129-133`
**Issue:** `useSpaceReportHistory()` fetches up to 500 reports globally, then filters client-side by `spaceId`.
**Impact:** As report volume grows, this query returns increasingly irrelevant data.
**Recommendation:** Add `.eq("space_id", spaceId)` to the query instead of filtering in JS.

---

## Positives — What's Done Well

1. **Code splitting is actively used.** 22 `React.lazy()` calls split the landing page, project page, and authenticated shell into meaningful chunks. The project page alone has 12 lazy-loaded tabs/sections.

2. **Paginated community feed.** `useInfinitePosts()` uses `.range()` with `POSTS_PAGE_SIZE = 20` and cursor-based pagination. This is the correct pattern.

3. **Bounded queries are the norm.** Most queries in `use-projects.ts`, `use-challenges.ts`, `use-notifications.ts`, and `use-space-reports.ts` include `.limit()` (typically 20-100). The project page sub-queries are well-bounded.

4. **RPC for aggregation.** `useUnreadCounts()` uses a Supabase RPC (`unread_message_counts`) instead of fetching all unread rows client-side. This is the right approach.

5. **Stale time configured thoughtfully.** Most queries use `staleTime: 15_000-30_000ms`, preventing unnecessary refetches while keeping data fresh.

6. **Optimistic updates are well-implemented.** `useSendMessage`, `useSendConnection`, and `useRespondConnection` use optimistic writes with proper rollback, reducing perceived latency.

7. **Module-level singleton channels.** Realtime subscriptions in `use-notifications.ts` and `use-connections.ts` use ref-counted singleton channels, preventing duplicate subscriptions.

8. **Lowlight is tree-shaken.** `src/lib/lowlight.ts` only registers 4 languages instead of the full `common` bundle, keeping the language grammar count minimal.

9. **date-fns is imported selectively.** Only `formatDistanceToNowStrict` is imported from `date-fns`, not the entire library.

10. **SSR disabled for authenticated routes.** The `_authenticated` layout sets `ssr: false`, avoiding server-side Supabase auth complications and keeping the authenticated shell client-rendered.

11. **React.memo used strategically.** 15 components use `React.memo` on dashboard and community surfaces where re-render frequency is high.

12. **Images in public/ are minimal.** Only `favicon.ico` (20KB) and `og-image.png` (16KB) — no large unoptimized images.
