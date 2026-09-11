-- Studio publish notes: a short changelog line a creator attaches to a publish.
-- Adds `page_versions.note` and a `publish_page_version(uuid, text)` overload so
-- the original `(uuid)` RPC keeps working (RLS regression tests check it) while
-- the Studio editor can persist a note with the new signature.

ALTER TABLE public.page_versions
  ADD COLUMN IF NOT EXISTS note text;

-- Publish the current Studio state as a versioned snapshot with an optional
-- note. Mirrors publish_page_version(uuid) with the note column added; the two
-- signatures do not conflict (no defaults, so calls resolve exactly).
CREATE OR REPLACE FUNCTION public.publish_page_version(_page_id uuid, _note text)
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
    page_id, version, layout, theme_id, theme_overrides, published_by, note
  )
  SELECT
    _page_id,
    _version,
    l.sections,
    _page.theme_id,
    _page.theme_overrides,
    auth.uid(),
    NULLIF(trim(_note), '')
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

REVOKE ALL ON FUNCTION public.publish_page_version(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_page_version(uuid, text) TO authenticated;