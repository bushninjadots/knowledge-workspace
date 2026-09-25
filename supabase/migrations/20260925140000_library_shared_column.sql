-- Library item sharing: an owner can mark an item `shared`, making it
-- world-readable (anon + authenticated) while every other capability —
-- update, delete, tag, version — stays owner-only. No new function, no
-- SECURITY DEFINER: this is a plain per-row SELECT policy on top of the
-- existing owner policies (see 20260724000000_library_fix_all.sql).

ALTER TABLE library_items ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT false;

-- World-readable shared items. Permissive SELECT policy: anon + authenticated.
-- Revoking a share hides the row immediately (USING is evaluated per query).
DROP POLICY IF EXISTS "Public read shared items" ON library_items;
CREATE POLICY "Public read shared items"
  ON library_items FOR SELECT
  USING (shared = true);

-- Only reads scale with the public URL; writes stay owner-scoped and rare.
CREATE INDEX IF NOT EXISTS idx_library_items_shared
  ON library_items(shared) WHERE shared = true;
