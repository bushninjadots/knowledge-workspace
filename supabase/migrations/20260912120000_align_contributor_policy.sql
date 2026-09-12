-- Align "Owner can add contributor" policy to FOR INSERT TO authenticated.
--
-- F6 in the drift audit: the hosted database already restricts this policy
-- to authenticated, but the migration (20260706100000) creates it for all
-- roles (PUBLIC). The WITH CHECK requires p.profile_id = auth.uid(), which is
-- NULL for anon, so anon can never satisfy it — the difference is not
-- exploitable. Aligning eliminates a permanent diff line between local and
-- hosted.
--
-- Forward-only: ALTER POLICY changes the role clause without dropping and
-- recreating, so it fails loudly if the policy is absent (unlike DROP+CREATE
-- with IF EXISTS, which silently no-ops and is the replay-fragile pattern
-- called out in the drift audit's root-cause analysis).

ALTER POLICY "Owner can add contributor" ON public.project_contributors
  TO authenticated;
