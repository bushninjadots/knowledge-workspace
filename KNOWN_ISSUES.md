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
