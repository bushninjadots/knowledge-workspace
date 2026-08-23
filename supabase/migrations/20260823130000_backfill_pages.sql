-- Stage 17 — Migration: backfill pages for all existing projects and profiles.
-- Creates pages with default layouts for any owner that doesn't have one yet,
-- so blocks render immediately for all visitors (not just the owner).
-- Each layout is owned by the project owner or profile user.
--
-- To revert: DELETE FROM pages WHERE id IN (SELECT page_id FROM migrated_pages);
--            DROP TABLE migrated_pages;

-- Track what we create so we can report or rollback.
CREATE TABLE IF NOT EXISTS public.migrated_pages (
  page_id         uuid PRIMARY KEY REFERENCES public.pages(id) ON DELETE CASCADE,
  owner_id        uuid NOT NULL,
  owner_type      text NOT NULL CHECK (owner_type IN ('profile', 'project')),
  migrated_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.migrated_pages TO service_role;

-- =============================================================================
-- 1. Backfill PROJECT pages
-- =============================================================================
DO $$
DECLARE
  rec          RECORD;
  layout_id    uuid;
  page_id      uuid;
  user_id      uuid;
  blk_counter  integer;
BEGIN
  FOR rec IN
    SELECT p.id AS project_id, p.profile_id, p.title, p.description, p.readme
    FROM public.projects p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pages pg
      WHERE pg.owner_id = p.id AND pg.owner_type = 'project'
    )
  LOOP
    user_id := NULL;
    BEGIN
      SELECT id INTO user_id FROM auth.users WHERE id = rec.profile_id;
    EXCEPTION WHEN undefined_table THEN
      -- auth schema may not exist in local dev; skip user lookup.
      user_id := NULL;
    END;

    blk_counter := 0;

    -- Create a layout with the default project sections, populated with
    -- existing README/description data in the about block.
    INSERT INTO public.layouts (name, type, sections, is_template, created_by)
    VALUES (
      'Project Layout',
      'standard',
      jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid(),
          'position', 0,
          'layout', 'full',
          'blocks', jsonb_build_array(
            jsonb_build_object(
              'id', gen_random_uuid(),
              'type', 'project-hero',
              'position', 0,
              'config', jsonb_build_object(
                'showDescription', true,
                'showProgress', true,
                'showTags', true
              ),
              'visible', true
            )
          )
        ),
        jsonb_build_object(
          'id', gen_random_uuid(),
          'position', 1,
          'layout', 'full',
          'blocks', jsonb_build_array(
            jsonb_build_object(
              'id', gen_random_uuid(),
              'type', 'divider',
              'position', 0,
              'config', '{}'::jsonb,
              'visible', true
            ),
            jsonb_build_object(
              'id', gen_random_uuid(),
              'type', 'project-about',
              'position', 1,
              'config', jsonb_build_object(
                'content', coalesce(rec.readme, rec.description, '')
              ),
              'visible', true
            )
          )
        ),
        jsonb_build_object(
          'id', gen_random_uuid(),
          'position', 2,
          'layout', 'two_column',
          'blocks', jsonb_build_array(
            jsonb_build_object(
              'id', gen_random_uuid(),
              'type', 'project-status',
              'position', 0,
              'config', '{}'::jsonb,
              'visible', true
            ),
            jsonb_build_object(
              'id', gen_random_uuid(),
              'type', 'project-team',
              'position', 1,
              'config', '{}'::jsonb,
              'visible', true
            )
          )
        ),
        jsonb_build_object(
          'id', gen_random_uuid(),
          'position', 3,
          'layout', 'full',
          'blocks', jsonb_build_array(
            jsonb_build_object(
              'id', gen_random_uuid(),
              'type', 'project-activity',
              'position', 0,
              'config', '{}'::jsonb,
              'visible', true
            )
          )
        )
      ),
      false,
      user_id
    )
    RETURNING id INTO layout_id;

    -- Create the page.
    INSERT INTO public.pages (owner_id, owner_type, layout_id, theme_id, status, published_at)
    VALUES (
      rec.project_id,
      'project',
      layout_id,
      '00000000-0000-0000-0000-000000000001',  -- Tethyr Default theme
      'published',
      now()
    )
    RETURNING id INTO page_id;

    -- Track for reporting.
    INSERT INTO public.migrated_pages (page_id, owner_id, owner_type)
    VALUES (page_id, rec.project_id, 'project');

  END LOOP;

  RAISE NOTICE 'Migrated % project(s)', (SELECT count(*) FROM public.migrated_pages WHERE owner_type = 'project');
END $$;

-- =============================================================================
-- 2. Backfill PROFILE pages
-- =============================================================================
DO $$
DECLARE
  rec          RECORD;
  layout_id    uuid;
  page_id      uuid;
  user_id      uuid;
BEGIN
  FOR rec IN
    SELECT pr.id AS profile_id, pr.bio, pr.learning_goals
    FROM public.profiles pr
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pages pg
      WHERE pg.owner_id = pr.id AND pg.owner_type = 'profile'
    )
  LOOP
    user_id := NULL;
    BEGIN
      SELECT id INTO user_id FROM auth.users WHERE id = rec.profile_id;
    EXCEPTION WHEN undefined_table THEN
      user_id := NULL;
    END;

    -- Create a layout with the default profile sections, populated with
    -- existing bio data in the bio block.
    INSERT INTO public.layouts (name, type, sections, is_template, created_by)
    VALUES (
      'Profile Layout',
      'standard',
      jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid(),
          'position', 0,
          'layout', 'full',
          'blocks', jsonb_build_array(
            jsonb_build_object(
              'id', gen_random_uuid(),
              'type', 'profile-header',
              'position', 0,
              'config', '{}'::jsonb,
              'visible', true
            )
          )
        ),
        jsonb_build_object(
          'id', gen_random_uuid(),
          'position', 1,
          'layout', 'full',
          'blocks', jsonb_build_array(
            jsonb_build_object(
              'id', gen_random_uuid(),
              'type', 'profile-bio',
              'position', 0,
              'config', jsonb_build_object(
                'content', coalesce(rec.bio, ''),
                'goals', coalesce(rec.learning_goals, '')
              ),
              'visible', true
            )
          )
        ),
        jsonb_build_object(
          'id', gen_random_uuid(),
          'position', 2,
          'layout', 'two_column',
          'blocks', jsonb_build_array(
            jsonb_build_object(
              'id', gen_random_uuid(),
              'type', 'profile-skills',
              'position', 0,
              'config', '{}'::jsonb,
              'visible', true
            ),
            jsonb_build_object(
              'id', gen_random_uuid(),
              'type', 'profile-projects',
              'position', 1,
              'config', '{}'::jsonb,
              'visible', true
            )
          )
        )
      ),
      false,
      user_id
    )
    RETURNING id INTO layout_id;

    -- Create the page.
    INSERT INTO public.pages (owner_id, owner_type, layout_id, theme_id, status, published_at)
    VALUES (
      rec.profile_id,
      'profile',
      layout_id,
      '00000000-0000-0000-0000-000000000001',
      'published',
      now()
    )
    RETURNING id INTO page_id;

    INSERT INTO public.migrated_pages (page_id, owner_id, owner_type)
    VALUES (page_id, rec.profile_id, 'profile');

  END LOOP;

  RAISE NOTICE 'Migrated % profile(s)', (SELECT count(*) FROM public.migrated_pages WHERE owner_type = 'profile');
END $$;