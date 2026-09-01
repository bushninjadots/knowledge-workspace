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
AS $$
BEGIN
  UPDATE public.layouts
  SET sections = p_sections
  WHERE id = p_layout_id
    AND EXISTS (
      SELECT 1
      FROM public.pages
      WHERE pages.id = p_page_id
        AND pages.layout_id = p_layout_id
        AND pages.owner_id = auth.uid()
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Studio layout was not found or is not owned by the current user';
  END IF;

  UPDATE public.pages
  SET config = p_config,
      composition_id = p_composition_id
  WHERE id = p_page_id
    AND layout_id = p_layout_id
    AND owner_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Studio page was not found or is not owned by the current user';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_studio_composition(uuid, uuid, jsonb, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_studio_composition(uuid, uuid, jsonb, jsonb, text) TO authenticated;
