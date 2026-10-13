-- A member's connected GitHub account as a cached public snapshot (profile,
-- contributions, languages, pinned / top repos, recent activity) for the
-- Studio's GitHub block. Written only by the server (syncGithubProfile and
-- the daily job, with the service role), so nobody can fake their numbers;
-- readable by anyone, like the rest of a public profile. The member can
-- delete their own row (Disconnect clears it).
CREATE TABLE IF NOT EXISTS public.profile_github (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  username text NOT NULL,
  snapshot jsonb NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_github_synced_idx ON public.profile_github (synced_at);

ALTER TABLE public.profile_github ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GitHub snapshots are public" ON public.profile_github
  FOR SELECT USING (true);
CREATE POLICY "Members can clear their GitHub snapshot" ON public.profile_github
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = profile_id);

REVOKE ALL ON public.profile_github FROM anon, authenticated;
GRANT SELECT ON public.profile_github TO anon, authenticated;
GRANT DELETE ON public.profile_github TO authenticated;
