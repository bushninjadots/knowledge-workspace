-- ============================================================================
-- Community help: solutions, thanks, profile summary (pgTAP)
-- ============================================================================
-- Run with: supabase test db
--
-- Pins 20261014100000_community_help.sql: only the asker picks a solution,
-- repliers can't crown themselves, thanks go to the reply's author once with a
-- reason, private spaces never count toward (or leak into) a public profile.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(17);

-- asker, helper, bystander
INSERT INTO auth.users (id, email) VALUES
  ('4e1b0001-0000-0000-0000-000000000000', 'asker4e1b@test.local'),
  ('4e1b0002-0000-0000-0000-000000000000', 'helper4e1b@test.local'),
  ('4e1b0003-0000-0000-0000-000000000000', 'bystander4e1b@test.local');

INSERT INTO public.community_spaces (id, name, slug, created_by, visibility) VALUES
  ('4e1b0000-0000-0000-0000-0000000000a1', 'Secret room', 'help-secret-room',
   '4e1b0001-0000-0000-0000-000000000000', 'private');

INSERT INTO public.posts (id, author_id, type, title, body, skills, space_id) VALUES
  ('4e1b0000-0000-0000-0000-0000000000b1', '4e1b0001-0000-0000-0000-000000000000',
   'question', 'How do I center a div?', 'Asking for a friend', '{css}', NULL),
  ('4e1b0000-0000-0000-0000-0000000000b2', '4e1b0001-0000-0000-0000-000000000000',
   'showcase', 'Look what I made', 'A thing', '{}', NULL),
  ('4e1b0000-0000-0000-0000-0000000000b3', '4e1b0001-0000-0000-0000-000000000000',
   'help_request', 'Private ask', 'Secret', '{rust}',
   '4e1b0000-0000-0000-0000-0000000000a1');

INSERT INTO public.comments (id, post_id, author_id, body) VALUES
  ('4e1b0000-0000-0000-0000-0000000000c1', '4e1b0000-0000-0000-0000-0000000000b1',
   '4e1b0002-0000-0000-0000-000000000000', 'Use flexbox'),
  ('4e1b0000-0000-0000-0000-0000000000c2', '4e1b0000-0000-0000-0000-0000000000b2',
   '4e1b0002-0000-0000-0000-000000000000', 'Nice'),
  ('4e1b0000-0000-0000-0000-0000000000c3', '4e1b0000-0000-0000-0000-0000000000b3',
   '4e1b0002-0000-0000-0000-000000000000', 'Private answer'),
  ('4e1b0000-0000-0000-0000-0000000000c4', '4e1b0000-0000-0000-0000-0000000000b1',
   '4e1b0001-0000-0000-0000-000000000000', 'Thanks, trying it');
UPDATE public.comments SET is_best_answer = true WHERE id = '4e1b0000-0000-0000-0000-0000000000c3';

-- ── As the helper ──────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"4e1b0002-0000-0000-0000-000000000000","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$UPDATE public.comments SET is_best_answer = true WHERE id = '4e1b0000-0000-0000-0000-0000000000c1'$$,
  '42501', NULL, 'a replier cannot mark their own reply as the answer directly'
);
SELECT throws_ok(
  $$SELECT public.mark_solution('4e1b0000-0000-0000-0000-0000000000c1')$$,
  '42501', NULL, 'only the asker can pick the solution'
);
SELECT lives_ok(
  $$UPDATE public.comments SET body = 'Use flexbox or grid' WHERE id = '4e1b0000-0000-0000-0000-0000000000c1'$$,
  'repliers can still edit their reply text'
);
SELECT throws_ok(
  $$SELECT public.thank_reply('4e1b0000-0000-0000-0000-0000000000c1', 'I helped myself')$$,
  '22023', NULL, 'nobody can thank themselves'
);
SELECT throws_ok(
  $$INSERT INTO public.community_kudos (giver_id, recipient_id, post_id, comment_id, reason)
    VALUES ('4e1b0002-0000-0000-0000-000000000000', '4e1b0001-0000-0000-0000-000000000000',
            '4e1b0000-0000-0000-0000-0000000000b1', '4e1b0000-0000-0000-0000-0000000000c4', 'forged')$$,
  '42501', NULL, 'thanks cannot be inserted directly'
);

-- ── As the asker ───────────────────────────────────────────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"4e1b0001-0000-0000-0000-000000000000","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$SELECT public.mark_solution('4e1b0000-0000-0000-0000-0000000000c2')$$,
  '22023', NULL, 'a showcase has no solution'
);
SELECT throws_ok(
  $$SELECT public.mark_solution('4e1b0000-0000-0000-0000-0000000000c4')$$,
  '22023', NULL, 'the asker cannot pick their own reply'
);
SELECT lives_ok(
  $$SELECT public.mark_solution('4e1b0000-0000-0000-0000-0000000000c1')$$,
  'the asker marks a reply as the solution'
);
SELECT is(
  (SELECT is_best_answer FROM public.comments WHERE id = '4e1b0000-0000-0000-0000-0000000000c1'),
  true, 'the reply is now the solution'
);
SELECT throws_ok(
  $$SELECT public.thank_reply('4e1b0000-0000-0000-0000-0000000000c1', 'no')$$,
  '22023', NULL, 'a reason is required'
);
SELECT lives_ok(
  $$SELECT public.thank_reply('4e1b0000-0000-0000-0000-0000000000c1', 'Fixed my layout in one line')$$,
  'the asker thanks the helper with a reason'
);
SELECT lives_ok(
  $$SELECT public.thank_reply('4e1b0000-0000-0000-0000-0000000000c1', 'Fixed my whole layout')$$,
  'thanking again updates the reason'
);
SELECT is(
  (SELECT count(*)::int FROM public.community_kudos WHERE comment_id = '4e1b0000-0000-0000-0000-0000000000c1'),
  1, 'one thanks per person per reply'
);
SELECT lives_ok(
  $$SELECT public.thank_reply('4e1b0000-0000-0000-0000-0000000000c3', 'Saved my private build')$$,
  'thanks inside a private space are allowed for members'
);

-- ── The public summary, as an outsider ─────────────────────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"4e1b0003-0000-0000-0000-000000000000","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT is(
  public.community_help_summary('4e1b0002-0000-0000-0000-000000000000')
    - 'skills' - 'recent',
  '{"solutions":1,"thanks":1,"people_helped":1}'::jsonb,
  'the summary counts public help only'
);
SELECT is(
  (public.community_help_summary('4e1b0002-0000-0000-0000-000000000000') -> 'recent' -> 0 ->> 'reason'),
  'Fixed my whole layout', 'recent thanks carry the reason'
);
SELECT is(
  (SELECT count(*)::int FROM public.comments WHERE post_id = '4e1b0000-0000-0000-0000-0000000000b3'),
  0, 'replies in a private space are hidden from outsiders'
);

SELECT * FROM finish();
ROLLBACK;
