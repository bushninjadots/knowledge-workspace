-- Watcher rows are private per-user state. The return shelf only reads the
-- authenticated user's own rows, so the public-project clause is unnecessary
-- and would leak who watches any public project. Tighten to own rows only.
DROP POLICY IF EXISTS "Visible projects watchers are readable" ON public.project_watchers;

DO $$ BEGIN
  CREATE POLICY "Users read their own watch rows"
    ON public.project_watchers FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
