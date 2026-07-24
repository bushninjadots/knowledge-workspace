-- Diagnostic: create anything that's missing from the library schema.
-- Safe to run multiple times — uses IF NOT EXISTS / ON CONFLICT everywhere.

-- ── 1. ENUM TYPE ──
DO $$ BEGIN
  CREATE TYPE library_item_type AS ENUM ('note', 'document', 'link', 'upload');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── 2. TABLES ──
CREATE TABLE IF NOT EXISTS library_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT 'oklch(0.65 0.15 260)',
  parent_id UUID REFERENCES library_collections(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL DEFAULT '',
  type library_item_type NOT NULL DEFAULT 'note',
  collection_id UUID REFERENCES library_collections(id) ON DELETE SET NULL,
  url TEXT,
  file_url TEXT,
  file_type TEXT,
  file_size BIGINT,
  thumbnail_url TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  reading_progress INTEGER NOT NULL DEFAULT 0 CHECK (reading_progress BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS library_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT 'oklch(0.65 0.15 260)',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS library_item_tags (
  item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES library_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE IF NOT EXISTS library_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  editor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. ENABLE RLS ──
ALTER TABLE library_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_item_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_versions ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS POLICIES (drop + recreate to guarantee they exist) ──

-- Collections
DROP POLICY IF EXISTS "Owner CRUD collections" ON library_collections;
CREATE POLICY "Owner CRUD collections"
  ON library_collections FOR ALL
  USING (auth.uid() = user_id);

-- Items
DROP POLICY IF EXISTS "Owner CRUD items" ON library_items;
CREATE POLICY "Owner CRUD items"
  ON library_items FOR ALL
  USING (auth.uid() = user_id);

-- Tags
DROP POLICY IF EXISTS "Owner CRUD tags" ON library_tags;
CREATE POLICY "Owner CRUD tags"
  ON library_tags FOR ALL
  USING (auth.uid() = user_id);

-- Item tags
DROP POLICY IF EXISTS "Owner CRUD item tags" ON library_item_tags;
CREATE POLICY "Owner CRUD item tags"
  ON library_item_tags FOR ALL
  USING (
    EXISTS (SELECT 1 FROM library_items WHERE id = item_id AND user_id = auth.uid())
  );

-- Versions
DROP POLICY IF EXISTS "Owner read versions" ON library_versions;
CREATE POLICY "Owner read versions"
  ON library_versions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM library_items WHERE id = item_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "System insert versions" ON library_versions;
CREATE POLICY "System insert versions"
  ON library_versions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM library_items WHERE id = item_id AND user_id = auth.uid())
  );

-- ── 5. INDEXES (IF NOT EXISTS) ──
CREATE INDEX IF NOT EXISTS idx_library_collections_user ON library_collections(user_id, position);
CREATE INDEX IF NOT EXISTS idx_library_collections_parent ON library_collections(parent_id);
CREATE INDEX IF NOT EXISTS idx_library_items_user ON library_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_items_collection ON library_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_library_items_type ON library_items(user_id, type);
CREATE INDEX IF NOT EXISTS idx_library_items_favorites ON library_items(user_id) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_library_items_pinned ON library_items(user_id) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_library_tags_user ON library_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_library_versions_item ON library_versions(item_id, created_at DESC);

-- ── 6. FULL-TEXT SEARCH INDEX ──
DROP INDEX IF EXISTS idx_library_items_search;
CREATE INDEX idx_library_items_search ON library_items
  USING gin(to_tsvector('english', title || ' ' || content));

-- ── 7. STORAGE BUCKET ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('library-files', 'library-files', false)
ON CONFLICT (id) DO NOTHING;

-- ── 8. STORAGE POLICIES (drop + recreate) ──
DROP POLICY IF EXISTS "Owner read library files" ON storage.objects;
CREATE POLICY "Owner read library files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'library-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Owner insert library files" ON storage.objects;
CREATE POLICY "Owner insert library files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'library-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Owner delete library files" ON storage.objects;
CREATE POLICY "Owner delete library files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'library-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Owner update library files" ON storage.objects;
CREATE POLICY "Owner update library files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'library-files' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'library-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ── 9. UPDATED_AT TRIGGERS ──
CREATE OR REPLACE FUNCTION update_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS library_collections_updated_at ON library_collections;
CREATE TRIGGER library_collections_updated_at
  BEFORE UPDATE ON library_collections
  FOR EACH ROW EXECUTE FUNCTION update_library_updated_at();

DROP TRIGGER IF EXISTS library_items_updated_at ON library_items;
CREATE TRIGGER library_items_updated_at
  BEFORE UPDATE ON library_items
  FOR EACH ROW EXECUTE FUNCTION update_library_updated_at();
