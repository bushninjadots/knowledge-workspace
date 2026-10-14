-- ============================================================================
-- Dev journal
--
-- Short log lines a member writes (or their tools write for them) as they
-- work: what they did, fixed, decided, learned, where they're stuck and
-- what's next. They become the daily standup, the weekly ship draft and the
-- monthly brag doc. Private by default; a member can show chosen entries on
-- their profile.
--
-- • journal_entries   one line each, optional longer detail, project, link
--                     and the tool it came from (tethyr, claude-code, cursor,
--                     vscode, git, obsidian, api, …).
-- • journal_tokens    personal access tokens for the journal API and MCP
--                     server (/api/journal, /api/mcp). Only a SHA-256 hash is
--                     stored; the token is shown once. Created by the server.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'did'
    CHECK (kind IN ('did', 'fixed', 'decided', 'learned', 'stuck', 'next')),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),
  detail text CHECK (detail IS NULL OR char_length(detail) <= 4000),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'tethyr' CHECK (source ~ '^[a-z0-9][a-z0-9_-]{0,31}$'),
  source_url text CHECK (source_url IS NULL OR (source_url ~ '^https://' AND char_length(source_url) <= 500)),
  is_public boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journal_entries_author_time_idx
  ON public.journal_entries (author_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS journal_entries_public_idx
  ON public.journal_entries (author_id, occurred_at DESC) WHERE is_public;

CREATE OR REPLACE FUNCTION public.prepare_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.body := btrim(NEW.body);
  NEW.detail := NULLIF(btrim(COALESCE(NEW.detail, '')), '');
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    -- Tools may backdate a little (an import, a missed sync), never ahead.
    IF NEW.occurred_at > now() + interval '5 minutes'
       OR NEW.occurred_at < now() - interval '30 days' THEN
      NEW.occurred_at := now();
    END IF;
    IF auth.uid() IS NOT NULL AND (
         SELECT count(*) FROM public.journal_entries
          WHERE author_id = NEW.author_id AND created_at > now() - interval '1 day') >= 300 THEN
      RAISE EXCEPTION 'rate_limited: That''s a lot of journal entries today. Try again tomorrow.'
        USING ERRCODE = '54000';
    END IF;
  ELSE
    NEW.author_id := OLD.author_id;
    NEW.created_at := OLD.created_at;
    NEW.source := OLD.source;
  END IF;

  -- Only a project the author created or contributes to.
  IF NEW.project_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.projects p
        WHERE p.id = NEW.project_id
          AND (p.profile_id = NEW.author_id OR EXISTS (
                 SELECT 1 FROM public.project_contributors c
                  WHERE c.project_id = p.id AND c.profile_id = NEW.author_id))) THEN
    NEW.project_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_journal_entry() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prepare_journal_entry ON public.journal_entries;
CREATE TRIGGER prepare_journal_entry
  BEFORE INSERT OR UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.prepare_journal_entry();

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read their journal and shared entries" ON public.journal_entries;
CREATE POLICY "Members read their journal and shared entries" ON public.journal_entries
  FOR SELECT USING (is_public OR (SELECT auth.uid()) = author_id);
DROP POLICY IF EXISTS "Members write their own journal" ON public.journal_entries;
CREATE POLICY "Members write their own journal" ON public.journal_entries
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = author_id);
DROP POLICY IF EXISTS "Members edit their own journal" ON public.journal_entries;
CREATE POLICY "Members edit their own journal" ON public.journal_entries
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = author_id) WITH CHECK ((SELECT auth.uid()) = author_id);
DROP POLICY IF EXISTS "Members delete their own journal" ON public.journal_entries;
CREATE POLICY "Members delete their own journal" ON public.journal_entries
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = author_id);

REVOKE ALL ON public.journal_entries FROM anon, authenticated;
GRANT SELECT ON public.journal_entries TO anon, authenticated;
GRANT INSERT (author_id, kind, body, detail, project_id, source, source_url, is_public, occurred_at)
  ON public.journal_entries TO authenticated;
GRANT UPDATE (kind, body, detail, project_id, source_url, is_public, resolved_at)
  ON public.journal_entries TO authenticated;
GRANT DELETE ON public.journal_entries TO authenticated;

-- ── Personal access tokens ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.journal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  token_hash text NOT NULL UNIQUE,
  prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS journal_tokens_user_idx ON public.journal_tokens (user_id, created_at DESC);

ALTER TABLE public.journal_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members see their own tokens" ON public.journal_tokens;
CREATE POLICY "Members see their own tokens" ON public.journal_tokens
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Members revoke their own tokens" ON public.journal_tokens;
CREATE POLICY "Members revoke their own tokens" ON public.journal_tokens
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Members delete their own tokens" ON public.journal_tokens;
CREATE POLICY "Members delete their own tokens" ON public.journal_tokens
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- The hash never leaves the server; members see names, prefixes and dates.
REVOKE ALL ON public.journal_tokens FROM anon, authenticated;
GRANT SELECT (id, user_id, name, prefix, created_at, last_used_at, revoked_at)
  ON public.journal_tokens TO authenticated;
GRANT UPDATE (revoked_at) ON public.journal_tokens TO authenticated;
GRANT DELETE ON public.journal_tokens TO authenticated;
