-- ============================================================================
-- Member app launcher
--
-- The apps on a member's dashboard: web links to where they work (Linear,
-- Figma, Notion, Vercel…) and deep links that open desktop apps straight to
-- the right place (obsidian://open?vault=…, vscode://file/…). Private to the
-- member — vault names and folder paths never reach anyone else. Public
-- "where to find me" links stay in profiles.social_links.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.member_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  app_id text NOT NULL CHECK (app_id ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  label text CHECK (label IS NULL OR char_length(btrim(label)) BETWEEN 1 AND 40),
  -- https, or one of the desktop schemes the catalog knows (src/lib/app-catalog.ts).
  url text NOT NULL CHECK (
    char_length(url) <= 1000
    AND url ~ '^(https://|obsidian://|vscode://|vscode-insiders://|cursor://|zed://)'
  ),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_apps_user_idx ON public.member_apps (user_id, position);

CREATE OR REPLACE FUNCTION public.limit_member_apps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.member_apps WHERE user_id = NEW.user_id) >= 24 THEN
    RAISE EXCEPTION 'rate_limited: You can keep up to 24 apps on your launcher.'
      USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.limit_member_apps() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS limit_member_apps ON public.member_apps;
CREATE TRIGGER limit_member_apps
  BEFORE INSERT ON public.member_apps
  FOR EACH ROW EXECUTE FUNCTION public.limit_member_apps();

ALTER TABLE public.member_apps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage their own launcher" ON public.member_apps;
CREATE POLICY "Members manage their own launcher" ON public.member_apps
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.member_apps FROM anon, authenticated;
GRANT SELECT, DELETE ON public.member_apps TO authenticated;
GRANT INSERT (user_id, app_id, label, url, position) ON public.member_apps TO authenticated;
GRANT UPDATE (label, url, position) ON public.member_apps TO authenticated;
