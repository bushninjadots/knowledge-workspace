-- Repair schema drift left behind when the original Studio migrations were
-- recorded as applied without changing the live database.
--
-- This migration must run with a role that owns public.pages and the other
-- affected objects. It deliberately does not SET ROLE sandbox_exec: hosted
-- environments may not grant that role to the migration runner.

-- Studio configuration and chat read receipts.
ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS composition_id text,
  ADD COLUMN IF NOT EXISTS vibe_id text;

ALTER TABLE public.community_space_members
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

-- Immutable published Studio snapshots.
CREATE TABLE IF NOT EXISTS public.page_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL,
  version integer NOT NULL,
  layout jsonb NOT NULL DEFAULT '{"sections": []}'::jsonb,
  theme_id uuid,
  theme_overrides jsonb,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid,
  CONSTRAINT page_versions_pkey PRIMARY KEY (id),
  CONSTRAINT page_versions_page_id_version_key UNIQUE (page_id, version),
  CONSTRAINT page_versions_page_id_fkey FOREIGN KEY (page_id)
    REFERENCES public.pages(id) ON DELETE CASCADE,
  CONSTRAINT page_versions_published_by_fkey FOREIGN KEY (published_by)
    REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT page_versions_theme_id_fkey FOREIGN KEY (theme_id)
    REFERENCES public.themes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS page_versions_page_published_idx
  ON public.page_versions(page_id, published_at DESC);

ALTER TABLE public.page_versions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.page_versions TO anon, authenticated;
GRANT INSERT ON public.page_versions TO authenticated;
GRANT ALL ON public.page_versions TO service_role;

DO $$ BEGIN
  CREATE POLICY "Owners can create page versions"
    ON public.page_versions FOR INSERT TO authenticated
    WITH CHECK (
      published_by = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.pages p
        WHERE p.id = page_versions.page_id
          AND (
            (p.owner_type = 'profile' AND p.owner_id = auth.uid())
            OR (
              p.owner_type = 'project'
              AND EXISTS (
                SELECT 1 FROM public.projects pr
                WHERE pr.id = p.owner_id AND pr.profile_id = auth.uid()
              )
            )
          )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Published page versions are publicly readable"
    ON public.page_versions FOR SELECT TO public
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Publish the current Studio state as a versioned snapshot.
CREATE OR REPLACE FUNCTION public.publish_page_version(_page_id uuid)
RETURNS public.page_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _page public.pages;
  _version integer;
  _snapshot public.page_versions;
BEGIN
  SELECT * INTO _page
  FROM public.pages
  WHERE id = _page_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Page not found';
  END IF;

  IF NOT (
    (_page.owner_type = 'profile' AND _page.owner_id = auth.uid())
    OR (
      _page.owner_type = 'project'
      AND EXISTS (
        SELECT 1 FROM public.projects pr
        WHERE pr.id = _page.owner_id AND pr.profile_id = auth.uid()
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO _version
  FROM public.page_versions
  WHERE page_id = _page_id;

  INSERT INTO public.page_versions (
    page_id, version, layout, theme_id, theme_overrides, published_by
  )
  SELECT
    _page_id, _version, l.sections, _page.theme_id, _page.theme_overrides, auth.uid()
  FROM public.layouts l
  WHERE l.id = _page.layout_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Page layout not found';
  END IF;

  UPDATE public.pages
  SET status = 'published', published_at = now()
  WHERE id = _page_id;

  SELECT * INTO _snapshot
  FROM public.page_versions
  WHERE page_id = _page_id AND version = _version;

  RETURN _snapshot;
END;
$function$;

-- Restore a previous published Studio version.
CREATE OR REPLACE FUNCTION public.rollback_page_version(
  _page_id uuid,
  _version integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _snapshot public.page_versions;
  _page public.pages;
BEGIN
  SELECT * INTO _page FROM public.pages WHERE id = _page_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Page not found';
  END IF;

  IF NOT (
    (_page.owner_type = 'profile' AND _page.owner_id = auth.uid())
    OR (
      _page.owner_type = 'project'
      AND EXISTS (
        SELECT 1 FROM public.projects pr
        WHERE pr.id = _page.owner_id AND pr.profile_id = auth.uid()
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO _snapshot
  FROM public.page_versions
  WHERE page_id = _page_id AND version = _version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version not found';
  END IF;

  UPDATE public.layouts SET sections = _snapshot.layout WHERE id = _page.layout_id;
  UPDATE public.pages
  SET theme_id = _snapshot.theme_id,
      theme_overrides = _snapshot.theme_overrides,
      status = 'published',
      published_at = now()
  WHERE id = _page_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.publish_page_version(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_page_version(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_page_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_page_version(uuid, integer) TO authenticated;

-- The atomic Studio draft save used by the editor.
CREATE OR REPLACE FUNCTION public.apply_studio_composition(
  p_page_id uuid,
  p_layout_id uuid,
  p_sections jsonb,
  p_config jsonb,
  p_composition_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.layouts
  SET sections = p_sections
  WHERE id = p_layout_id
    AND EXISTS (
      SELECT 1 FROM public.pages
      WHERE pages.id = p_page_id
        AND pages.layout_id = p_layout_id
        AND pages.owner_id = auth.uid()
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Studio layout was not found or is not owned by the current user';
  END IF;

  UPDATE public.pages
  SET config = p_config, composition_id = p_composition_id
  WHERE id = p_page_id
    AND layout_id = p_layout_id
    AND owner_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Studio page was not found or is not owned by the current user';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_studio_composition(uuid, uuid, jsonb, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_studio_composition(uuid, uuid, jsonb, jsonb, text)
  TO authenticated;

-- Project return-loop data used by project visits and evidence recognition.
CREATE TABLE IF NOT EXISTS public.project_visits (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_visits_pkey PRIMARY KEY (project_id, user_id)
);

ALTER TABLE public.project_visits ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.project_visits TO authenticated;
GRANT ALL ON public.project_visits TO service_role;

DO $$ BEGIN
  CREATE POLICY "Users manage their project visits"
    ON public.project_visits FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.project_recognitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_activity_id uuid NOT NULL REFERENCES public.project_activity(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  giver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_recognitions_activity_giver_kind_key
    UNIQUE (project_activity_id, giver_id, kind)
);

ALTER TABLE public.project_recognitions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.project_recognitions TO authenticated;
GRANT ALL ON public.project_recognitions TO service_role;

DO $$ BEGIN
  CREATE POLICY "Project recognitions are readable"
    ON public.project_recognitions FOR SELECT TO authenticated
    USING (
      giver_id = auth.uid()
      OR recipient_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_recognitions.project_id AND p.visibility = 'public'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users recognize visible project evidence"
    ON public.project_recognitions FOR INSERT TO authenticated
    WITH CHECK (
      giver_id = auth.uid()
      AND giver_id <> recipient_id
      AND EXISTS (
        SELECT 1
        FROM public.project_activity a
        JOIN public.projects p ON p.id = a.project_id
        WHERE a.id = project_recognitions.project_activity_id
          AND a.project_id = project_recognitions.project_id
          AND (p.visibility = 'public' OR p.profile_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users remove their own recognition"
    ON public.project_recognitions FOR DELETE TO authenticated
    USING (giver_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS project_recognitions_activity_idx
  ON public.project_recognitions(project_activity_id);

NOTIFY pgrst, 'reload schema';
