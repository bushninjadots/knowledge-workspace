-- ============================================================================
-- Phase 4: curated cold-start content
--
-- An empty network shouldn't feel abandoned. This migration:
--
--   1. Adds `is_starter` to challenges so curated content can be labeled
--      honestly instead of pretending a community member created it.
--   2. Creates the "Tethyr Team" curator account — starter challenges need a
--      real creator who can review submissions (review requires
--      auth.uid() = created_by), otherwise the loop dead-ends.
--   3. Seeds five curated starter challenges: real, useful, low-scope, with
--      pass criteria the curator can actually grade.
--   4. Guards the label: only the curator can mark a challenge as a starter.
--
-- Safe to re-run: all statements are idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. is_starter column
-- ---------------------------------------------------------------------------
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS is_starter boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 2. Tethyr Team curator account
-- ---------------------------------------------------------------------------
-- The curator is a real staff account so starter submissions can be reviewed
-- and pass-gated reputation stays real. The password is randomized here (no
-- known credential ships to production); the local demo seed resets it to
-- password123 so dev/test can log in as the curator.
DO $$
DECLARE
  _curator uuid := 'a1d676d3-1a76-401f-bc30-0e4195569e27';
  _pw text := crypt(gen_random_uuid()::text, gen_salt('bf', 10));
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at,
    confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at,
    email_change_token_new, email_change, email_change_sent_at,
    email_change_token_current, email_change_confirm_status,
    phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_anonymous, is_sso_user,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    _curator,
    'authenticated', 'authenticated',
    'curators@tethyr.app',
    _pw,
    now(), NULL,
    '', NULL,
    '', NULL,
    '', '', NULL,
    '', 0,
    NULL, NULL, '', '', NULL,
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"display_name": "Tethyr Team", "handle": "tethyr", "craft": "Community"}',
    false, false, false,
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    _curator, _curator, 'curators@tethyr.app',
    jsonb_build_object('sub', _curator::text, 'email', 'curators@tethyr.app',
                       'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, display_name, handle, category)
  VALUES (_curator, 'Tethyr Team', 'tethyr', 'Community')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Curated starter challenges
-- ---------------------------------------------------------------------------
-- Real, useful, low-scope; each has pass criteria the curator can grade so a
-- first contribution can actually earn evidence (badge + reputation).
INSERT INTO public.challenges (
  id, title, description, type, skills, difficulty, status, created_by,
  start_date, end_date, max_participants, pass_criteria, is_starter
)
VALUES
  (
    '4a000000-0000-0000-0000-000000000001',
    'Ship a one-page personal site',
    'Design and publish a single-page site that introduces you and one thing you are building. No framework required — plain HTML/CSS is perfect.',
    'skill', ARRAY['html-css', 'ui-design'], 'beginner', 'active',
    'a1d676d3-1a76-401f-bc30-0e4195569e27',
    now() - interval '1 day', now() + interval '90 days', 100,
    'A live URL with your name, one project, and a way to contact you.',
    true
  ),
  (
    '4a000000-0000-0000-0000-000000000002',
    'Write your first technical tutorial',
    'Teach something you just learned. Pick one small topic and write a short, honest tutorial — code or screenshots welcome.',
    'learning', ARRAY['technical-writing'], 'beginner', 'active',
    'a1d676d3-1a76-401f-bc30-0e4195569e27',
    now() - interval '1 day', now() + interval '90 days', 100,
    'A published post (blog, Notion, or Tethyr post) with at least one example.',
    true
  ),
  (
    '4a000000-0000-0000-0000-000000000003',
    'Fix one accessibility issue',
    'Pick any project — yours or an open-source one — and fix one real accessibility issue: alt text, contrast, focus states, or a form label.',
    'project', ARRAY['ui-design', 'software-testing'], 'beginner', 'active',
    'a1d676d3-1a76-401f-bc30-0e4195569e27',
    now() - interval '1 day', now() + interval '90 days', 100,
    'A link to the change (merged PR or commit) with a one-line description of the issue fixed.',
    true
  ),
  (
    '4a000000-0000-0000-0000-000000000004',
    'Build a tiny CLI tool',
    'Build a small command-line tool that does one useful thing — a file renamer, a todo list, a status checker. Any language.',
    'project', ARRAY['nodejs'], 'beginner', 'active',
    'a1d676d3-1a76-401f-bc30-0e4195569e27',
    now() - interval '1 day', now() + interval '90 days', 100,
    'A public repo with a README that shows the command and a sample output.',
    true
  ),
  (
    '4a000000-0000-0000-0000-000000000005',
    'Record a two-minute project update',
    'Record a short video or voice note about what you are building right now — what problem, what you did this week, what is next.',
    'learning', ARRAY['growth-marketing'], 'beginner', 'active',
    'a1d676d3-1a76-401f-bc30-0e4195569e27',
    now() - interval '1 day', now() + interval '90 days', 100,
    'A public link to the recording (Loom, YouTube, or similar).',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Only the Tethyr team can label challenges as starters
-- ---------------------------------------------------------------------------
-- Real users (non-null uid) who aren't the curator can't spoof the curated
-- label. NULL uid (migration/service context) is allowed so seeding works.
CREATE OR REPLACE FUNCTION public.enforce_curated_starter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_starter
     AND auth.uid() IS NOT NULL
     AND auth.uid() IS DISTINCT FROM 'a1d676d3-1a76-401f-bc30-0e4195569e27'::uuid THEN
    RAISE EXCEPTION 'Only the Tethyr team can create starter challenges';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_curated_starter ON public.challenges;
CREATE TRIGGER enforce_curated_starter
  BEFORE INSERT OR UPDATE OF is_starter ON public.challenges
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_curated_starter();

REVOKE ALL ON FUNCTION public.enforce_curated_starter() FROM PUBLIC, anon, authenticated;
