-- ============================================================================
-- Challenge pass criteria
--
-- Lets challenge creators state, up front, what a passing submission must
-- include (e.g. "working demo + 3 commits + a short write-up"). The criteria
-- are shown to participants before they submit and again inside the creator's
-- review panel so verdicts stay consistent.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.
-- ============================================================================

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS pass_criteria text;

COMMENT ON COLUMN public.challenges.pass_criteria IS
  'Optional rubric a creator uses to judge submissions — shown to participants before they submit and to the creator during review.';

NOTIFY pgrst, 'reload schema';
