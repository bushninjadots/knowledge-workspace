-- Template stars + submission review flow.
--
-- 1. submission_status — community templates are no longer auto-published.
--    A member submits (status = 'pending'); only an approved template appears
--    in the public directory. Existing templates default to 'approved' so
--    the current catalog stays visible.
-- 2. star_count — denormalized counter for fast sorting/display.
-- 3. template_stars — one row per (user, layout) so a member can star or
--    unstar a template. Toggling bumps star_count atomically via RPC.

-- ── 1. Submission status ────────────────────────────────────────────────────
ALTER TABLE public.layouts ADD COLUMN IF NOT EXISTS submission_status text
  NOT NULL DEFAULT 'approved'
  CHECK (submission_status IN ('approved', 'pending', 'rejected'));

COMMENT ON COLUMN public.layouts.submission_status IS
  'Review state for community templates: pending (submitted, awaiting review), approved (public), rejected.';

-- Existing published templates stay visible.
UPDATE public.layouts
  SET submission_status = 'approved'
  WHERE is_template = true AND submission_status IS NULL;

-- Index for finding pending submissions.
CREATE INDEX IF NOT EXISTS layouts_pending_submissions_idx
  ON public.layouts (created_by, updated_at DESC)
  WHERE submission_status = 'pending';

-- ── 2. Star count ────────────────────────────────────────────────────────────
ALTER TABLE public.layouts ADD COLUMN IF NOT EXISTS star_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.layouts.star_count IS
  'How many members have starred this template. Only meaningful when is_template = true.';

CREATE INDEX IF NOT EXISTS layouts_template_stars_idx
  ON public.layouts (star_count DESC)
  WHERE is_template = true;

-- ── 3. template_stars table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.template_stars (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  layout_id  uuid NOT NULL REFERENCES public.layouts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, layout_id)
);

COMMENT ON TABLE public.template_stars IS
  'One row per (member, template) star. The denormalized layouts.star_count is the display counter.';

ALTER TABLE public.template_stars ENABLE ROW LEVEL SECURITY;

-- A member can read all stars (to see which templates they've starred).
CREATE POLICY "template_stars_select_all" ON public.template_stars
  FOR SELECT TO authenticated USING (true);

-- A member can only insert/delete their own stars.
CREATE POLICY "template_stars_insert_own" ON public.template_stars
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "template_stars_delete_own" ON public.template_stars
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- anon can read star counts (via the layouts table) but not the star rows.
REVOKE ALL ON public.template_stars FROM anon;

-- ── 4. toggle_template_star RPC ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_template_star(target_layout_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  starred boolean;
BEGIN
  -- Insert if not already starred; if the insert conflicts (already starred),
  -- delete instead. Returns true = now starred, false = now unstarred.
  INSERT INTO public.template_stars (user_id, layout_id)
  VALUES (auth.uid(), target_layout_id)
  ON CONFLICT (user_id, layout_id) DO NOTHING
  RETURNING true INTO starred;

  IF starred IS NULL THEN
    -- Conflict — already starred, so unstar.
    DELETE FROM public.template_stars
      WHERE user_id = auth.uid() AND layout_id = target_layout_id;
    UPDATE public.layouts
      SET star_count = GREATEST(0, star_count - 1)
      WHERE id = target_layout_id;
    RETURN false;
  END IF;

  UPDATE public.layouts
    SET star_count = star_count + 1
    WHERE id = target_layout_id;
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.toggle_template_star IS
  'Star or unstar a template for the calling member. Returns true if now starred, false if unstarred.';

-- Only authenticated users can toggle stars (the function checks auth.uid()).
REVOKE EXECUTE ON FUNCTION public.toggle_template_star FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_template_star TO authenticated;
