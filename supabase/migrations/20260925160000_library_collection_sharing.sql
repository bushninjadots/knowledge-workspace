-- Collection sharing: a whole library_collection can be marked shared, making
-- the collection row AND its items world-readable while sharing is on. Two
-- policies per table (item-level `shared` from 20260925140000 still works
-- independently — an item can be shared without its collection being).
--
-- Revocation is immediate: RLS USING is evaluated per query, so unsetting
-- `shared` on the collection hides every collection-scoped row at once.

ALTER TABLE library_collections ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT false;

-- Collection rows readable while shared.
DROP POLICY IF EXISTS "Public read shared collections" ON library_collections;
CREATE POLICY "Public read shared collections"
  ON library_collections FOR SELECT
  USING (shared = true);

-- Items inside a shared collection are readable too (OR item-level shared —
-- permissive policies compose, so the existing one stays as-is).
DROP POLICY IF EXISTS "Public read items in shared collections" ON library_items;
CREATE POLICY "Public read items in shared collections"
  ON library_items FOR SELECT
  USING (
    shared = true
    OR EXISTS (
      SELECT 1 FROM library_collections c
      WHERE c.id = library_items.collection_id AND c.shared = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_library_collections_shared
  ON library_collections(shared) WHERE shared = true;
