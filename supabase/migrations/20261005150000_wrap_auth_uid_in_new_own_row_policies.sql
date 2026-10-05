-- Wrap auth.uid() in a scalar subquery in the own-row policies added on
-- 2026-10-01 (template stars, project AI tags).
--
-- A bare auth.uid() in a policy is re-evaluated for every row the statement
-- touches; `(select auth.uid())` is evaluated once per statement as an
-- initPlan. hardening_invariants.sql asserts every public policy uses the
-- wrapped form, and these four were the only ones that did not.
--
-- ALTER POLICY (not drop-and-recreate) so a missing policy fails loudly
-- instead of being silently created on a drifted database.

ALTER POLICY "template_stars_insert_own" ON public.template_stars
  WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY "template_stars_delete_own" ON public.template_stars
  USING (user_id = (select auth.uid()));

ALTER POLICY project_ai_tags_insert_own ON public.project_ai_tags
  WITH CHECK (tagger_id = (select auth.uid()));

ALTER POLICY project_ai_tags_delete_own ON public.project_ai_tags
  USING (tagger_id = (select auth.uid()));
