-- ============================================================================
-- Space identity columns (pgTAP)
-- ============================================================================
-- Run with: supabase test db
--
-- Pins 20261013120000_space_identity.sql: owners can personalise their space,
-- every field is bounded in the database, and links can't carry a script URL.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(11);

INSERT INTO auth.users (id, email)
VALUES ('5e5e0000-0000-0000-0000-000000000001', 'space-identity-owner@test.local');

INSERT INTO public.community_spaces (id, name, slug, created_by, visibility)
VALUES ('5e5e0000-0000-0000-0000-0000000000aa', 'Identity Test', 'identity-test',
        '5e5e0000-0000-0000-0000-000000000001', 'public');

SELECT set_config('request.jwt.claims',
  '{"sub":"5e5e0000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$UPDATE public.community_spaces
      SET tagline = 'A room for makers',
          about = 'Long form about text.',
          accent_color = '#7c3aed',
          topics = '{Branding,UI}',
          links = '[{"label":"Site","url":"https://example.com"}]',
          welcome_message = 'Say hi in the intro thread.',
          avatar_url = '5e5e0000-0000-0000-0000-000000000001/spaces/x/avatar.webp',
          banner_url = '5e5e0000-0000-0000-0000-000000000001/spaces/x/banner.webp'
    WHERE id = '5e5e0000-0000-0000-0000-0000000000aa'$$,
  'the owner can personalise their space'
);

SELECT is(
  (SELECT topics FROM public.community_spaces WHERE id = '5e5e0000-0000-0000-0000-0000000000aa'),
  '{Branding,UI}'::text[],
  'topics are stored'
);

SELECT throws_ok(
  $$UPDATE public.community_spaces SET links = '[{"label":"x","url":"javascript:alert(1)"}]'
    WHERE id = '5e5e0000-0000-0000-0000-0000000000aa'$$,
  '23514', NULL, 'script URLs are rejected'
);

SELECT throws_ok(
  $$UPDATE public.community_spaces
      SET links = '[{"label":"1","url":"https://a.co"},{"label":"2","url":"https://a.co"},{"label":"3","url":"https://a.co"},{"label":"4","url":"https://a.co"},{"label":"5","url":"https://a.co"},{"label":"6","url":"https://a.co"}]'
    WHERE id = '5e5e0000-0000-0000-0000-0000000000aa'$$,
  '23514', NULL, 'at most five links'
);

SELECT throws_ok(
  $$UPDATE public.community_spaces SET links = '{"label":"x"}'
    WHERE id = '5e5e0000-0000-0000-0000-0000000000aa'$$,
  '23514', NULL, 'links must be an array'
);

SELECT throws_ok(
  $$UPDATE public.community_spaces SET topics = '{a,b,c,d,e,f,g,h,i}'
    WHERE id = '5e5e0000-0000-0000-0000-0000000000aa'$$,
  '23514', NULL, 'at most eight topics'
);

SELECT throws_ok(
  $$UPDATE public.community_spaces SET topics = '{"   "}'
    WHERE id = '5e5e0000-0000-0000-0000-0000000000aa'$$,
  '23514', NULL, 'blank topics are rejected'
);

SELECT throws_ok(
  $$UPDATE public.community_spaces SET accent_color = 'red'
    WHERE id = '5e5e0000-0000-0000-0000-0000000000aa'$$,
  '23514', NULL, 'accent must be #rrggbb'
);

SELECT throws_ok(
  $$UPDATE public.community_spaces SET tagline = repeat('x', 81)
    WHERE id = '5e5e0000-0000-0000-0000-0000000000aa'$$,
  '23514', NULL, 'tagline is capped at 80 characters'
);

RESET ROLE;

SELECT is(
  has_function_privilege('anon', 'public.space_links_valid(jsonb)', 'EXECUTE'),
  false,
  'anon cannot call the link validator'
);

SELECT is(
  has_function_privilege('authenticated', 'public.space_links_valid(jsonb)', 'EXECUTE'),
  true,
  'owners can run the CHECK validator'
);

SELECT * FROM finish();
ROLLBACK;
