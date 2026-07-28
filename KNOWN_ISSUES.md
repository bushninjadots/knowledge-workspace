# Known Issues

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
