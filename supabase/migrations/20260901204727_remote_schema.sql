-- Restore the final Studio architecture after the legacy/config transition.
-- This migration intentionally contains only Studio/page-version changes.
-- The remote database already has these changes applied; this file reconstructs
-- them correctly for fresh databases.

-- The previous Studio RPC is obsolete now that page versions own publishing.
DROP FUNCTION IF EXISTS public.apply_studio_composition(
  uuid,
  uuid,
  jsonb,
  jsonb,
  text
);

-- Remove the old Studio configuration fields.
ALTER TABLE public.pages
  DROP COLUMN IF EXISTS config,
  DROP COLUMN IF EXISTS composition_id,
  DROP COLUMN IF EXISTS vibe_id;

-- Store immutable snapshots of published Studio pages.
CREATE TABLE public.page_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL,
  version integer NOT NULL,
  layout jsonb NOT NULL DEFAULT '{"sections": []}'::jsonb,
  theme_id uuid,
  theme_overrides jsonb,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid
);

ALTER TABLE public.page_versions
  ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX page_versions_pkey
  ON public.page_versions USING btree (id);

CREATE UNIQUE INDEX page_versions_page_id_version_key
  ON public.page_versions USING btree (page_id, version);

CREATE INDEX page_versions_page_published_idx
  ON public.page_versions USING btree (page_id, published_at DESC);

ALTER TABLE public.page_versions
  ADD CONSTRAINT page_versions_pkey
  PRIMARY KEY USING INDEX page_versions_pkey;

ALTER TABLE public.page_versions
  ADD CONSTRAINT page_versions_page_id_fkey
  FOREIGN KEY (page_id)
  REFERENCES public.pages(id)
  ON DELETE CASCADE;

ALTER TABLE public.page_versions
  ADD CONSTRAINT page_versions_published_by_fkey
  FOREIGN KEY (published_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

ALTER TABLE public.page_versions
  ADD CONSTRAINT page_versions_theme_id_fkey
  FOREIGN KEY (theme_id)
  REFERENCES public.themes(id)
  ON DELETE SET NULL;

ALTER TABLE public.page_versions
  ADD CONSTRAINT page_versions_page_id_version_key
  UNIQUE USING INDEX page_versions_page_id_version_key;

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
  SELECT *
  INTO _page
  FROM public.pages
  WHERE id = _page_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Page not found';
  END IF;

  IF NOT (
    (_page.owner_type = 'profile' AND _page.owner_id = auth.uid())
    OR
    (
      _page.owner_type = 'project'
      AND EXISTS (
        SELECT 1
        FROM public.projects pr
        WHERE pr.id = _page.owner_id
          AND pr.profile_id = auth.uid()
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1
  INTO _version
  FROM public.page_versions
  WHERE page_id = _page_id;

  INSERT INTO public.page_versions (
    page_id,
    version,
    layout,
    theme_id,
    theme_overrides,
    published_by
  )
  SELECT
    _page_id,
    _version,
    l.sections,
    _page.theme_id,
    _page.theme_overrides,
    auth.uid()
  FROM public.layouts l
  WHERE l.id = _page.layout_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Page layout not found';
  END IF;

  UPDATE public.pages
  SET
    status = 'published',
    published_at = now()
  WHERE id = _page_id;

  SELECT *
  INTO _snapshot
  FROM public.page_versions
  WHERE page_id = _page_id
    AND version = _version;

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
  SELECT *
  INTO _page
  FROM public.pages
  WHERE id = _page_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Page not found';
  END IF;

  IF NOT (
    (_page.owner_type = 'profile' AND _page.owner_id = auth.uid())
    OR
    (
      _page.owner_type = 'project'
      AND EXISTS (
        SELECT 1
        FROM public.projects pr
        WHERE pr.id = _page.owner_id
          AND pr.profile_id = auth.uid()
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT *
  INTO _snapshot
  FROM public.page_versions
  WHERE page_id = _page_id
    AND version = _version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version not found';
  END IF;

  UPDATE public.layouts
  SET sections = _snapshot.layout
  WHERE id = _page.layout_id;

  UPDATE public.pages
  SET
    theme_id = _snapshot.theme_id,
    theme_overrides = _snapshot.theme_overrides,
    status = 'published',
    published_at = now()
  WHERE id = _page_id;
END;
$function$;

-- Version creation is restricted to the page owner.
CREATE POLICY "Owners can create page versions"
ON public.page_versions
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  published_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.pages p
    WHERE p.id = page_versions.page_id
      AND (
        (
          p.owner_type = 'profile'
          AND p.owner_id = auth.uid()
        )
        OR
        (
          p.owner_type = 'project'
          AND EXISTS (
            SELECT 1
            FROM public.projects pr
            WHERE pr.id = p.owner_id
              AND pr.profile_id = auth.uid()
          )
        )
      )
  )
);

-- Published snapshots are publicly readable.
CREATE POLICY "Published page versions are publicly readable"
ON public.page_versions
AS PERMISSIVE
FOR SELECT
TO public
USING (true);

GRANT EXECUTE ON FUNCTION public.publish_page_version(uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.rollback_page_version(uuid, integer)
TO authenticated;
