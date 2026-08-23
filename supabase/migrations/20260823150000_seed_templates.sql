-- Seed a handful of default public templates so the Templates tab has content.
-- These are minimal starter layouts for different use cases.

INSERT INTO public.layouts (name, description, type, category, sections, is_template, created_by, usage_count, fork_count)
VALUES
  (
    'Minimal Developer',
    'Clean, developer-focused layout with hero, about, status, tech, and activity.',
    'standard',
    'Developer',
    '[
      {"id": "s1","position":0,"layout":"full","blocks":[
        {"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":true,"showTags":true},"visible":true}
      ]},
      {"id": "s2","position":1,"layout":"full","blocks":[
        {"id":"b2","type":"divider","position":0,"config":{},"visible":true},
        {"id":"b3","type":"project-about","position":1,"config":{},"visible":true}
      ]},
      {"id": "s3","position":2,"layout":"two_column","blocks":[
        {"id":"b4","type":"project-status","position":0,"config":{},"visible":true},
        {"id":"b5","type":"project-milestones","position":1,"config":{},"visible":true}
      ]},
      {"id": "s4","position":3,"layout":"full","blocks":[
        {"id":"b6","type":"project-files","position":0,"config":{},"visible":true}
      ]},
      {"id": "s5","position":4,"layout":"two_column","blocks":[
        {"id":"b7","type":"project-team","position":0,"config":{},"visible":true},
        {"id":"b8","type":"project-activity","position":1,"config":{},"visible":true}
      ]}
    ]'::jsonb,
    true,
    null,
    0,
    0
  ),
  (
    'Creative Portfolio',
    'Showcase your work front and center — hero, gallery, projects, evidence, links.',
    'standard',
    'Portfolio',
    '[
      {"id": "s1","position":0,"layout":"full","blocks":[
        {"id":"b1","type":"profile-header","position":0,"config":{},"visible":true}
      ]},
      {"id": "s2","position":1,"layout":"full","blocks":[
        {"id":"b2","type":"profile-direction","position":0,"config":{},"visible":true}
      ]},
      {"id": "s3","position":2,"layout":"full","blocks":[
        {"id":"b3","type":"profile-bio","position":0,"config":{},"visible":true}
      ]},
      {"id": "s4","position":3,"layout":"full","blocks":[
        {"id":"b4","type":"profile-projects","position":0,"config":{},"visible":true}
      ]},
      {"id": "s5","position":4,"layout":"two_column","blocks":[
        {"id":"b5","type":"profile-skills","position":0,"config":{},"visible":true},
        {"id":"b6","type":"profile-experience","position":1,"config":{},"visible":true}
      ]},
      {"id": "s6","position":5,"layout":"full","blocks":[
        {"id":"b7","type":"profile-tools","position":0,"config":{},"visible":true}
      ]},
      {"id": "s7","position":6,"layout":"full","blocks":[
        {"id":"b8","type":"profile-links","position":0,"config":{},"visible":true}
      ]},
      {"id": "s8","position":7,"layout":"full","blocks":[
        {"id":"b9","type":"profile-gallery","position":0,"config":{},"visible":true}
      ]},
      {"id": "s9","position":8,"layout":"full","blocks":[
        {"id":"b10","type":"profile-achievements","position":0,"config":{},"visible":true}
      ]}
    ]'::jsonb,
    true,
    null,
    0,
    0
  ),
  (
    'Documentation Hub',
    'Structured layout for docs and open-source projects — hero, files, about, timeline, credits.',
    'standard',
    'Documentation',
    '[
      {"id": "s1","position":0,"layout":"full","blocks":[
        {"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":false,"showTags":true},"visible":true}
      ]},
      {"id": "s2","position":1,"layout":"full","blocks":[
        {"id":"b2","type":"heading-block","position":0,"config":{"text":"About","level":2},"visible":true},
        {"id":"b3","type":"project-about","position":1,"config":{},"visible":true}
      ]},
      {"id": "s3","position":2,"layout":"full","blocks":[
        {"id":"b4","type":"heading-block","position":0,"config":{"text":"Files","level":2},"visible":true},
        {"id":"b5","type":"project-files","position":1,"config":{},"visible":true}
      ]},
      {"id": "s4","position":3,"layout":"two_column","blocks":[
        {"id":"b6","type":"heading-block","position":0,"config":{"text":"Roadmap","level":2},"visible":true},
        {"id":"b7","type":"project-milestones","position":1,"config":{},"visible":true}
      ]},
      {"id": "s5","position":4,"layout":"full","blocks":[
        {"id":"b8","type":"heading-block","position":0,"config":{"text":"History","level":2},"visible":true},
        {"id":"b9","type":"project-timeline","position":1,"config":{},"visible":true}
      ]},
      {"id": "s6","position":5,"layout":"full","blocks":[
        {"id":"b10","type":"project-credits","position":0,"config":{},"visible":true}
      ]}
    ]'::jsonb,
    true,
    null,
    0,
    0
  ),
  (
    'Startup Pitch',
    'Quick overview for early-stage projects — hero, status, team, needs, milestones.',
    'standard',
    'Startup',
    '[
      {"id": "s1","position":0,"layout":"full","blocks":[
        {"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":true,"showTags":true},"visible":true}
      ]},
      {"id": "s2","position":1,"layout":"two_column","blocks":[
        {"id":"b2","type":"project-status","position":0,"config":{},"visible":true},
        {"id":"b3","type":"project-milestones","position":1,"config":{},"visible":true}
      ]},
      {"id": "s3","position":2,"layout":"two_column","blocks":[
        {"id":"b4","type":"project-team","position":0,"config":{},"visible":true},
        {"id":"b5","type":"project-roles","position":1,"config":{},"visible":true}
      ]},
      {"id": "s4","position":3,"layout":"full","blocks":[
        {"id":"b6","type":"project-needs","position":0,"config":{},"visible":true}
      ]},
      {"id": "s5","position":4,"layout":"full","blocks":[
        {"id":"b7","type":"project-evidence","position":0,"config":{},"visible":true}
      ]}
    ]'::jsonb,
    true,
    null,
    0,
    0
  ),
  (
    'Full Profile',
    'Complete profile layout — header, direction, bio, skills, tools, projects, links, achievements, gallery.',
    'standard',
    'Portfolio',
    '[
      {"id": "s1","position":0,"layout":"full","blocks":[
        {"id":"b1","type":"profile-header","position":0,"config":{},"visible":true}
      ]},
      {"id": "s2","position":1,"layout":"full","blocks":[
        {"id":"b2","type":"profile-direction","position":0,"config":{},"visible":true}
      ]},
      {"id": "s3","position":2,"layout":"full","blocks":[
        {"id":"b3","type":"profile-bio","position":0,"config":{},"visible":true}
      ]},
      {"id": "s4","position":3,"layout":"two_column","blocks":[
        {"id":"b4","type":"profile-skills","position":0,"config":{},"visible":true},
        {"id":"b5","type":"profile-experience","position":1,"config":{},"visible":true}
      ]},
      {"id": "s5","position":4,"layout":"full","blocks":[
        {"id":"b6","type":"profile-tools","position":0,"config":{},"visible":true}
      ]},
      {"id": "s6","position":5,"layout":"full","blocks":[
        {"id":"b7","type":"profile-projects","position":0,"config":{},"visible":true}
      ]},
      {"id": "s7","position":6,"layout":"full","blocks":[
        {"id":"b8","type":"profile-links","position":0,"config":{},"visible":true}
      ]},
      {"id": "s8","position":7,"layout":"full","blocks":[
        {"id":"b9","type":"profile-achievements","position":0,"config":{},"visible":true}
      ]},
      {"id": "s9","position":8,"layout":"full","blocks":[
        {"id":"b10","type":"profile-gallery","position":0,"config":{},"visible":true}
      ]}
    ]'::jsonb,
    true,
    null,
    0,
    0
  )
ON CONFLICT DO NOTHING;