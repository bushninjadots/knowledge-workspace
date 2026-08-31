-- Site-wide public data contracts.
-- Public clients should query deliberate views instead of selecting sensitive
-- base-table columns with `*`.

CREATE OR REPLACE VIEW public.project_repositories_public
WITH (security_invoker = true) AS
SELECT id, project_id, provider, url, created_at, updated_at
FROM public.project_repositories;

REVOKE ALL ON public.project_repositories_public FROM PUBLIC;
GRANT SELECT ON public.project_repositories_public TO anon, authenticated;

-- The existing safe view is retained for compatibility and gets the same
-- invoker semantics so its rows continue to follow project repository RLS.
CREATE OR REPLACE VIEW public.project_repositories_safe
WITH (security_invoker = true) AS
SELECT id, project_id, provider, url, created_at, updated_at
FROM public.project_repositories;

REVOKE ALL ON public.project_repositories_safe FROM PUBLIC;
GRANT SELECT ON public.project_repositories_safe TO anon, authenticated;

-- Public repository reads should come from the safe contract. The base table
-- remains available only to authenticated owners/contributors and service_role.
REVOKE SELECT ON public.project_repositories FROM anon;
GRANT SELECT ON public.project_repositories TO authenticated;

NOTIFY pgrst, 'reload schema';
