-- ============================================================================
-- session_availability: remove blanket world-readable policies
-- ============================================================================
-- session_availability holds a user's bookable time slots. Two leftover
-- policies made EVERY user's rows readable — even by anon:
--   * "Availability viewable by authenticated" (SELECT TO authenticated USING true)
--   * "Others view availability"               (SELECT TO public USING true)
--
-- Sessions themselves are membership-gated (is_session_member), so their
-- availability data should not be a public side-channel. The client only ever
-- reads/writes the signed-in user's own slots (use-sessions.ts), so the
-- owner-scoped ALL policies fully cover real usage.
--
-- Owner access keeps working through:
--   * "Owner manages availability" (ALL TO authenticated USING profile_id = auth.uid())
--   * "Owner CRUD availability"    (ALL TO public USING auth.uid() = profile_id)
-- ============================================================================

DROP POLICY IF EXISTS "Availability viewable by authenticated"
  ON public.session_availability;
DROP POLICY IF EXISTS "Others view availability"
  ON public.session_availability;
