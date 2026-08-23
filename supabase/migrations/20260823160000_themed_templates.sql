-- Create themed templates: each uses a different built-in theme so the
-- Templates tab shows actual themed layouts instead of all default.

-- Developer Template (theme: Terminal)
INSERT INTO public.layouts (name, description, type, category, sections, is_template, created_by, usage_count, fork_count)
VALUES (
  'Terminal Developer',
  'Dark terminal aesthetic with green accents. Hero, status, milestones, repos, activity.',
  'standard',
  'Developer',
  '[
    {"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":true,"showTags":true},"visible":true}]},
    {"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"divider","position":0,"config":{},"visible":true},{"id":"b3","type":"project-about","position":1,"config":{},"visible":true}]},
    {"id":"s3","position":2,"layout":"two_column","blocks":[{"id":"b4","type":"project-status","position":0,"config":{},"visible":true},{"id":"b5","type":"project-milestones","position":1,"config":{},"visible":true}]},
    {"id":"s4","position":3,"layout":"full","blocks":[{"id":"b6","type":"project-repos","position":0,"config":{},"visible":true}]},
    {"id":"s5","position":4,"layout":"two_column","blocks":[{"id":"b7","type":"project-team","position":0,"config":{},"visible":true},{"id":"b8","type":"project-activity","position":1,"config":{},"visible":true}]},
    {"id":"s6","position":5,"layout":"full","blocks":[{"id":"b9","type":"project-timeline","position":0,"config":{},"visible":true}]}
  ]'::jsonb,
  true, null, 0, 0
);

-- Minimal Portfolio (theme: Minimal)
INSERT INTO public.layouts (name, description, type, category, sections, is_template, created_by, usage_count, fork_count)
VALUES (
  'Minimal Portfolio',
  'Clean minimal profile — header, bio, skills, projects, links only. Nothing extra.',
  'standard',
  'Minimal',
  '[
    {"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-header","position":0,"config":{},"visible":true}]},
    {"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"profile-direction","position":0,"config":{},"visible":true}]},
    {"id":"s3","position":2,"layout":"full","blocks":[{"id":"b3","type":"profile-bio","position":0,"config":{},"visible":true}]},
    {"id":"s4","position":3,"layout":"two_column","blocks":[{"id":"b4","type":"profile-skills","position":0,"config":{},"visible":true},{"id":"b5","type":"profile-experience","position":1,"config":{},"visible":true}]},
    {"id":"s5","position":4,"layout":"full","blocks":[{"id":"b6","type":"profile-projects","position":0,"config":{},"visible":true}]},
    {"id":"s6","position":5,"layout":"full","blocks":[{"id":"b7","type":"profile-links","position":0,"config":{},"visible":true}]}
  ]'::jsonb,
  true, null, 0, 0
);

-- Cyberpunk Project (theme: Cyberpunk)
INSERT INTO public.layouts (name, description, type, category, sections, is_template, created_by, usage_count, fork_count)
VALUES (
  'Cyberpunk Project',
  'Neon-edged project layout. Hero, status+roles, evidence, sessions, discussions.',
  'standard',
  'Creative',
  '[
    {"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":true,"showTags":true},"visible":true}]},
    {"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"divider","position":0,"config":{},"visible":true},{"id":"b3","type":"project-about","position":1,"config":{},"visible":true}]},
    {"id":"s3","position":2,"layout":"two_column","blocks":[{"id":"b4","type":"project-status","position":0,"config":{},"visible":true},{"id":"b5","type":"project-roles","position":1,"config":{},"visible":true}]},
    {"id":"s4","position":3,"layout":"full","blocks":[{"id":"b6","type":"project-milestones","position":0,"config":{},"visible":true}]},
    {"id":"s5","position":4,"layout":"full","blocks":[{"id":"b7","type":"project-evidence","position":0,"config":{},"visible":true}]},
    {"id":"s6","position":5,"layout":"two_column","blocks":[{"id":"b8","type":"project-sessions","position":0,"config":{},"visible":true},{"id":"b9","type":"project-discussions","position":1,"config":{},"visible":true}]}
  ]'::jsonb,
  true, null, 0, 0
);

-- Paper Profile (theme: Paper)
INSERT INTO public.layouts (name, description, type, category, sections, is_template, created_by, usage_count, fork_count)
VALUES (
  'Paper Profile',
  'Warm paper-like profile with subtle texture feel. Header, bio, tools, achievements, gallery.',
  'standard',
  'Portfolio',
  '[
    {"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-header","position":0,"config":{},"visible":true}]},
    {"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"profile-direction","position":0,"config":{},"visible":true}]},
    {"id":"s3","position":2,"layout":"full","blocks":[{"id":"b3","type":"profile-bio","position":0,"config":{},"visible":true}]},
    {"id":"s4","position":3,"layout":"two_column","blocks":[{"id":"b4","type":"profile-skills","position":0,"config":{},"visible":true},{"id":"b5","type":"profile-tools","position":1,"config":{},"visible":true}]},
    {"id":"s5","position":4,"layout":"full","blocks":[{"id":"b6","type":"profile-projects","position":0,"config":{},"visible":true}]},
    {"id":"s6","position":5,"layout":"full","blocks":[{"id":"b7","type":"profile-experience","position":0,"config":{},"visible":true}]},
    {"id":"s7","position":6,"layout":"full","blocks":[{"id":"b8","type":"profile-achievements","position":0,"config":{},"visible":true}]},
    {"id":"s8","position":7,"layout":"full","blocks":[{"id":"b9","type":"profile-gallery","position":0,"config":{},"visible":true}]}
  ]'::jsonb,
  true, null, 0, 0
);

-- Midnight Documentation (theme: Midnight)
INSERT INTO public.layouts (name, description, type, category, sections, is_template, created_by, usage_count, fork_count)
VALUES (
  'Midnight Docs',
  'Deep navy documentation layout. About, files, repos, credits, timeline.',
  'standard',
  'Documentation',
  '[
    {"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":false,"showTags":true},"visible":true}]},
    {"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"heading-block","position":0,"config":{"text":"About","level":2},"visible":true},{"id":"b3","type":"project-about","position":1,"config":{},"visible":true}]},
    {"id":"s3","position":2,"layout":"full","blocks":[{"id":"b4","type":"heading-block","position":0,"config":{"text":"Structure","level":2},"visible":true},{"id":"b5","type":"project-files","position":1,"config":{},"visible":true}]},
    {"id":"s4","position":3,"layout":"full","blocks":[{"id":"b6","type":"heading-block","position":0,"config":{"text":"Repositories","level":2},"visible":true},{"id":"b7","type":"project-repos","position":1,"config":{},"visible":true}]},
    {"id":"s5","position":4,"layout":"full","blocks":[{"id":"b8","type":"project-credits","position":0,"config":{},"visible":true}]},
    {"id":"s6","position":5,"layout":"full","blocks":[{"id":"b9","type":"project-timeline","position":0,"config":{},"visible":true}]}
  ]'::jsonb,
  true, null, 0, 0
);

-- Sunset Profile (theme: Sunset)
INSERT INTO public.layouts (name, description, type, category, sections, is_template, created_by, usage_count, fork_count)
VALUES (
  'Sunset Studio',
  'Warm gradient profile — direction, bio, projects, links, gallery.',
  'standard',
  'Creative',
  '[
    {"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-header","position":0,"config":{},"visible":true}]},
    {"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"profile-direction","position":0,"config":{},"visible":true}]},
    {"id":"s3","position":2,"layout":"full","blocks":[{"id":"b3","type":"profile-bio","position":0,"config":{},"visible":true}]},
    {"id":"s4","position":3,"layout":"full","blocks":[{"id":"b4","type":"profile-projects","position":0,"config":{},"visible":true}]},
    {"id":"s5","position":4,"layout":"two_column","blocks":[{"id":"b5","type":"profile-skills","position":0,"config":{},"visible":true},{"id":"b6","type":"profile-links","position":1,"config":{},"visible":true}]},
    {"id":"s6","position":5,"layout":"full","blocks":[{"id":"b7","type":"profile-gallery","position":0,"config":{},"visible":true}]}
  ]'::jsonb,
  true, null, 0, 0
)
ON CONFLICT DO NOTHING;