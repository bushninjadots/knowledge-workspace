-- Expose the cached repository metadata through the safe read contract.
--
-- The S5 hardening pass excluded `metadata` from project_repositories_safe
-- because it "can contain tokens" — a precaution borrowed from
-- connected_accounts that never matched this table: project_repositories
-- has never stored secrets, only GitHub's public repo fields (full_name,
-- stars, forks, language, topics, description, default branch, visibility).
-- Every client reader (code panel, repo cards, repos block) selects the safe
-- view, so those stats were written on link/import but never rendered back.
--
-- The view stays security_invoker so rows keep following the project RLS
-- policy ("Public can view project repositories" / owner+contributor reads);
-- callers therefore still need SELECT on the base table, which anon holds for
-- exactly that policy-gated read. Writes stay owner-only via the
-- TO authenticated policies. Grants on the view are unchanged.
--
-- Column note: Postgres only allows CREATE OR REPLACE VIEW to append columns,
-- never insert/rename existing ones — so `metadata` goes last, after the
-- columns the view already had (same trap 20260829100000 hit).

CREATE OR REPLACE VIEW public.project_repositories_safe
WITH (security_invoker = true) AS
SELECT id, project_id, provider, url, created_at, updated_at, metadata
FROM public.project_repositories;

REVOKE ALL ON public.project_repositories_safe FROM PUBLIC;
GRANT SELECT ON public.project_repositories_safe TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
