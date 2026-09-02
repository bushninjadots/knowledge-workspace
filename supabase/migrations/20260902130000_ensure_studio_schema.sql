-- Ensure Studio schema is consistent. The remote_schema migration (20260901204727)
-- dropped apply_studio_composition and the config/composition_id/vibe_id columns,
-- then 20260902110039 re-added the columns but not the function. This migration
-- is idempotent and safe to run on any state.

-- Pages columns
ALTER TABLE public.pages ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.pages ADD COLUMN IF NOT EXISTS composition_id text;
ALTER TABLE public.pages ADD COLUMN IF NOT EXISTS vibe_id text;
COMMENT ON COLUMN public.pages.config IS 'StudioConfig JSON: radius, typography, density, accent mode/color, and the active personality preset id.';

-- Studio composition RPC
CREATE OR REPLACE FUNCTION public.apply_studio_composition(
  p_page_id uuid,
  p_layout_id uuid,
  p_sections jsonb,
  p_config jsonb,
  p_composition_id text
) RETURNS void
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = public
AS $$
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
     SET config         = p_config,
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
