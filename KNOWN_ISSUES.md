# Known Issues

## 1. Infinite recursion in RLS policies for `sessions` (CRITICAL)

**Error:** `infinite recursion detected in policy for relation "sessions"`

**When:** Creating a session via the Schedule Wizard, and potentially any query that touches `sessions` + `session_participants` together.

**Attempted fix:** Created `is_session_organizer(uuid)` SECURITY DEFINER function + rewrote all cross-table policies in migration `20260725000000_fix_session_rls_recursion.sql`. Function exists, is SECURITY DEFINER, migration applied. But the error persists.

**Likely cause:** PostgREST/Supabase may still be caching old policy definitions, or the `session_participants` FOR ALL policy triggers session-level policy evaluation in a way the SECURITY DEFINER function doesn't fully prevent. Could also be that Supabase's PostgREST handles RLS evaluation differently than raw PostgreSQL.

**Next steps to investigate:**
- Test with raw SQL via `psql` or SQL Editor (bypass PostgREST) to isolate whether it's a PostgreSQL or PostgREST issue
- Try `NOTIFY pgrst, 'reload schema';` again after a fresh page load
- Check Supabase dashboard → Logs for the exact SQL statement causing the recursion
- Consider restructuring: remove the FOR ALL policy on `session_participants` and replace with separate SELECT/INSERT/UPDATE/DELETE policies that don't cross-reference `sessions` at all, or use a trigger-based approach instead of RLS for the organizer check
- Alternative: temporarily disable RLS on `session_participants` as a workaround while debugging

**Tables affected by cross-referencing policies:**
- `sessions` ↔ `session_participants` (bidirectional)
- `session_resources` → `sessions` + `session_participants`
- `session_notes` → `sessions` + `session_participants`

## 2. Availability settings may also be affected

**When:** User reported "can't set availability" alongside the sessions error.

**Likely cause:** The availability error is probably a cascade — if the sessions query fails during page load, the availability component may never render or its queries may fail indirectly. The `session_availability` policies themselves (`auth.uid() = profile_id`) are simple and shouldn't recurse. Verify once the sessions recursion is fixed.

## 3. Migration history out of sync with remote DB

**When:** Running `supabase db push` attempts to re-apply old migrations that already exist on the remote.

**Workaround applied:** Marked all pre-existing migrations as applied in `supabase_migrations.schema_migrations`. This is a one-time fix; if the migrations folder is rebuilt or the linked project changes, this may recur.

**Better long-term fix:** Ensure `supabase/migration` directory is the single source of truth and never manually apply SQL outside of migrations.
