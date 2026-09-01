-- ============ THEMES ============
CREATE TABLE IF NOT EXISTS public.themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.themes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.themes TO authenticated;
GRANT ALL ON public.themes TO service_role;
DO $$ BEGIN CREATE POLICY "Themes are publicly readable" ON public.themes FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can create themes" ON public.themes FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner can update own themes" ON public.themes FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner can delete own themes" ON public.themes FOR DELETE TO authenticated USING (auth.uid() = created_by); EXCEPTION WHEN duplicate_object THEN null; END $$;
DROP TRIGGER IF EXISTS themes_updated_at ON public.themes;
CREATE TRIGGER themes_updated_at BEFORE UPDATE ON public.themes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ LAYOUTS ============
CREATE TABLE IF NOT EXISTS public.layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'standard',
  category text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_template boolean NOT NULL DEFAULT false,
  theme_id uuid REFERENCES public.themes(id) ON DELETE SET NULL,
  usage_count integer NOT NULL DEFAULT 0,
  fork_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS layouts_template_usage_idx ON public.layouts (usage_count DESC) WHERE is_template = true;
ALTER TABLE public.layouts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.layouts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layouts TO authenticated;
GRANT ALL ON public.layouts TO service_role;
DO $$ BEGIN CREATE POLICY "Layouts are publicly readable" ON public.layouts FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can create layouts" ON public.layouts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner can update own layouts" ON public.layouts FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner can delete own layouts" ON public.layouts FOR DELETE TO authenticated USING (auth.uid() = created_by); EXCEPTION WHEN duplicate_object THEN null; END $$;
DROP TRIGGER IF EXISTS layouts_updated_at ON public.layouts;
CREATE TRIGGER layouts_updated_at BEFORE UPDATE ON public.layouts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PAGES ============
CREATE TABLE IF NOT EXISTS public.pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  owner_type text NOT NULL CHECK (owner_type IN ('profile','project')),
  layout_id uuid REFERENCES public.layouts(id) ON DELETE RESTRICT,
  theme_id uuid REFERENCES public.themes(id) ON DELETE SET NULL,
  theme_overrides jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pages_owner_unique UNIQUE (owner_id, owner_type)
);
CREATE INDEX IF NOT EXISTS pages_owner_idx ON public.pages (owner_id, owner_type);
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pages TO authenticated;
GRANT ALL ON public.pages TO service_role;
DO $$ BEGIN CREATE POLICY "Published pages are publicly readable" ON public.pages FOR SELECT USING (status = 'published'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner can always read their own pages" ON public.pages FOR SELECT TO authenticated USING ((owner_type='profile' AND owner_id = auth.uid()) OR (owner_type='project' AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = pages.owner_id AND p.profile_id = auth.uid()))); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner can insert their own pages" ON public.pages FOR INSERT TO authenticated WITH CHECK ((owner_type='profile' AND owner_id = auth.uid()) OR (owner_type='project' AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = pages.owner_id AND p.profile_id = auth.uid()))); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner can update their own pages" ON public.pages FOR UPDATE TO authenticated USING ((owner_type='profile' AND owner_id = auth.uid()) OR (owner_type='project' AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = pages.owner_id AND p.profile_id = auth.uid()))) WITH CHECK ((owner_type='profile' AND owner_id = auth.uid()) OR (owner_type='project' AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = pages.owner_id AND p.profile_id = auth.uid()))); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner can delete their own pages" ON public.pages FOR DELETE TO authenticated USING ((owner_type='profile' AND owner_id = auth.uid()) OR (owner_type='project' AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = pages.owner_id AND p.profile_id = auth.uid()))); EXCEPTION WHEN duplicate_object THEN null; END $$;
DROP TRIGGER IF EXISTS pages_updated_at ON public.pages;
CREATE TRIGGER pages_updated_at BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ FORKS ============
CREATE TABLE IF NOT EXISTS public.forks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_layout_id uuid NOT NULL REFERENCES public.layouts(id) ON DELETE RESTRICT,
  child_layout_id uuid NOT NULL REFERENCES public.layouts(id) ON DELETE RESTRICT,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  forked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forks_child_unique UNIQUE (child_layout_id)
);
CREATE INDEX IF NOT EXISTS forks_parent_idx ON public.forks (parent_layout_id);
ALTER TABLE public.forks ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.forks TO anon;
GRANT SELECT, INSERT ON public.forks TO authenticated;
GRANT ALL ON public.forks TO service_role;
DO $$ BEGIN CREATE POLICY "Forks are publicly readable" ON public.forks FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Creator can record own fork" ON public.forks FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============ RPCs ============
CREATE OR REPLACE FUNCTION public.increment_usage_count(template_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.layouts SET usage_count = usage_count + 1 WHERE id = template_id AND is_template = true;
$$;
REVOKE ALL ON FUNCTION public.increment_usage_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_usage_count(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.increment_fork_count(layout_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.layouts SET fork_count = fork_count + 1 WHERE id = layout_id;
$$;
REVOKE ALL ON FUNCTION public.increment_fork_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_fork_count(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unread_message_counts()
RETURNS TABLE (connection_id uuid, unread_count bigint)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT m.connection_id, count(*)::bigint
  FROM public.messages m
  WHERE m.read_at IS NULL AND m.sender_id <> auth.uid()
  GROUP BY m.connection_id;
$$;
REVOKE ALL ON FUNCTION public.unread_message_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unread_message_counts() TO authenticated;

-- ============ BUILT-IN THEME PRESETS ============
INSERT INTO public.themes (id, name, description, tokens, created_by) VALUES
  ('00000000-0000-0000-0000-000000000001','Tethyr Default','The default Tethyr workspace theme — clean, minimal, work-first.','{"colors":{},"typography":{},"spacing":{},"borders":{},"shadows":{}}'::jsonb,null),
  ('00000000-0000-0000-0000-000000000010','Minimal','Clean, neutral workspace. High contrast text on a bright surface.','{"colors":{"background":"#ffffff","foreground":"#111111","surface":"#f5f5f5","surface-elevated":"#ffffff","muted":"#e5e5e5","border":"#e0e0e0","card":"#fafafa"},"borders":{"radius":{"sm":"2px","md":"4px","lg":"6px","xl":"8px"}}}'::jsonb,null),
  ('00000000-0000-0000-0000-000000000011','Developer','Dark, code-friendly theme with muted accents.','{"colors":{"background":"#0d1117","foreground":"#e6edf3","surface":"#161b22","surface-elevated":"#1c2128","muted":"#30363d","border":"#30363d","card":"#161b22"},"borders":{"radius":{"sm":"3px","md":"6px","lg":"8px","xl":"12px"}}}'::jsonb,null),
  ('00000000-0000-0000-0000-000000000012','Terminal','Black canvas with green terminal accents.','{"colors":{"background":"#000000","foreground":"#c9d1d9","surface":"#0a0f0a","surface-elevated":"#101a10","muted":"#1f2a1f","border":"#1f3a1f","card":"#0a0f0a","primary":"#7cff6e"},"borders":{"radius":{"sm":"2px","md":"3px","lg":"4px","xl":"6px"}}}'::jsonb,null),
  ('00000000-0000-0000-0000-000000000013','Midnight','Deep navy documentation surface.','{"colors":{"background":"#0b1220","foreground":"#e2e8f0","surface":"#111a2b","surface-elevated":"#16223a","muted":"#25324a","border":"#25324a","card":"#111a2b"},"borders":{"radius":{"sm":"4px","md":"8px","lg":"12px","xl":"16px"}}}'::jsonb,null),
  ('00000000-0000-0000-0000-000000000017','Neon','Neon-edged creative surface with vivid accents.','{"colors":{"background":"#0a0713","foreground":"#f3ecff","surface":"#150e26","surface-elevated":"#1d1333","muted":"#2c1f4a","border":"#3a2766","card":"#150e26","primary":"#a64dff"},"borders":{"radius":{"sm":"4px","md":"10px","lg":"14px","xl":"20px"}}}'::jsonb,null),
  ('00000000-0000-0000-0000-000000000020','Studio Light','Soft warm light theme for portfolio pages.','{"colors":{"background":"#faf9f7","foreground":"#1a1a19","surface":"#f2f0ec","surface-elevated":"#ffffff","muted":"#e6e3dd","border":"#ddd9d1","card":"#ffffff"},"borders":{"radius":{"sm":"6px","md":"10px","lg":"14px","xl":"18px"}}}'::jsonb,null)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.layouts (id, name, type, sections, is_template, created_by)
VALUES ('00000000-0000-0000-0000-000000000002','Empty','standard','[]'::jsonb,false,null)
ON CONFLICT (id) DO NOTHING;

-- Reseed helper used by the studio sidebar. Restores starter templates.
CREATE OR REPLACE FUNCTION public.reseed_default_templates()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cnt integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.layouts WHERE name = 'Minimal Profile' AND is_template = true) THEN
    INSERT INTO public.layouts (name, description, type, category, sections, theme_id, is_template, created_by)
    VALUES ('Minimal Profile','Clean identity page. Hero, about, skills, projects.','standard','Minimal',
      '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-hero","position":0,"config":{},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"profile-about","position":0,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"two_column","blocks":[{"id":"b3","type":"profile-skills","position":0,"config":{},"visible":true},{"id":"b4","type":"profile-projects","position":1,"config":{},"visible":true}]}]'::jsonb,
      '00000000-0000-0000-0000-000000000010', true, null);
    cnt := cnt + 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.layouts WHERE name = 'Minimal Developer' AND is_template = true) THEN
    INSERT INTO public.layouts (name, description, type, category, sections, theme_id, is_template, created_by)
    VALUES ('Minimal Developer','Clean project layout. Hero, about, status, team.','standard','Developer',
      '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":true,"showTags":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"divider","position":0,"config":{},"visible":true},{"id":"b3","type":"project-about","position":1,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"two_column","blocks":[{"id":"b4","type":"project-status","position":0,"config":{},"visible":true},{"id":"b5","type":"project-team","position":1,"config":{},"visible":true}]}]'::jsonb,
      '00000000-0000-0000-0000-000000000011', true, null);
    cnt := cnt + 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.layouts WHERE name = 'Documentation Hub' AND is_template = true) THEN
    INSERT INTO public.layouts (name, description, type, category, sections, theme_id, is_template, created_by)
    VALUES ('Documentation Hub','Structured docs layout. About, milestones, timeline, credits.','standard','Documentation',
      '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":false,"showTags":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"heading-block","position":0,"config":{"text":"About","level":2},"visible":true},{"id":"b3","type":"project-about","position":1,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"full","blocks":[{"id":"b4","type":"project-milestones","position":0,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"full","blocks":[{"id":"b5","type":"project-credits","position":0,"config":{},"visible":true}]}]'::jsonb,
      '00000000-0000-0000-0000-000000000013', true, null);
    cnt := cnt + 1;
  END IF;
  RETURN cnt;
END; $$;
REVOKE ALL ON FUNCTION public.reseed_default_templates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reseed_default_templates() TO authenticated;

SELECT public.reseed_default_templates();