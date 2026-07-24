-- Fix missing GRANT statements for authenticated role
-- Many tables have RLS policies but are missing the base table-level grants
-- that Postgres requires before RLS is even evaluated.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT ON public.contribution_log TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.discussion_replies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_discussions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_milestones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_open_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_role_applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_updates TO authenticated;
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_item_tags TO authenticated;
GRANT SELECT, INSERT ON public.library_versions TO authenticated;
GRANT SELECT, INSERT ON public.activity_events TO authenticated;

-- Also ensure anon can read public-facing tables
GRANT SELECT ON public.posts TO anon;
GRANT SELECT ON public.comments TO anon;
GRANT SELECT ON public.contribution_log TO anon;
GRANT SELECT ON public.discussion_replies TO anon;
GRANT SELECT ON public.post_actions TO anon;
GRANT SELECT ON public.project_discussions TO anon;
GRANT SELECT ON public.project_milestones TO anon;
GRANT SELECT ON public.project_open_roles TO anon;
GRANT SELECT ON public.project_role_applications TO anon;
GRANT SELECT ON public.project_updates TO anon;
GRANT SELECT ON public.user_achievements TO anon;
