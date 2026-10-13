-- ============================================================================
-- Linked spaces: teams, challenges and projects get their own space (pgTAP)
-- ============================================================================
-- Run with: supabase test db
--
-- Pins 20261014110000_linked_spaces.sql: only the person who runs a thing can
-- start its space, everyone in it joins, joining/leaving later keeps the space
-- in step, and an owner can't attach their own space to someone else's team.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(14);

INSERT INTO auth.users (id, email) VALUES
  ('15ed0001-0000-0000-0000-000000000000', 'lead15ed@test.local'),
  ('15ed0002-0000-0000-0000-000000000000', 'core15ed@test.local'),
  ('15ed0003-0000-0000-0000-000000000000', 'late15ed@test.local');

INSERT INTO public.teams (id, name, slug, created_by) VALUES
  ('15ed0000-0000-0000-0000-0000000000a1', 'Linked Team', 'linked-team-15ed',
   '15ed0001-0000-0000-0000-000000000000');
-- (Creating a team makes its creator the lead.)
INSERT INTO public.team_members (team_id, profile_id, role) VALUES
  ('15ed0000-0000-0000-0000-0000000000a1', '15ed0002-0000-0000-0000-000000000000', 'core');

INSERT INTO public.projects (id, profile_id, title, visibility) VALUES
  ('15ed0000-0000-0000-0000-0000000000b1', '15ed0002-0000-0000-0000-000000000000',
   'Linked Project', 'public');

INSERT INTO public.community_spaces (id, name, slug, created_by, visibility) VALUES
  ('15ed0000-0000-0000-0000-0000000000c1', 'My own room', 'my-own-room-15ed',
   '15ed0002-0000-0000-0000-000000000000', 'public');

-- ── As a core member (not the lead) ────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"15ed0002-0000-0000-0000-000000000000","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$SELECT public.open_linked_space('team', '15ed0000-0000-0000-0000-0000000000a1')$$,
  '42501', NULL, 'only the team lead can start the team space'
);
SELECT throws_ok(
  $$UPDATE public.community_spaces SET team_id = '15ed0000-0000-0000-0000-0000000000a1'
     WHERE id = '15ed0000-0000-0000-0000-0000000000c1'$$,
  '42501', NULL, 'an owner cannot link their own space to a team directly'
);
SELECT lives_ok(
  $$UPDATE public.community_spaces SET tagline = 'Still editable'
     WHERE id = '15ed0000-0000-0000-0000-0000000000c1'$$,
  'owners can still edit their space'
);
SELECT is(
  public.open_linked_space('project', '15ed0000-0000-0000-0000-0000000000b1') ->> 'created',
  'true', 'the project owner starts the project space'
);
SELECT is(
  (SELECT visibility FROM public.community_spaces WHERE project_id = '15ed0000-0000-0000-0000-0000000000b1'),
  'public', 'a public project gets a public space'
);

-- ── As the team lead ───────────────────────────────────────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"15ed0001-0000-0000-0000-000000000000","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT is(
  public.open_linked_space('team', '15ed0000-0000-0000-0000-0000000000a1') ->> 'created',
  'true', 'the lead starts the team space'
);
SELECT is(
  public.open_linked_space('team', '15ed0000-0000-0000-0000-0000000000a1') ->> 'created',
  'false', 'opening it again returns the same space'
);
SELECT is(
  (SELECT visibility || '/' || join_type FROM public.community_spaces
    WHERE team_id = '15ed0000-0000-0000-0000-0000000000a1'),
  'private/review', 'a team space is a private room'
);
SELECT is(
  (SELECT string_agg(m.role::text, ',' ORDER BY m.role)
     FROM public.community_space_members m
     JOIN public.community_spaces s ON s.id = m.space_id
    WHERE s.team_id = '15ed0000-0000-0000-0000-0000000000a1'),
  'owner,member', 'the lead owns it and the existing member joined'
);
SELECT throws_ok(
  $$SELECT public.open_linked_space('planet', '15ed0000-0000-0000-0000-0000000000a1')$$,
  '22023', NULL, 'unknown kinds are rejected'
);

-- ── Membership follows the team ────────────────────────────────────────────
RESET ROLE;
INSERT INTO public.team_members (team_id, profile_id, role) VALUES
  ('15ed0000-0000-0000-0000-0000000000a1', '15ed0003-0000-0000-0000-000000000000', 'contributor');
SELECT ok(
  EXISTS (SELECT 1 FROM public.community_space_members m
            JOIN public.community_spaces s ON s.id = m.space_id
           WHERE s.team_id = '15ed0000-0000-0000-0000-0000000000a1'
             AND m.user_id = '15ed0003-0000-0000-0000-000000000000'),
  'joining the team adds you to its space'
);
DELETE FROM public.team_members
 WHERE team_id = '15ed0000-0000-0000-0000-0000000000a1'
   AND profile_id = '15ed0003-0000-0000-0000-000000000000';
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.community_space_members m
                JOIN public.community_spaces s ON s.id = m.space_id
               WHERE s.team_id = '15ed0000-0000-0000-0000-0000000000a1'
                 AND m.user_id = '15ed0003-0000-0000-0000-000000000000'),
  'leaving the team removes you from its space'
);
INSERT INTO public.project_contributors (project_id, profile_id) VALUES
  ('15ed0000-0000-0000-0000-0000000000b1', '15ed0003-0000-0000-0000-000000000000');
SELECT ok(
  EXISTS (SELECT 1 FROM public.community_space_members m
            JOIN public.community_spaces s ON s.id = m.space_id
           WHERE s.project_id = '15ed0000-0000-0000-0000-0000000000b1'
             AND m.user_id = '15ed0003-0000-0000-0000-000000000000'),
  'joining the project adds you to its space'
);
DELETE FROM public.projects WHERE id = '15ed0000-0000-0000-0000-0000000000b1';
SELECT ok(
  EXISTS (SELECT 1 FROM public.community_spaces WHERE name = 'Linked Project' AND project_id IS NULL),
  'deleting the project keeps its space, unlinked'
);

SELECT * FROM finish();
ROLLBACK;
