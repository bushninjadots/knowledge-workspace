-- Stage 17b — Remote-safe backfill: creates pages for all projects and profiles
-- that don't have one yet. Uses profiles table for layout creator attribution.
-- Safe to re-run (only creates pages for owners without one).

-- 1. Backfill project pages.
DO $$
DECLARE
  rec          RECORD;
  layout_id    uuid;
  page_id      uuid;
BEGIN
  FOR rec IN
    SELECT p.id AS project_id, p.profile_id, p.title, p.description, p.readme
    FROM public.projects p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pages pg
      WHERE pg.owner_id = p.id AND pg.owner_type = 'project'
    )
  LOOP
    -- Create layout with default project sections, seeded with README/description.
    INSERT INTO public.layouts (name, type, sections, is_template, created_by)
    VALUES (
      'Project Layout',
      'standard',
      jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid(), 'position', 0, 'layout', 'full',
          'blocks', jsonb_build_array(
            jsonb_build_object('id', gen_random_uuid(), 'type', 'project-hero', 'position', 0,
              'config', jsonb_build_object('showDescription', true, 'showProgress', true, 'showTags', true), 'visible', true)
          )
        ),
        jsonb_build_object(
          'id', gen_random_uuid(), 'position', 1, 'layout', 'full',
          'blocks', jsonb_build_array(
            jsonb_build_object('id', gen_random_uuid(), 'type', 'divider', 'position', 0, 'config', '{}'::jsonb, 'visible', true),
            jsonb_build_object('id', gen_random_uuid(), 'type', 'project-about', 'position', 1,
              'config', jsonb_build_object('content', coalesce(rec.readme, rec.description, '')), 'visible', true)
          )
        ),
        jsonb_build_object(
          'id', gen_random_uuid(), 'position', 2, 'layout', 'two_column',
          'blocks', jsonb_build_array(
            jsonb_build_object('id', gen_random_uuid(), 'type', 'project-status', 'position', 0, 'config', '{}'::jsonb, 'visible', true),
            jsonb_build_object('id', gen_random_uuid(), 'type', 'project-team', 'position', 1, 'config', '{}'::jsonb, 'visible', true)
          )
        ),
        jsonb_build_object(
          'id', gen_random_uuid(), 'position', 3, 'layout', 'full',
          'blocks', jsonb_build_array(
            jsonb_build_object('id', gen_random_uuid(), 'type', 'project-activity', 'position', 0, 'config', '{}'::jsonb, 'visible', true)
          )
        )
      ),
      false,
      rec.profile_id
    )
    RETURNING id INTO layout_id;

    -- Create page referencing the layout.
    INSERT INTO public.pages (owner_id, owner_type, layout_id, theme_id, status, published_at)
    VALUES (rec.project_id, 'project', layout_id, '00000000-0000-0000-0000-000000000001', 'published', now())
    RETURNING id INTO page_id;

  END LOOP;

  RAISE NOTICE 'Backfilled % project page(s)', (SELECT count(*) FROM public.pages WHERE owner_type = 'project');
END $$;

-- 2. Backfill profile pages.
DO $$
DECLARE
  rec          RECORD;
  layout_id    uuid;
  page_id      uuid;
BEGIN
  FOR rec IN
    SELECT pr.id AS profile_id, pr.bio, pr.learning_goals
    FROM public.profiles pr
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pages pg
      WHERE pg.owner_id = pr.id AND pg.owner_type = 'profile'
    )
  LOOP
    -- Create layout with default profile sections, seeded with bio/goals.
    INSERT INTO public.layouts (name, type, sections, is_template, created_by)
    VALUES (
      'Profile Layout',
      'standard',
      jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid(), 'position', 0, 'layout', 'full',
          'blocks', jsonb_build_array(
            jsonb_build_object('id', gen_random_uuid(), 'type', 'profile-header', 'position', 0, 'config', '{}'::jsonb, 'visible', true)
          )
        ),
        jsonb_build_object(
          'id', gen_random_uuid(), 'position', 1, 'layout', 'full',
          'blocks', jsonb_build_array(
            jsonb_build_object('id', gen_random_uuid(), 'type', 'profile-bio', 'position', 0,
              'config', jsonb_build_object('content', coalesce(rec.bio, ''), 'goals', coalesce(rec.learning_goals, '')), 'visible', true)
          )
        ),
        jsonb_build_object(
          'id', gen_random_uuid(), 'position', 2, 'layout', 'two_column',
          'blocks', jsonb_build_array(
            jsonb_build_object('id', gen_random_uuid(), 'type', 'profile-skills', 'position', 0, 'config', '{}'::jsonb, 'visible', true),
            jsonb_build_object('id', gen_random_uuid(), 'type', 'profile-projects', 'position', 1, 'config', '{}'::jsonb, 'visible', true)
          )
        )
      ),
      false,
      rec.profile_id
    )
    RETURNING id INTO layout_id;

    INSERT INTO public.pages (owner_id, owner_type, layout_id, theme_id, status, published_at)
    VALUES (rec.profile_id, 'profile', layout_id, '00000000-0000-0000-0000-000000000001', 'published', now())
    RETURNING id INTO page_id;

  END LOOP;

  RAISE NOTICE 'Backfilled % profile page(s)', (SELECT count(*) FROM public.pages WHERE owner_type = 'profile');
END $$;