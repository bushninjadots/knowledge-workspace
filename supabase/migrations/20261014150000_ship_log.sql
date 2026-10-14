-- ============================================================================
-- Ship log — the weekly habit
--
-- One short note per member per week: "what I shipped". The app drafts it from
-- the member's public GitHub activity, they edit and post it, everyone else
-- can give kudos or reply. Consecutive weeks make a streak; a Friday reminder
-- nudges anyone with a streak to keep it.
--
-- • ships          one per (author, week). week_start is always the current
--                  ISO week (Monday, UTC) — set by the server, so nobody can
--                  backfill a streak.
-- • ship_kudos     one per (ship, giver); never on your own ship.
-- • ship_replies   short replies on a ship.
-- • ship_streak / ship_streaks   consecutive weeks up to this week (or last
--                  week, while this week's ship is still to come).
-- • send_ship_reminders()  Friday 15:00 UTC via pg_cron, when available.
--
-- Also in here, because they share the "keep it safe at launch" purpose:
-- • rate limits on connection requests, posts and ship replies
-- • a confirmed email before sending a connection request (which is what
--   unlocks direct messages) or replying to a ship
-- • launch_metrics() for the service role: activation and retention numbers.
-- ============================================================================

-- ── Helpers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_ship_week()
RETURNS date
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT (date_trunc('week', now() AT TIME ZONE 'utc'))::date;
$$;

GRANT EXECUTE ON FUNCTION public.current_ship_week() TO anon, authenticated;

-- Has the signed-in member confirmed their email? (OAuth sign-ins count.)
CREATE OR REPLACE FUNCTION public.has_confirmed_email(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
     WHERE u.id = p_user_id AND u.email_confirmed_at IS NOT NULL);
$$;

REVOKE ALL ON FUNCTION public.has_confirmed_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_confirmed_email(uuid) TO authenticated;

-- ── Ships ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL DEFAULT public.current_ship_week(),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 3 AND 1000),
  next_up text CHECK (next_up IS NULL OR char_length(next_up) <= 200),
  -- [{ kind, title, url, repo }] picked from the GitHub draft, at most 8.
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(highlights) = 'array' AND jsonb_array_length(highlights) <= 8),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (author_id, week_start)
);

CREATE INDEX IF NOT EXISTS ships_week_idx ON public.ships (week_start DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS ships_author_week_idx ON public.ships (author_id, week_start DESC);

CREATE OR REPLACE FUNCTION public.prepare_ship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _item jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.week_start := public.current_ship_week();
    NEW.created_at := now();
  ELSE
    -- A ship stays in the week it was posted, by the person who posted it.
    NEW.week_start := OLD.week_start;
    NEW.author_id := OLD.author_id;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  NEW.body := btrim(NEW.body);
  NEW.next_up := NULLIF(btrim(COALESCE(NEW.next_up, '')), '');

  -- Highlights are links shown to everyone: https only, short titles.
  FOR _item IN SELECT * FROM jsonb_array_elements(NEW.highlights) LOOP
    IF jsonb_typeof(_item) <> 'object'
       OR COALESCE(_item->>'url', '') !~ '^https://'
       OR char_length(COALESCE(_item->>'title', '')) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'invalid_highlight: highlights need a title and an https link'
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- A ship can point at a project the author created or contributes to.
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

REVOKE ALL ON FUNCTION public.prepare_ship() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prepare_ship ON public.ships;
CREATE TRIGGER prepare_ship
  BEFORE INSERT OR UPDATE ON public.ships
  FOR EACH ROW EXECUTE FUNCTION public.prepare_ship();

ALTER TABLE public.ships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ships are public" ON public.ships;
CREATE POLICY "Ships are public" ON public.ships
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Members post their own ship" ON public.ships;
CREATE POLICY "Members post their own ship" ON public.ships
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = author_id);
DROP POLICY IF EXISTS "Members edit their own ship" ON public.ships;
CREATE POLICY "Members edit their own ship" ON public.ships
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = author_id) WITH CHECK ((SELECT auth.uid()) = author_id);
DROP POLICY IF EXISTS "Members delete their own ship" ON public.ships;
CREATE POLICY "Members delete their own ship" ON public.ships
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = author_id);

REVOKE ALL ON public.ships FROM anon, authenticated;
GRANT SELECT ON public.ships TO anon, authenticated;
GRANT INSERT (author_id, body, next_up, highlights, project_id) ON public.ships TO authenticated;
GRANT UPDATE (body, next_up, highlights, project_id) ON public.ships TO authenticated;
GRANT DELETE ON public.ships TO authenticated;

-- ── Kudos ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ship_kudos (
  ship_id uuid NOT NULL REFERENCES public.ships(id) ON DELETE CASCADE,
  giver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ship_id, giver_id)
);

CREATE INDEX IF NOT EXISTS ship_kudos_giver_idx ON public.ship_kudos (giver_id);

ALTER TABLE public.ship_kudos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ship kudos are public" ON public.ship_kudos;
CREATE POLICY "Ship kudos are public" ON public.ship_kudos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Members give kudos to others' ships" ON public.ship_kudos;
CREATE POLICY "Members give kudos to others' ships" ON public.ship_kudos
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = giver_id
    AND NOT EXISTS (SELECT 1 FROM public.ships s
                     WHERE s.id = ship_id AND s.author_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "Members take back their kudos" ON public.ship_kudos;
CREATE POLICY "Members take back their kudos" ON public.ship_kudos
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = giver_id);

REVOKE ALL ON public.ship_kudos FROM anon, authenticated;
GRANT SELECT ON public.ship_kudos TO anon, authenticated;
GRANT INSERT (ship_id, giver_id) ON public.ship_kudos TO authenticated;
GRANT DELETE ON public.ship_kudos TO authenticated;

-- ── Replies ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ship_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_id uuid NOT NULL REFERENCES public.ships(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ship_replies_ship_idx ON public.ship_replies (ship_id, created_at);
CREATE INDEX IF NOT EXISTS ship_replies_author_idx ON public.ship_replies (author_id, created_at DESC);

ALTER TABLE public.ship_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ship replies are public" ON public.ship_replies;
CREATE POLICY "Ship replies are public" ON public.ship_replies FOR SELECT USING (true);
DROP POLICY IF EXISTS "Verified members reply to ships" ON public.ship_replies;
CREATE POLICY "Verified members reply to ships" ON public.ship_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = author_id
    AND public.has_confirmed_email((SELECT auth.uid())));
DROP POLICY IF EXISTS "Repliers and ship authors remove replies" ON public.ship_replies;
CREATE POLICY "Repliers and ship authors remove replies" ON public.ship_replies
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = author_id
    OR EXISTS (SELECT 1 FROM public.ships s
                WHERE s.id = ship_id AND s.author_id = (SELECT auth.uid())));

REVOKE ALL ON public.ship_replies FROM anon, authenticated;
GRANT SELECT ON public.ship_replies TO anon, authenticated;
GRANT INSERT (ship_id, author_id, body) ON public.ship_replies TO authenticated;
GRANT DELETE ON public.ship_replies TO authenticated;

-- ── Streaks ────────────────────────────────────────────────────────────────
-- Consecutive weeks with a ship, counted back from this week — or from last
-- week while this week's ship hasn't been posted yet, so a streak doesn't
-- read as broken on a Monday morning.
CREATE OR REPLACE FUNCTION public.ship_streak(p_profile_id uuid)
RETURNS integer
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  _week date := public.current_ship_week();
  _n integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ships WHERE author_id = p_profile_id AND week_start = _week) THEN
    _week := _week - 7;
  END IF;
  WHILE EXISTS (SELECT 1 FROM public.ships WHERE author_id = p_profile_id AND week_start = _week) LOOP
    _n := _n + 1;
    _week := _week - 7;
  END LOOP;
  RETURN _n;
END;
$$;

CREATE OR REPLACE FUNCTION public.ship_streaks(p_profile_ids uuid[])
RETURNS TABLE (profile_id uuid, streak integer)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT id, public.ship_streak(id) FROM unnest(p_profile_ids[1:100]) AS id;
$$;

GRANT EXECUTE ON FUNCTION public.ship_streak(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ship_streaks(uuid[]) TO anon, authenticated;

-- ── Notifications ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_ship_kudos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _author uuid;
  _name text;
BEGIN
  SELECT author_id INTO _author FROM public.ships WHERE id = NEW.ship_id;
  IF _author IS NULL OR _author = NEW.giver_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, handle) INTO _name FROM public.profiles WHERE id = NEW.giver_id;
  PERFORM public.insert_notification(
    _author, NEW.giver_id, 'ship_kudos',
    COALESCE(_name, 'Someone') || ' gave kudos to your ship',
    NULL, 'ship', NEW.ship_id, '{}'::jsonb);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_ship_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _author uuid;
  _name text;
BEGIN
  SELECT author_id INTO _author FROM public.ships WHERE id = NEW.ship_id;
  IF _author IS NULL OR _author = NEW.author_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, handle) INTO _name FROM public.profiles WHERE id = NEW.author_id;
  PERFORM public.insert_notification(
    _author, NEW.author_id, 'ship_reply',
    COALESCE(_name, 'Someone') || ' replied to your ship',
    left(NEW.body, 200), 'ship', NEW.ship_id, '{}'::jsonb);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_ship_kudos() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_ship_reply() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_ship_kudos ON public.ship_kudos;
CREATE TRIGGER notify_ship_kudos
  AFTER INSERT ON public.ship_kudos
  FOR EACH ROW EXECUTE FUNCTION public.notify_ship_kudos();

DROP TRIGGER IF EXISTS notify_ship_reply ON public.ship_replies;
CREATE TRIGGER notify_ship_reply
  AFTER INSERT ON public.ship_replies
  FOR EACH ROW EXECUTE FUNCTION public.notify_ship_reply();

-- Friday nudge: anyone who shipped in the last four weeks but not yet this
-- week. Idempotent per week — a second run adds nothing.
CREATE OR REPLACE FUNCTION public.send_ship_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _week date := public.current_ship_week();
  _n integer;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, entity_type, metadata)
  SELECT r.author_id, 'ship_reminder', 'Ship day — what did you ship this week?',
         CASE WHEN r.streak > 1
              THEN 'Post it to keep your ' || r.streak || '-week streak going.'
              ELSE 'A few lines is enough. Tethyr drafts it from your GitHub.' END,
         'ship_week', jsonb_build_object('week', _week)
    FROM (
      SELECT DISTINCT s.author_id, public.ship_streak(s.author_id) AS streak
        FROM public.ships s
       WHERE s.week_start BETWEEN _week - 28 AND _week - 7
    ) r
   WHERE NOT EXISTS (SELECT 1 FROM public.ships t
                      WHERE t.author_id = r.author_id AND t.week_start = _week)
     AND NOT EXISTS (SELECT 1 FROM public.notifications n
                      WHERE n.user_id = r.author_id AND n.type = 'ship_reminder'
                        AND n.created_at >= _week);
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.send_ship_reminders() FROM PUBLIC, anon, authenticated;

DO $do$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron unavailable — ship reminders not scheduled: %', SQLERRM;
    RETURN;
  END;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ship-reminders';
  PERFORM cron.schedule('ship-reminders', '0 15 * * 5', 'SELECT public.send_ship_reminders()');
END
$do$;

-- ── Launch safety: rate limits and a confirmed email ───────────────────────
CREATE OR REPLACE FUNCTION public.limit_connection_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;  -- server / seed scripts
  IF NOT public.has_confirmed_email(NEW.requester_id) THEN
    RAISE EXCEPTION 'email_unconfirmed: Confirm your email before connecting with people.'
      USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM public.connections
       WHERE requester_id = NEW.requester_id
         AND created_at > now() - interval '1 day') >= 25 THEN
    RAISE EXCEPTION 'rate_limited: You have sent a lot of connection requests today. Try again tomorrow.'
      USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.limit_posts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF (SELECT count(*) FROM public.posts
       WHERE author_id = NEW.author_id
         AND created_at > now() - interval '1 hour') >= 15 THEN
    RAISE EXCEPTION 'rate_limited: You have posted a lot in the last hour. Take a breather and try again soon.'
      USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.limit_ship_replies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.ship_replies
       WHERE author_id = NEW.author_id
         AND created_at > now() - interval '1 hour') >= 40 THEN
    RAISE EXCEPTION 'rate_limited: You have replied a lot in the last hour. Try again soon.'
      USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.limit_connection_requests() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.limit_posts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.limit_ship_replies() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS limit_connection_requests ON public.connections;
CREATE TRIGGER limit_connection_requests
  BEFORE INSERT ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.limit_connection_requests();

DROP TRIGGER IF EXISTS limit_posts ON public.posts;
CREATE TRIGGER limit_posts
  BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.limit_posts();

DROP TRIGGER IF EXISTS limit_ship_replies ON public.ship_replies;
CREATE TRIGGER limit_ship_replies
  BEFORE INSERT ON public.ship_replies
  FOR EACH ROW EXECUTE FUNCTION public.limit_ship_replies();

-- ── Launch metrics (service role only) ─────────────────────────────────────
-- The numbers that say whether people stay. "Active" in a week = posted a
-- ship, post, reply or message that week.
--   select public.launch_metrics();
CREATE OR REPLACE FUNCTION public.launch_metrics()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH activity AS (
    SELECT author_id AS uid, created_at FROM public.ships
    UNION ALL SELECT author_id, created_at FROM public.posts
    UNION ALL SELECT author_id, created_at FROM public.ship_replies
    UNION ALL SELECT author_id, created_at FROM public.comments
    UNION ALL SELECT sender_id, created_at FROM public.messages
  ),
  cohort AS (  -- signed up 14–42 days ago: old enough to measure week 2
    SELECT id, created_at FROM public.profiles
     WHERE created_at BETWEEN now() - interval '42 days' AND now() - interval '14 days'
  )
  SELECT jsonb_build_object(
    'members', (SELECT count(*) FROM public.profiles),
    'signups_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'signups_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days'),
    'profiles_complete', (SELECT count(*) FROM public.profiles
                           WHERE handle IS NOT NULL AND avatar_url IS NOT NULL
                             AND COALESCE(btrim(bio), '') <> ''),
    'github_connected', (SELECT count(*) FROM public.profile_github),
    'with_a_project', (SELECT count(DISTINCT profile_id) FROM public.projects),
    'active_7d', (SELECT count(DISTINCT uid) FROM activity WHERE created_at > now() - interval '7 days'),
    'active_30d', (SELECT count(DISTINCT uid) FROM activity WHERE created_at > now() - interval '30 days'),
    'shipped_this_week', (SELECT count(*) FROM public.ships WHERE week_start = public.current_ship_week()),
    'week2_cohort', (SELECT count(*) FROM cohort),
    'week2_retained', (SELECT count(*) FROM cohort c WHERE EXISTS (
                         SELECT 1 FROM activity a
                          WHERE a.uid = c.id
                            AND a.created_at BETWEEN c.created_at + interval '7 days'
                                                 AND c.created_at + interval '14 days'))
  );
$$;

REVOKE ALL ON FUNCTION public.launch_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.launch_metrics() TO service_role;
