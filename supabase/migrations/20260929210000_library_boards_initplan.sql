-- ============================================================================
-- RLS performance: library boards back on the initplan form.
--
-- The boards tables shipped (20260925150000) three days *after* the
-- 20260922101000 auth_rls_initplan sweep, so their policies reintroduced the
-- per-row `auth.uid()` evaluation that sweep had removed everywhere else —
-- caught by supabase/tests/query_load_rpcs.sql ("no public policy references
-- auth.uid() outside a scalar subquery").
--
-- `(select auth.uid())` is the same STABLE call wrapped in a scalar subquery,
-- which lets Postgres compute it once per statement (InitPlan) instead of
-- once per candidate row. Semantics are unchanged.
-- ============================================================================

DROP POLICY IF EXISTS "Owner CRUD boards" ON library_boards;
CREATE POLICY "Owner CRUD boards"
  ON library_boards FOR ALL
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Owner CRUD board columns" ON library_board_columns;
CREATE POLICY "Owner CRUD board columns"
  ON library_board_columns FOR ALL
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Owner CRUD board cards" ON library_board_cards;
CREATE POLICY "Owner CRUD board cards"
  ON library_board_cards FOR ALL
  USING ((select auth.uid()) = user_id);
