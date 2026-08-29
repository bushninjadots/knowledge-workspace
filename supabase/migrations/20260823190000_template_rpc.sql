-- Re-seed RPC — callable from the Creativity Studio sidebar to regenerate
-- default templates if they were accidentally deleted, or after database reset
-- without re-running migrations.

CREATE OR REPLACE FUNCTION public.reseed_default_templates()
RETURNS integer AS $$
DECLARE
  cnt integer := 0;
BEGIN
  -- Re-run the same DO block from the consolidation migration, but as a function
  -- callable via supabase.rpc('reseed_default_templates').

  IF NOT EXISTS (SELECT 1 FROM public.layouts WHERE name = 'Terminal Developer' AND is_template = true) THEN
    INSERT INTO public.layouts (name, description, type, category, sections, theme_id, is_template, created_by, usage_count, fork_count)
    VALUES ('Terminal Developer', 'Dark terminal aesthetic with green accents. Hero, about, status, milestones, repos, activity.', 'standard', 'Developer',
      '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":true,"showTags":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"divider","position":0,"config":{},"visible":true},{"id":"b3","type":"project-about","position":1,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"two_column","blocks":[{"id":"b4","type":"project-status","position":0,"config":{},"visible":true},{"id":"b5","type":"project-milestones","position":1,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"full","blocks":[{"id":"b6","type":"project-repos","position":0,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"two_column","blocks":[{"id":"b7","type":"project-team","position":0,"config":{},"visible":true},{"id":"b8","type":"project-activity","position":1,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b9","type":"project-timeline","position":0,"config":{},"visible":true}]}]'::jsonb,
      '00000000-0000-0000-0000-000000000012', true, null, 0, 0);
    cnt := cnt + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.layouts WHERE name = 'Minimal Developer' AND is_template = true) THEN
    INSERT INTO public.layouts (name, description, type, category, sections, theme_id, is_template, created_by, usage_count, fork_count)
    VALUES ('Minimal Developer', 'Clean developer layout. Hero, about, status+files, team+activity.', 'standard', 'Developer',
      '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":true,"showTags":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"divider","position":0,"config":{},"visible":true},{"id":"b3","type":"project-about","position":1,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"two_column","blocks":[{"id":"b4","type":"project-status","position":0,"config":{},"visible":true},{"id":"b5","type":"project-files","position":1,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"two_column","blocks":[{"id":"b6","type":"project-team","position":0,"config":{},"visible":true},{"id":"b7","type":"project-activity","position":1,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b8","type":"project-milestones","position":0,"config":{},"visible":true}]}]'::jsonb,
      '00000000-0000-0000-0000-000000000011', true, null, 0, 0);
    cnt := cnt + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.layouts WHERE name = 'Cyberpunk Project' AND is_template = true) THEN
    INSERT INTO public.layouts (name, description, type, category, sections, theme_id, is_template, created_by, usage_count, fork_count)
    VALUES ('Cyberpunk Project', 'Neon-edged project. Hero, about, status+roles, milestones, evidence, sessions+discussions.', 'standard', 'Creative',
      '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":true,"showTags":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"divider","position":0,"config":{},"visible":true},{"id":"b3","type":"project-about","position":1,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"two_column","blocks":[{"id":"b4","type":"project-status","position":0,"config":{},"visible":true},{"id":"b5","type":"project-roles","position":1,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"full","blocks":[{"id":"b6","type":"project-milestones","position":0,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b7","type":"project-evidence","position":0,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"two_column","blocks":[{"id":"b8","type":"project-sessions","position":0,"config":{},"visible":true},{"id":"b9","type":"project-discussions","position":1,"config":{},"visible":true}]}]'::jsonb,
      '00000000-0000-0000-0000-000000000017', true, null, 0, 0);
    cnt := cnt + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.layouts WHERE name = 'Documentation Hub' AND is_template = true) THEN
    INSERT INTO public.layouts (name, description, type, category, sections, theme_id, is_template, created_by, usage_count, fork_count)
    VALUES ('Documentation Hub', 'Structured docs layout. About, files, milestones, timeline, credits.', 'standard', 'Documentation',
      '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":false,"showTags":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"heading-block","position":0,"config":{"text":"About","level":2},"visible":true},{"id":"b3","type":"project-about","position":1,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"full","blocks":[{"id":"b4","type":"heading-block","position":0,"config":{"text":"Files","level":2},"visible":true},{"id":"b5","type":"project-files","position":1,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"full","blocks":[{"id":"b6","type":"heading-block","position":0,"config":{"text":"Roadmap","level":2},"visible":true},{"id":"b7","type":"project-milestones","position":1,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b8","type":"heading-block","position":0,"config":{"text":"History","level":2},"visible":true},{"id":"b9","type":"project-timeline","position":1,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b10","type":"project-credits","position":0,"config":{},"visible":true}]}]'::jsonb,
      '00000000-0000-0000-0000-000000000013', true, null, 0, 0);
    cnt := cnt + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.layouts WHERE name = 'Startup Pitch' AND is_template = true) THEN
    INSERT INTO public.layouts (name, description, type, category, sections, theme_id, is_template, created_by, usage_count, fork_count)
    VALUES ('Startup Pitch', 'Quick early-stage overview. Hero, status+milestones, team+roles, needs, evidence.', 'standard', 'Startup',
      '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":true,"showTags":true},"visible":true}]},{"id":"s2","position":1,"layout":"two_column","blocks":[{"id":"b2","type":"project-status","position":0,"config":{},"visible":true},{"id":"b3","type":"project-milestones","position":1,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"two_column","blocks":[{"id":"b4","type":"project-team","position":0,"config":{},"visible":true},{"id":"b5","type":"project-roles","position":1,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"full","blocks":[{"id":"b6","type":"project-needs","position":0,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b7","type":"project-evidence","position":0,"config":{},"visible":true}]}]'::jsonb,
      '00000000-0000-0000-0000-000000000020', true, null, 0, 0);
    cnt := cnt + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.layouts WHERE name = 'Midnight Docs' AND is_template = true) THEN
    INSERT INTO public.layouts (name, description, type, category, sections, theme_id, is_template, created_by, usage_count, fork_count)
    VALUES ('Midnight Docs', 'Deep navy documentation. About, files, repos, credits, timeline.', 'standard', 'Documentation',
      '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":false,"showTags":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"heading-block","position":0,"config":{"text":"About","level":2},"visible":true},{"id":"b3","type":"project-about","position":1,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"full","blocks":[{"id":"b4","type":"heading-block","position":0,"config":{"text":"Structure","level":2},"visible":true},{"id":"b5","type":"project-files","position":1,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"full","blocks":[{"id":"b6","type":"heading-block","position":0,"config":{"text":"Repositories","level":2},"visible":true},{"id":"b7","type":"project-repos","position":1,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b8","type":"project-credits","position":0,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b9","type":"project-timeline","position":0,"config":{},"visible":true}]}]'::jsonb,
      '00000000-0000-0000-0000-000000000022', true, null, 0, 0);
    cnt := cnt + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.layouts WHERE name = 'Creative Portfolio' AND is_template = true) THEN
    INSERT INTO public.layouts (name, description, type, category, sections, theme_id, is_template, created_by, usage_count, fork_count)
    VALUES ('Creative Portfolio', 'Showcase your work. Header, direction, bio, projects, skills+experience, tools, links, gallery, achievements.', 'standard', 'Portfolio',
      '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-header","position":0,"config":{},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"profile-direction","position":0,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"full","blocks":[{"id":"b3","type":"profile-bio","position":0,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"full","blocks":[{"id":"b4","type":"profile-projects","position":0,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"two_column","blocks":[{"id":"b5","type":"profile-skills","position":0,"config":{},"visible":true},{"id":"b6","type":"profile-experience","position":1,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b7","type":"profile-tools","position":0,"config":{},"visible":true}]},{"id":"s7","position":6,"layout":"full","blocks":[{"id":"b8","type":"profile-links","position":0,"config":{},"visible":true}]},{"id":"s8","position":7,"layout":"full","blocks":[{"id":"b9","type":"profile-gallery","position":0,"config":{},"visible":true}]},{"id":"s9","position":8,"layout":"full","blocks":[{"id":"b10","type":"profile-achievements","position":0,"config":{},"visible":true}]}]'::jsonb,
      '00000000-0000-0000-0000-000000000010', true, null, 0, 0);
    cnt := cnt + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.layouts WHERE name = 'Minimal Portfolio' AND is_template = true) THEN
    INSERT INTO public.layouts (name, description, type, category, sections, theme_id, is_template, created_by, usage_count, fork_count)
    VALUES ('Minimal Portfolio', 'Clean minimal profile. Header, direction, bio, skills+experience, projects, links.', 'standard', 'Minimal',
      '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-header","position":0,"config":{},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"profile-direction","position":0,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"full","blocks":[{"id":"b3","type":"profile-bio","position":0,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"two_column","blocks":[{"id":"b4","type":"profile-skills","position":0,"config":{},"visible":true},{"id":"b5","type":"profile-experience","position":1,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b6","type":"profile-projects","position":0,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b7","type":"profile-links","position":0,"config":{},"visible":true}]}]'::jsonb,
      '00000000-0000-0000-0000-000000000010', true, null, 0, 0);
    cnt := cnt + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.layouts WHERE name = 'Paper Profile' AND is_template = true) THEN
    INSERT INTO public.layouts (name, description, type, category, sections, theme_id, is_template, created_by, usage_count, fork_count)
    VALUES ('Paper Profile', 'Warm paper-like profile. Header, direction, bio, skills+tools, projects, experience, achievements, gallery.', 'standard', 'Portfolio',
      '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-header","position":0,"config":{},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"profile-direction","position":0,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"full","blocks":[{"id":"b3","type":"profile-bio","position":0,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"two_column","blocks":[{"id":"b4","type":"profile-skills","position":0,"config":{},"visible":true},{"id":"b5","type":"profile-tools","position":1,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b6","type":"profile-projects","position":0,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b7","type":"profile-experience","position":0,"config":{},"visible":true}]},{"id":"s7","position":6,"layout":"full","blocks":[{"id":"b8","type":"profile-achievements","position":0,"config":{},"visible":true}]},{"id":"s8","position":7,"layout":"full","blocks":[{"id":"b9","type":"profile-gallery","position":0,"config":{},"visible":true}]}]'::jsonb,
      '00000000-0000-0000-0000-000000000013', true, null, 0, 0);
    cnt := cnt + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.layouts WHERE name = 'Full Profile' AND is_template = true) THEN
    INSERT INTO public.layouts (name, description, type, category, sections, theme_id, is_template, created_by, usage_count, fork_count)
    VALUES ('Full Profile', 'Complete profile. Header, direction, bio, skills+experience, tools, projects, links, achievements, gallery.', 'standard', 'Portfolio',
      '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-header","position":0,"config":{},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"profile-direction","position":0,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"full","blocks":[{"id":"b3","type":"profile-bio","position":0,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"two_column","blocks":[{"id":"b4","type":"profile-skills","position":0,"config":{},"visible":true},{"id":"b5","type":"profile-experience","position":1,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b6","type":"profile-tools","position":0,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b7","type":"profile-projects","position":0,"config":{},"visible":true}]},{"id":"s7","position":6,"layout":"full","blocks":[{"id":"b8","type":"profile-links","position":0,"config":{},"visible":true}]},{"id":"s8","position":7,"layout":"full","blocks":[{"id":"b9","type":"profile-achievements","position":0,"config":{},"visible":true}]},{"id":"s9","position":8,"layout":"full","blocks":[{"id":"b10","type":"profile-gallery","position":0,"config":{},"visible":true}]}]'::jsonb,
      '00000000-0000-0000-0000-000000000021', true, null, 0, 0);
    cnt := cnt + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.layouts WHERE name = 'Sunset Studio' AND is_template = true) THEN
    INSERT INTO public.layouts (name, description, type, category, sections, theme_id, is_template, created_by, usage_count, fork_count)
    VALUES ('Sunset Studio', 'Warm gradient profile. Header, direction, bio, projects, skills+links, gallery.', 'standard', 'Creative',
      '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-header","position":0,"config":{},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"profile-direction","position":0,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"full","blocks":[{"id":"b3","type":"profile-bio","position":0,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"full","blocks":[{"id":"b4","type":"profile-projects","position":0,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"two_column","blocks":[{"id":"b5","type":"profile-skills","position":0,"config":{},"visible":true},{"id":"b6","type":"profile-links","position":1,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b7","type":"profile-gallery","position":0,"config":{},"visible":true}]}]'::jsonb,
      '00000000-0000-0000-0000-000000000021', true, null, 0, 0);
    cnt := cnt + 1;
  END IF;

  RETURN cnt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.reseed_default_templates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseed_default_templates() TO authenticated;