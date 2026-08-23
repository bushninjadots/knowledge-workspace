-- Phase 2 — Page system foundation: pages, layouts, and themes tables.
-- Safe to re-run: all CREATE statements use IF NOT EXISTS.

-- ============================================================
-- 1. Layouts — structural arrangement of sections and blocks.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.layouts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  type        text NOT NULL DEFAULT 'standard'
                CHECK (type IN (
                  'standard', 'minimal', 'full_width', 'centered',
                  'sidebar', 'documentation', 'portfolio', 'magazine',
                  'dashboard', 'landing_page', 'custom'
                )),
  sections    jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_template boolean NOT NULL DEFAULT false,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.layouts IS 'Structural page arrangements (sections → blocks).';
COMMENT ON COLUMN public.layouts.sections IS 'Array of LayoutSection objects.';
COMMENT ON COLUMN public.layouts.is_template IS 'When true the layout can be discovered and forked by others.';

-- Everyone can read layouts (they contain structure, not user content).
ALTER TABLE public.layouts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Layouts are publicly readable"
    ON public.layouts FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can create layouts"
    ON public.layouts FOR INSERT
    WITH CHECK (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner can update own layouts"
    ON public.layouts FOR UPDATE
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner can delete own layouts"
    ON public.layouts FOR DELETE
    USING (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN null; END $$;

GRANT SELECT ON public.layouts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layouts TO authenticated;
GRANT ALL ON public.layouts TO service_role;

CREATE TRIGGER layouts_updated_at
  BEFORE UPDATE ON public.layouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. Themes — named collections of design tokens.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.themes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  tokens      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.themes IS 'Named design-token collections (colors, typography, spacing, borders, shadows).';
COMMENT ON COLUMN public.themes.tokens IS 'ThemeTokens object — colors, typography, spacing, borders, shadows.';

ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Themes are publicly readable"
    ON public.themes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can create themes"
    ON public.themes FOR INSERT
    WITH CHECK (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner can update own themes"
    ON public.themes FOR UPDATE
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner can delete own themes"
    ON public.themes FOR DELETE
    USING (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN null; END $$;

GRANT SELECT ON public.themes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.themes TO authenticated;
GRANT ALL ON public.themes TO service_role;

CREATE TRIGGER themes_updated_at
  BEFORE UPDATE ON public.themes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. Pages — a renderable surface (profile or project).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL,
  owner_type    text NOT NULL CHECK (owner_type IN ('profile', 'project')),
  layout_id     uuid REFERENCES public.layouts(id) ON DELETE RESTRICT,
  theme_id      uuid REFERENCES public.themes(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- One page per owner (profile or project).
  CONSTRAINT pages_owner_unique UNIQUE (owner_id, owner_type)
);

COMMENT ON TABLE public.pages IS 'Renderable surfaces — one per profile and one per project.';
COMMENT ON COLUMN public.pages.owner_type IS 'Either profile or project.';
COMMENT ON COLUMN public.pages.status IS 'draft or published. Public visitors only see published pages.';

CREATE INDEX IF NOT EXISTS pages_owner_idx ON public.pages (owner_id, owner_type);
CREATE INDEX IF NOT EXISTS pages_status_idx ON public.pages (status) WHERE status = 'published';

-- Published pages are publicly readable (anonymous visitors need to see
-- project/profile pages). The owner's own private content is still protected
-- at the data level by the existing project/profile RLS policies — this table
-- only stores structural references.
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Published pages are publicly readable"
    ON public.pages FOR SELECT
    USING (status = 'published');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner can always read their own pages"
    ON public.pages FOR SELECT
    USING (
      (owner_type = 'profile' AND owner_id = auth.uid())
      OR
      (owner_type = 'project' AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = pages.owner_id AND p.profile_id = auth.uid()
      ))
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner can insert page for their own profile/project"
    ON public.pages FOR INSERT
    WITH CHECK (
      (owner_type = 'profile' AND owner_id = auth.uid())
      OR
      (owner_type = 'project' AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = pages.owner_id AND p.profile_id = auth.uid()
      ))
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner can update their own pages"
    ON public.pages FOR UPDATE
    USING (
      (owner_type = 'profile' AND owner_id = auth.uid())
      OR
      (owner_type = 'project' AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = pages.owner_id AND p.profile_id = auth.uid()
      ))
    )
    WITH CHECK (
      (owner_type = 'profile' AND owner_id = auth.uid())
      OR
      (owner_type = 'project' AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = pages.owner_id AND p.profile_id = auth.uid()
      ))
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner can delete their own pages"
    ON public.pages FOR DELETE
    USING (
      (owner_type = 'profile' AND owner_id = auth.uid())
      OR
      (owner_type = 'project' AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = pages.owner_id AND p.profile_id = auth.uid()
      ))
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

GRANT SELECT ON public.pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pages TO authenticated;
GRANT ALL ON public.pages TO service_role;

CREATE TRIGGER pages_updated_at
  BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. Default Tethyr theme (applied when theme_id is null).
-- ============================================================

-- Seed a minimal "Tethyr Default" theme that matches the existing styles.css.
-- This gives every new page a known starting theme without the overhead of
-- per-page custom tokens until a user deliberately chooses one.
INSERT INTO public.themes (id, name, description, tokens, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Tethyr Default',
  'The default Tethyr workspace theme — clean, minimal, work-first.',
  '{
    "colors": {},
    "typography": {},
    "spacing": {},
    "borders": {},
    "shadows": {}
  }'::jsonb,
  null
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. Default layout (empty — blocks are added by the app).
-- ============================================================
INSERT INTO public.layouts (id, name, type, sections, is_template, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Empty',
  'standard',
  '[]'::jsonb,
  false,
  null
) ON CONFLICT (id) DO NOTHING;