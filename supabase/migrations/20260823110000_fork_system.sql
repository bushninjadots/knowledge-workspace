-- Stage 15 — Fork / Remix system: lineage tracking for layout derivation.
-- A fork is a layout copy with a recorded parent relationship.
-- Remix = fork + publish the fork as a template.

-- 1. Forks table — records every fork event with lineage.
CREATE TABLE IF NOT EXISTS public.forks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_layout_id uuid NOT NULL REFERENCES public.layouts(id) ON DELETE RESTRICT,
  child_layout_id  uuid NOT NULL REFERENCES public.layouts(id) ON DELETE RESTRICT,
  creator_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  forked_at        timestamptz NOT NULL DEFAULT now(),

  -- One child can only be forked once from a given parent (prevents double-counting).
  CONSTRAINT forks_child_unique UNIQUE (child_layout_id)
);

COMMENT ON TABLE public.forks IS 'Records layout derivation — who forked what from where.';
COMMENT ON COLUMN public.forks.parent_layout_id IS 'The original template/layout that was forked.';
COMMENT ON COLUMN public.forks.child_layout_id IS 'The new layout created by the fork.';
COMMENT ON COLUMN public.forks.creator_id IS 'The user who performed the fork.';

CREATE INDEX IF NOT EXISTS forks_parent_idx ON public.forks (parent_layout_id);
CREATE INDEX IF NOT EXISTS forks_child_idx ON public.forks (child_layout_id);

ALTER TABLE public.forks ENABLE ROW LEVEL SECURITY;

-- Everyone can read fork records (public lineage).
DO $$ BEGIN
  CREATE POLICY "Forks are publicly readable"
    ON public.forks FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can create forks"
    ON public.forks FOR INSERT
    WITH CHECK (auth.uid() = creator_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

GRANT SELECT ON public.forks TO anon;
GRANT SELECT, INSERT ON public.forks TO authenticated;
GRANT ALL ON public.forks TO service_role;

-- 2. Fork count on layouts (cached for template display).
ALTER TABLE public.layouts ADD COLUMN IF NOT EXISTS fork_count integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.layouts.fork_count IS 'How many times this layout has been forked.';

-- RPC to atomically increment fork count.
CREATE OR REPLACE FUNCTION public.increment_fork_count(layout_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.layouts
  SET fork_count = fork_count + 1
  WHERE id = layout_id;
$$;

COMMENT ON FUNCTION public.increment_fork_count IS 'Bump fork count when a layout is forked.';
GRANT EXECUTE ON FUNCTION public.increment_fork_count TO authenticated, service_role;

-- 3. Lineage helper — returns the full ancestry chain for a layout.
CREATE OR REPLACE FUNCTION public.get_layout_lineage(start_id uuid)
RETURNS TABLE (
  layout_id    uuid,
  parent_id    uuid,
  depth        integer
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH RECURSIVE lineage AS (
    SELECT f.child_layout_id AS layout_id, f.parent_layout_id AS parent_id, 0 AS depth
    FROM public.forks f
    WHERE f.child_layout_id = start_id
    UNION ALL
    SELECT f.child_layout_id, f.parent_layout_id, l.depth + 1
    FROM public.forks f
    JOIN lineage l ON l.parent_id = f.child_layout_id
  )
  SELECT * FROM lineage;
$$;

COMMENT ON FUNCTION public.get_layout_lineage IS 'Return the full ancestor chain for a layout.';
GRANT EXECUTE ON FUNCTION public.get_layout_lineage TO anon, authenticated, service_role;