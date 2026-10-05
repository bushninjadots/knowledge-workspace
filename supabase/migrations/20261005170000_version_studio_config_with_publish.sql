-- Version the Studio's appearance config with each publish.
--
-- page_versions snapshotted layout + theme, but not pages.config (structure,
-- personality, density, radius, accent, card fill…). The public page read the
-- live pages.config, and the editor autosaves it a second after every change,
-- so unpublished appearance edits went live immediately while the layout
-- waited for Publish — visitors saw a hybrid, and rollback could not restore
-- appearance. Snapshot config alongside layout and theme, restore it on
-- rollback, and backfill existing versions with each page's current config
-- (the best available approximation of what was published).

ALTER TABLE public.page_versions ADD COLUMN config jsonb;

COMMENT ON COLUMN public.page_versions.config IS
  'Studio appearance config (StudioConfig) as published with this version.';

UPDATE public.page_versions v
SET config = p.config
FROM public.pages p
WHERE p.id = v.page_id;

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
    page_id, version, layout, theme_id, theme_overrides, config, published_by, note
  )
  SELECT
    _page_id,
    _version,
    l.sections,
    _page.theme_id,
    _page.theme_overrides,
    _page.config,
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
      -- Versions published before config was snapshotted keep today's config.
      config = COALESCE(_snapshot.config, _page.config),
      status = 'published',
      published_at = now()
  WHERE id = _page_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rollback_page_version(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rollback_page_version(uuid, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
