# Known Issues

> Updated 2026-08-06. The Phase 1 stabilization and Phase 2 coherence passes are complete; entries below are historical resolutions or remaining operational risks.

## 1. Infinite recursion in RLS policies for `sessions` (RESOLVED)

**Error:** `infinite recursion detected in policy for relation "sessions"`

**Resolution:** Fixed in `20260725130000_fix_session_rls_recursion_final.sql` by converting both organizer and participant checks into `SECURITY DEFINER` functions (`is_session_organizer` and `is_session_participant`). Because SECURITY DEFINER functions bypass RLS when evaluating conditions on target tables, neither policy evaluation triggers cyclic table checks.

---

## 2. Availability settings cascade issue

**Status:** Resolved along with sessions RLS fix. Availability settings query sessions and participants, so resolving recursion restored availability controls.

---

## 3. Migration history out of sync with remote DB

**Status:** Documented. When applying migrations via Supabase SQL Editor or `supabase db push`, ensure new migrations are applied sequentially without re-running older applied migrations.

---

## 4. `invalid input value for enum post_type: "post"` (RESOLVED)

**Error:** `invalid input value for enum post_type: "post"` when posting in community.

**Root cause (two layers):**

1. **Local DB missing enum values.** Migration `20260726000000_add_missing_post_types.sql` added `lesson_learned`, `feedback_request`, and `open_role` to the `post_type` enum, but was only applied to the remote DB via `supabase db push`. The local dev database (`localhost:54321`) never received it. The frontend `QUICK_ACTIONS` offered all 13 types, but the local DB only accepted 10.

2. **Stale localStorage draft.** The `tethyr-community-draft` key in localStorage saved `type: "post"` from an old code version. On page load, the composer's `useEffect` loaded this into state. Even after the frontend validation was added, the stale value persisted until the user manually cleared it.

**Why the error said `"post"` specifically:** The literal string `"post"` was never in the current frontend code. It was saved in localStorage from an earlier version of the app when `"post"` was likely a valid type or default. No frontend source file contains the string `"post"` as a post type.

**Resolution (commits `4e08fa3`, `dce9ca5`, `58b203f`, `c28b5b4`):**

1. Applied the missing enum values to the local DB:
   ```sql
   ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'lesson_learned';
   ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'feedback_request';
   ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'open_role';
   ```
2. Added `VALID_POST_TYPES` Set validation in `useCreatePost` and `useUpdatePost` mutations (defense-in-depth).
3. Added localStorage draft sanitization in `composer-bar.tsx` — rejects and clears drafts with invalid types on page load.
4. Added pre-submit type validation as a final safeguard before the mutation call.
5. Fixed `trg_reputation_community_post` trigger — it had `IF NEW.type = 'post'` (dead code, never matched). Applied fix in `20260728100000_fix_reputation_trigger.sql` — now logs reputation for ALL post types.
6. Regenerated Supabase types to include community tables and all 13 `post_type` values.

**Important gotcha for future development:** `supabase db push` only applies to the **remote** database. After adding new migrations, always also apply them locally:

```bash
npx supabase db reset          # resets local DB from migrations
# OR manually:
npx supabase db query "ALTER TYPE ... ADD VALUE IF NOT EXISTS ..."
```

**User-side fix:** Clear stale localStorage drafts if the error persists after the DB fix:

```js
localStorage.removeItem("tethyr-community-draft");
```

---

## 5. Infinite recursion in RLS policies for `community_space_members` (RESOLVED)

**Error:** `infinite recursion detected in policy for relation "community_space_members"` → HTTP 500 on the Community page.

**Root cause:** The `Members can see member list`, `Owners and moderators can manage members`, and `Owners and moderators can remove members` policies used self-referential `EXISTS (SELECT 1 FROM community_space_members ...)` subqueries. Evaluating them re-triggered RLS on the same table.

**Resolution:** Fixed in `20260801000000_fix_community_spaces_rls_recursion.sql`, mirroring the sessions fix (#1). Membership checks now go through `SECURITY DEFINER` functions `is_space_member(space_id, user_id)` and `is_space_owner_or_moderator(space_id, user_id)`.

---

## 6. Sessions queries: PostgREST `or()` with embedded resources (RESOLVED)

**Error:** `failed to parse logic tree (PGRST100)` → 5× HTTP 400 on the Sessions page.

**Root cause:** `src/hooks/use-sessions.ts` used `.or("organizer_id.eq.X,session_participants.profile_id.eq.X")`. PostgREST cannot reference embedded resources inside an `or()` filter.

**Resolution:** Resolve the user's participating session ids first (`fetchParticipatingSessionIds`), then filter on top-level columns only: `or("organizer_id.eq.X,id.in.(...)" )`. Applied to `fetchSessionsForUser`, `fetchSessionStats`, and `fetchSessionHistory`.

---

## 7. Storage paths rendered as raw `<img src>` (RESOLVED)

**Error:** Cover/avatar images 404 against the app origin. Components used storage paths (e.g. `{userId}/{uuid}.png`) directly as `src`.

**Resolution:** Added `useSignedStorageUrl(bucket, path)` hook (`src/hooks/use-signed-url.ts`) that calls `createSignedUrl(..., 60*60*24)`, and applied it in `project-card-inline.tsx` (`project-media`), `space-header.tsx` and `community-card.tsx` (`avatars`), and `schedule-session-wizard.tsx` (per-participant `ParticipantAvatar`).

---

## 8. Misc fixes (RESOLVED)

- **Dashboard 400 (`22P02`)**: `suggested-projects.tsx` filtered on `stage eq "archived"`, which isn't in the `project_stage` enum. Now filters `stage in (planning, building, testing, launch, growing)`.
- **Library nested `<button>`**: The Collections/Tags toggles in `library-sidebar.tsx` contained a nested "+" `<button>` → hydration error. The "+" is now a sibling button.
- **Messages title**: `messages.tsx` said "Meeting Table — Tethyr"; now "Messages — Tethyr".
- **Missing page titles**: `/projects/$id`, `/u/$handle`, `/library`, `/challenges/$id` now set heads instead of falling back to the root title.
- **Blank skill pages**: `/skills/<unknown-slug>` rendered an empty page. The route now shows a "Skill not found" state (previously `throw notFound()` inside the react-query `queryFn` was swallowed, and `if (!skill) return null` produced a blank page).
- **Dashboard dead link**: The "Browse studios" QuickLink pointed to `/skills/video-editing` (non-existent). Now links to `/explore` as "Explore skills & studios".
- **Project gallery/resources edits silently lost (RESOLVED)**: Since the original tabbed layout, the project page's `GallerySection` and `ResourcesSection` were wired to `onUpdate={() => {}}` — owners could click Add/Remove and see a success toast, but the changes never persisted. Added `useUpdateProjectContent` in `use-projects.ts` (writes `gallery`/`resources` columns + invalidates the project query) and wired it through `ProjectMainContent`. Sections now await the save and only toast success after the write completes; `saveContent` rethrows on failure so a failed save shows an error toast instead of a fake success. (`2026-07-30-project-detail-page.md` plan marked complete.)
