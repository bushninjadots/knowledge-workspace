-- Fix SECURITY DEFINER on project_repositories_safe view
-- The default SECURITY DEFINER bypasses RLS for the querying user.
-- SECURITY INVOKER makes the view respect the caller's RLS context.
ALTER VIEW public.project_repositories_safe SET (security_invoker = on);
