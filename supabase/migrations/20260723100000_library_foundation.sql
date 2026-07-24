-- Library Foundation: collections, items, tags, file storage

-- ─────────────────────────────────────────────
-- COLLECTIONS
-- ─────────────────────────────────────────────
CREATE TABLE library_collections (
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

ALTER TABLE library_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner CRUD collections"
  ON library_collections FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_library_collections_user ON library_collections(user_id, position);
CREATE INDEX idx_library_collections_parent ON library_collections(parent_id);

-- ─────────────────────────────────────────────
-- ITEMS (notes, documents, links, uploads)
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE library_item_type AS ENUM ('note', 'document', 'link', 'upload');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE library_items (
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

ALTER TABLE library_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner CRUD items"
  ON library_items FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_library_items_user ON library_items(user_id, created_at DESC);
CREATE INDEX idx_library_items_collection ON library_items(collection_id);
CREATE INDEX idx_library_items_type ON library_items(user_id, type);
CREATE INDEX idx_library_items_favorites ON library_items(user_id) WHERE is_favorite = true;
CREATE INDEX idx_library_items_pinned ON library_items(user_id) WHERE is_pinned = true;

-- Full-text search
CREATE INDEX idx_library_items_search ON library_items
  USING gin(to_tsvector('english', title || ' ' || content));

-- ─────────────────────────────────────────────
-- TAGS
-- ─────────────────────────────────────────────
CREATE TABLE library_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT 'oklch(0.65 0.15 260)',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE library_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner CRUD tags"
  ON library_tags FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_library_tags_user ON library_tags(user_id);

-- ─────────────────────────────────────────────
-- ITEM <-> TAG JUNCTION
-- ─────────────────────────────────────────────
CREATE TABLE library_item_tags (
  item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES library_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

ALTER TABLE library_item_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner CRUD item tags"
  ON library_item_tags FOR ALL
  USING (
    EXISTS (SELECT 1 FROM library_items WHERE id = item_id AND user_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- VERSION HISTORY
-- ─────────────────────────────────────────────
CREATE TABLE library_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  editor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE library_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner read versions"
  ON library_versions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM library_items WHERE id = item_id AND user_id = auth.uid())
  );

CREATE POLICY "System insert versions"
  ON library_versions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM library_items WHERE id = item_id AND user_id = auth.uid())
  );

CREATE INDEX idx_library_versions_item ON library_versions(item_id, created_at DESC);

-- ─────────────────────────────────────────────
-- STORAGE BUCKET
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('library-files', 'library-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Owner read library files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'library-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owner insert library files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'library-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owner delete library files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'library-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ─────────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER library_collections_updated_at
  BEFORE UPDATE ON library_collections
  FOR EACH ROW EXECUTE FUNCTION update_library_updated_at();

CREATE TRIGGER library_items_updated_at
  BEFORE UPDATE ON library_items
  FOR EACH ROW EXECUTE FUNCTION update_library_updated_at();
