DO $$ BEGIN
  CREATE TYPE public.skill_experience_level AS ENUM ('beginner','intermediate','advanced','expert');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.profile_skills_teach
  ADD COLUMN IF NOT EXISTS experience_level public.skill_experience_level NOT NULL DEFAULT 'intermediate';

DO $$ BEGIN
  CREATE POLICY "Authenticated can read skill proof files"
    ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'skill-proofs');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE POLICY "Owner can upload skill proof files"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'skill-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE POLICY "Owner can replace skill proof files"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'skill-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE POLICY "Owner can delete skill proof files"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'skill-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.library_item_type AS ENUM ('note','document','link','upload');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.library_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT 'oklch(0.65 0.15 260)',
  parent_id UUID REFERENCES public.library_collections(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_collections TO authenticated;
GRANT ALL ON public.library_collections TO service_role;

CREATE TABLE IF NOT EXISTS public.library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL DEFAULT '',
  type public.library_item_type NOT NULL DEFAULT 'note',
  collection_id UUID REFERENCES public.library_collections(id) ON DELETE SET NULL,
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_items TO authenticated;
GRANT ALL ON public.library_items TO service_role;

CREATE TABLE IF NOT EXISTS public.library_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT 'oklch(0.65 0.15 260)',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_tags TO authenticated;
GRANT ALL ON public.library_tags TO service_role;

CREATE TABLE IF NOT EXISTS public.library_item_tags (
  item_id UUID NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.library_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_item_tags TO authenticated;
GRANT ALL ON public.library_item_tags TO service_role;

CREATE TABLE IF NOT EXISTS public.library_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  editor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.library_versions TO authenticated;
GRANT ALL ON public.library_versions TO service_role;

CREATE INDEX IF NOT EXISTS idx_library_collections_user ON public.library_collections(user_id, position);
CREATE INDEX IF NOT EXISTS idx_library_collections_parent ON public.library_collections(parent_id);
CREATE INDEX IF NOT EXISTS idx_library_items_user ON public.library_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_items_collection ON public.library_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_library_items_type ON public.library_items(user_id, type);
CREATE INDEX IF NOT EXISTS idx_library_items_favorites ON public.library_items(user_id) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_library_items_pinned ON public.library_items(user_id) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_library_items_search ON public.library_items USING gin(to_tsvector('english', title || ' ' || content));
CREATE INDEX IF NOT EXISTS idx_library_tags_user ON public.library_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_library_versions_item ON public.library_versions(item_id, created_at DESC);

ALTER TABLE public.library_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_item_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_versions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "Owner CRUD collections" ON public.library_collections FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner CRUD items" ON public.library_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner CRUD tags" ON public.library_tags FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner CRUD item tags" ON public.library_item_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.library_items i WHERE i.id = library_item_tags.item_id AND i.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.library_items i WHERE i.id = library_item_tags.item_id AND i.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner read versions" ON public.library_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.library_items i WHERE i.id = library_versions.item_id AND i.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner insert versions" ON public.library_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.library_items i WHERE i.id = library_versions.item_id AND i.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE POLICY "Owner read library files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'library-files' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner insert library files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'library-files' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner delete library files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'library-files' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE OR REPLACE FUNCTION public.update_library_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE EXECUTE ON FUNCTION public.update_library_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS library_collections_updated_at ON public.library_collections;
CREATE TRIGGER library_collections_updated_at BEFORE UPDATE ON public.library_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_library_updated_at();
DROP TRIGGER IF EXISTS library_items_updated_at ON public.library_items;
CREATE TRIGGER library_items_updated_at BEFORE UPDATE ON public.library_items
  FOR EACH ROW EXECUTE FUNCTION public.update_library_updated_at();

NOTIFY pgrst, 'reload schema';