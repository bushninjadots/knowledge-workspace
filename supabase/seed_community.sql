-- =============================================================================
-- seed_community.sql
-- -----------------------------------------------------------------------------
-- A living community for local development and testing.
--
-- 8 persona accounts, each with a distinct studio (profile) page built from
-- page-blocks + a different theme. 5 projects, 2 of them with full block-based
-- project pages and one 2-person collaboration. Posts, comments, challenge
-- participation, sessions, connections and follows make the community feed,
-- the study / sessions view and the reputation system feel alive.
--
-- This is a stand-alone script, safe to run against a fresh local database
-- (it does not depend on seed_demo.sql). Every statement is idempotent.
--
-- Run with: supabase db reset            (migrations + this file)
-- or apply manually against the local Postgres (postgres owns the schema).
--
-- Personas (uuid prefix 9…0000-0000-0000-0000-0000000000):
--   01 Rin Sato      — building Kite (Go)                Developer theme
--   02 Ana Vasquez   — building Lumina (accessibility)   Paper theme
--   03 Marcus Webb   — building Sloop (observability)    Terminal theme
--   04 Misaa Lee     — product / growth for Lumina       Minimal theme
--   05 Ola Adeyemi   — community at the Crafts Shed      Sunset theme
--   06 Dee Brooks    — sound; brand new, learning Go     Midnight theme
--   07 Yuki Tanaka   — leads Field Notes (zine)          Cyberpunk theme
--   08 Sam Carter    — technical writing; writers guild  Brutalist theme
--
-- Test targets in use:
--   test account (studio-test) is 812d3c58-91ed-4956-99ac-9ffa4b41212c,
--   handle user_812d3c58 — connected/following personas below.
--   The 5 starter challenges (4a000000-…-01..05) are reused, not duplicated.
--
-- Layouts (default profile/project templates already exist from migrations):
--   13 stored layouts            → one per persona page (8) + one per
--                                  project page (5).
-- Theme ids (built-ins):
--   Developer=…011  Paper=…013  Terminal=…012  Minimal=…010
--   Sunset=…021  Midnight=…022  Cyberpunk=…017  Brutalist=…014
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Persona auth accounts + identities
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pw text := crypt('tethyr-persona', gen_salt('bf', 10));
BEGIN
  INSERT INTO auth.users (instance_id, id, aud, role, encrypted_password,
    email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
    last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
    is_anonymous, is_sso_user, created_at, updated_at)
  VALUES
    ('00000000-0000-0000-0000-000000000000','90000000-0000-0000-0000-000000000001','authenticated','authenticated', pw,
      now(), NULL, '', NULL, '', NULL, '', '', NULL, '', 0, NULL, NULL, '', '', NULL,
      'rin@tethyr.local', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Rin Sato","handle":"rin","craft":"Software"}', false, false, false, now(), now()),
    ('00000000-0000-0000-0000-000000000000','90000000-0000-0000-0000-000000000002','authenticated','authenticated', pw,
      now(), NULL, '', NULL, '', NULL, '', '', NULL, '', 0, NULL, NULL, '', '', NULL,
      'ana@tethyr.local', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Ana Vasquez","handle":"ana","craft":"Accessibility"}', false, false, false, now(), now()),
    ('00000000-0000-0000-0000-000000000000','90000000-0000-0000-0000-000000000003','authenticated','authenticated', pw,
      now(), NULL, '', NULL, '', NULL, '', '', NULL, '', 0, NULL, NULL, '', '', NULL,
      'marcus@tethyr.local', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Marcus Webb","handle":"marcus","craft":"Backend"}', false, false, false, now(), now()),
    ('00000000-0000-0000-0000-000000000000','90000000-0000-0000-0000-000000000004','authenticated','authenticated', pw,
      now(), NULL, '', NULL, '', NULL, '', '', NULL, '', 0, NULL, NULL, '', '', NULL,
      'misaa@tethyr.local', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Misaa Lee","handle":"misaa","craft":"Product"}', false, false, false, now(), now()),
    ('00000000-0000-0000-0000-000000000000','90000000-0000-0000-0000-000000000005','authenticated','authenticated', pw,
      now(), NULL, '', NULL, '', NULL, '', '', NULL, '', 0, NULL, NULL, '', '', NULL,
      'ola@tethyr.local', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Ola Adeyemi","handle":"ola","craft":"Community"}', false, false, false, now(), now()),
    ('00000000-0000-0000-0000-000000000000','90000000-0000-0000-0000-000000000006','authenticated','authenticated', pw,
      now(), NULL, '', NULL, '', NULL, '', '', NULL, '', 0, NULL, NULL, '', '', NULL,
      'dee@tethyr.local', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Dee Brooks","handle":"dee","craft":"Sound"}', false, false, false, now(), now()),
    ('00000000-0000-0000-0000-000000000000','90000000-0000-0000-0000-000000000007','authenticated','authenticated', pw,
      now(), NULL, '', NULL, '', NULL, '', '', NULL, '', 0, NULL, NULL, '', '', NULL,
      'yuki@tethyr.local', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Yuki Tanaka","handle":"yuki","craft":"Illustration"}', false, false, false, now(), now()),
    ('00000000-0000-0000-0000-000000000000','90000000-0000-0000-0000-000000000008','authenticated','authenticated', pw,
      now(), NULL, '', NULL, '', NULL, '', '', NULL, '', 0, NULL, NULL, '', '', NULL,
      'sam@tethyr.local', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Sam Carter","handle":"sam","craft":"Writing"}', false, false, false, now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at, email, id)
  VALUES
    ('90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','{"sub":"90000000-0000-0000-0000-000000000001","email":"rin@tethyr.local","email_verified":true,"phone_verified":false}','email',now(),now(),now(),'rin@tethyr.local','90000000-0000-0000-0000-000000000001'),
    ('90000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','{"sub":"90000000-0000-0000-0000-000000000002","email":"ana@tethyr.local","email_verified":true,"phone_verified":false}','email',now(),now(),now(),'ana@tethyr.local','90000000-0000-0000-0000-000000000002'),
    ('90000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000003','{"sub":"90000000-0000-0000-0000-000000000003","email":"marcus@tethyr.local","email_verified":true,"phone_verified":false}','email',now(),now(),now(),'marcus@tethyr.local','90000000-0000-0000-0000-000000000003'),
    ('90000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000004','{"sub":"90000000-0000-0000-0000-000000000004","email":"misaa@tethyr.local","email_verified":true,"phone_verified":false}','email',now(),now(),now(),'misaa@tethyr.local','90000000-0000-0000-0000-000000000004'),
    ('90000000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000005','{"sub":"90000000-0000-0000-0000-000000000005","email":"ola@tethyr.local","email_verified":true,"phone_verified":false}','email',now(),now(),now(),'ola@tethyr.local','90000000-0000-0000-0000-000000000005'),
    ('90000000-0000-0000-0000-000000000006','90000000-0000-0000-0000-000000000006','{"sub":"90000000-0000-0000-0000-000000000006","email":"dee@tethyr.local","email_verified":true,"phone_verified":false}','email',now(),now(),now(),'dee@tethyr.local','90000000-0000-0000-0000-000000000006'),
    ('90000000-0000-0000-0000-000000000007','90000000-0000-0000-0000-000000000007','{"sub":"90000000-0000-0000-0000-000000000007","email":"yuki@tethyr.local","email_verified":true,"phone_verified":false}','email',now(),now(),now(),'yuki@tethyr.local','90000000-0000-0000-0000-000000000007'),
    ('90000000-0000-0000-0000-000000000008','90000000-0000-0000-0000-000000000008','{"sub":"90000000-0000-0000-0000-000000000008","email":"sam@tethyr.local","email_verified":true,"phone_verified":false}','email',now(),now(),now(),'sam@tethyr.local','90000000-0000-0000-0000-000000000008')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Persona profiles
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles
  (id, display_name, handle, category, creator_title, bio, availability,
   reputation_score, years_experience, country, timezone, favourite_tools,
   software_stack, languages, teaching_style, learning_goals, background,
   portfolio_links, social_links, evidence_shelf, avatar_url)
VALUES
  ('90000000-0000-0000-0000-000000000001','Rin Sato','rin','Development','Engineer and tinkerer',
   'I build small tools that solve a real daily annoyance and open-source them. Currently turning Kite, a cross-device clipboard sync, into something the distributed dev community actually runs. I would rather ship one careful thing than three loud ones.',
   'available', 342, 7, 'Japan','Asia/Tokyo',
   ARRAY['Go','Neovim','tmux','Fly.io'],
   ARRAY['Go','TypeScript','React','Node.js'],
   ARRAY['Japanese','English'],
   'Lead by example, review kindly, teach through working code.',
   'Rust for the sync daemon rewrite, and enough motion design to make Kite feel alive.',
   '{"mode":"pattern","pattern":"dots","color":"#0ea5e9","image_url":null}',
   '[{"label":"kite.dev","url":"https://kite.dev"}]',
   '{"github":"https://github.com/rin-sato","x":"https://x.com/rinsato"}',
   '[{"kind":"image","note":"Kite private beta screen","title":"Empty state","url":"https://picsum.photos/seed/kite-empty/1200/800","project_id":"9a000000-0000-0000-0000-000000000001"},{"kind":"image","note":"Design pass on the sync status card","title":"Sync card","url":"https://picsum.photos/seed/kite-card/1200/800","project_id":"9a000000-0000-0000-0000-000000000001"}]',
   'https://i.pravatar.cc/400?img=32'),
  ('90000000-0000-0000-0000-000000000002','Ana Vasquez','ana','Design','Designer, accessibility first',
   'I design reading experiences for people who are done squinting. Lumina is my current focus: a reading environment tuned for low vision that degrades gracefully instead of refusing. I test with people, not personas.',
   'busy', 291, 6, 'Mexico','America/Mexico_City',
   ARRAY['Figma','Storybook','VoiceOver','Magic'],
   ARRAY['TypeScript','React','Tailwind'],
   ARRAY['Spanish','English'],
   'Explain the why behind every recommendation.',
   'Motion design so focus states feel intentional, not decorative.',
   '{"mode":"pattern","pattern":"grid","color":"#f59e0b","image_url":null}',
   '[{"label":"lum.app","url":"https://lum.app"}]',
   '{"dribbble":"https://dribbble.com/anavasquez"}',
   '[{"kind":"image","note":"Reading mode study A","title":"Study A","url":"https://picsum.photos/seed/lumina-a/1200/800","project_id":"9a000000-0000-0000-0000-000000000002"},{"kind":"video","title":"Talk: contrast is a covenant","url":"https://vimeo.com/lumina-contrast","note":"Short talk for the a11y meetup","project_id":"9a000000-0000-0000-0000-000000000002"}]',
   'https://i.pravatar.cc/400?img=47'),
  ('90000000-0000-0000-0000-000000000003','Marcus Webb','marcus','Development','Backend and infrastructure',
   'I keep servers honest. Sloop is my self-hosted log reader for people who want their observability stack minus the vendor. Dark rooms, plain text, and panic-free deploys.',
   'learning', 217, 9, 'Germany','Europe/Berlin',
   ARRAY['Docker','ClickHouse','k9s','Prometheus'],
   ARRAY['Go','Rust','Python'],
   ARRAY['German','English'],
   'Walk through the failure mode first, then the fix.',
   'Rust for the ingestion side, plus a course on incident communication.',
   '{"mode":"color","color":"#10b981","pattern":null,"image_url":null}',
   '[{"label":"sloop.run","url":"https://sloop.run"}]',
   '{"github":"https://github.com/marcusweb"}',
   '[{"kind":"image","title":"Query time plot","note":"Latency wins after the query rewrite","url":"https://picsum.photos/seed/sloop-plot/1200/600","project_id":"9a000000-0000-0000-0000-000000000003"}]',
   'https://i.pravatar.cc/400?img=12'),
  ('90000000-0000-0000-0000-000000000004','Misaa Lee','misaa','Marketing','Product and community',
   'I turn objects into movements and movements into launch plans. On Lumina I own discovery and keep the waitlist warm without resorting to countdown gimmicks.',
   'available', 268, 5, 'South Korea','Asia/Seoul',
   ARRAY['Notion','Figma','Typefully'],
   ARRAY['TypeScript','React'],
   ARRAY['Korean','English'],
   'Teach by writing short, honest memos.',
   'Data analysis so every growth claim has numbers under it.',
   '{"mode":"pattern","pattern":"diagonal","color":"#8b5cf6","image_url":null}',
   '[{"label":"misaa.dev","url":"https://misaa.dev"}]',
   '{"linkedin":"https://linkedin.com/in/misaalee"}',
   '[]',
   'https://i.pravatar.cc/400?img=44'),
  ('90000000-0000-0000-0000-000000000005','Ola Adeyemi','ola','Community','Community, storytelling, small acts',
   'I run the Crafts Shed, a space for people who make things and need company while they do. I believe a shared calendar and a good introduction grow more projects than any algorithm.',
   'available', 305, 8, 'Nigeria','Africa/Lagos',
   ARRAY['Discord','Notion','OBS'],
   ARRAY[]::text[],
   ARRAY['Yoruba','English'],
   'Invite first, ask questions second.',
   'SQL and data-science basics so I can stop asking Marcus to measure things.',
   '{"mode":"color","color":"#f97316","pattern":null,"image_url":null}',
   '[{"label":"craftsshed.co","url":"https://craftsshed.co"}]',
   '{"x":"https://x.com/olaadeyemi"}',
   '[{"kind":"video","title":"Shed open house, issue one","note":"Recurring open house recording","url":"https://vimeo.com/crafts-shed-1","project_id":"9a000000-0000-0000-0000-000000000004"}]',
   'https://i.pravatar.cc/400?img=26'),
  ('90000000-0000-0000-0000-000000000006','Dee Brooks','dee','Music','Sound designer, learning to build',
   'I make audio for games and podcasts and I am two weeks into learning to build my own tools. Currently trying (very hard) to make my first Go program do more than print hello.',
   'learning', 96, 3, 'United Kingdom','Europe/London',
   ARRAY['Ableton','Reaper','ZBrush'],
   ARRAY[]::text[],
   ARRAY['English'],
   'I mostly ask questions right now; ask me to show my homework.',
   'Go so I can ship the audio-sidecar I keep describing.',
   '{"mode":"pattern","pattern":"crosshatch","color":"#6366f1","image_url":null}',
   '[{"label":"deebrooks.sound","url":"https://deebrooks.sound"}]',
   '{"instagram":"https://instagram.com/deebrooks"}',
   '[]',
   'https://i.pravatar.cc/400?img=5'),
  ('90000000-0000-0000-0000-000000000007','Yuki Tanaka','yuki','Design','Illustrator and zine maker',
   'Field Notes is my record of the places creative people actually work: the garages, the spare rooms, the printers that still smell like ink. Every issue is a small piece of evidence that making things by hand is not over.',
   'available', 156, 6, 'Japan','Asia/Tokyo',
   ARRAY['Procreate','After Effects','Figma'],
   ARRAY[]::text[],
   ARRAY['Japanese','English'],
   'Show your work-in-progress openly.',
   'Web design so Field Notes can live online without losing its paper soul.',
   '{"mode":"color","color":"#ec4899","pattern":null,"image_url":null}',
   '[{"label":"fieldnotes.zine","url":"https://fieldnotes.zine"}]',
   '{"behance":"https://behance.net/yukit"}',
   '[{"kind":"image","title":"Issue 03 spread","note":"Thresholds theme, early spread","url":"https://picsum.photos/seed/fieldnotes-03/1200/900","project_id":"9a000000-0000-0000-0000-000000000004"}]',
   'https://i.pravatar.cc/400?img=9'),
  ('90000000-0000-0000-0000-000000000008','Sam Carter','sam','Writing','Technical writer',
   'I translate plain data into plain words. I write docs, run the Writers Guild study circle, and I am a firm believer that a great README is a feature, not an afterthought.',
   'available', 188, 4, 'Canada','America/Toronto',
   ARRAY['Obsidian','Hugo','Vale'],
   ARRAY['Python','TypeScript'],
   ARRAY['French','English'],
   'Write together, read out loud, revise without ego.',
   'JavaScript and Go, to keep reviewing PRs without fear.',
   '{"mode":"pattern","pattern":"dots","color":"#14b8a6","image_url":null}',
   '[{"label":"samcarter.writing","url":"https://samcarter.writing"},{"label":"Vale rules","url":"https://github.com/samcarter/vale-rules"}]',
   '{"github":"https://github.com/samcarter"}',
   '[]',
   'https://i.pravatar.cc/400?img=60')
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name, handle = EXCLUDED.handle,
  category = EXCLUDED.category, creator_title = EXCLUDED.creator_title,
  bio = EXCLUDED.bio, availability = EXCLUDED.availability,
  reputation_score = EXCLUDED.reputation_score,
  years_experience = EXCLUDED.years_experience, country = EXCLUDED.country,
  timezone = EXCLUDED.timezone, favourite_tools = EXCLUDED.favourite_tools,
  software_stack = EXCLUDED.software_stack, languages = EXCLUDED.languages,
  teaching_style = EXCLUDED.teaching_style, learning_goals = EXCLUDED.learning_goals,
  background = EXCLUDED.background, portfolio_links = EXCLUDED.portfolio_links,
  social_links = EXCLUDED.social_links, evidence_shelf = EXCLUDED.evidence_shelf,
  avatar_url = EXCLUDED.avatar_url;

-- ---------------------------------------------------------------------------
-- 3. Skills each persona teaches and learns
-- ---------------------------------------------------------------------------
INSERT INTO public.profile_skills_teach (profile_id, skill_id, verification_level, experience_level, proof_url, proof_note)
SELECT '90000000-0000-0000-0000-000000000001'::uuid, id, 'proof_certified'::skill_verification_level, 'expert'::skill_experience_level, null, null FROM skills WHERE slug='go'
UNION ALL SELECT '90000000-0000-0000-0000-000000000001'::uuid, id, 'community_recognized'::skill_verification_level, 'expert'::skill_experience_level, null, null FROM skills WHERE slug='react'
UNION ALL SELECT '90000000-0000-0000-0000-000000000001'::uuid, id, 'proof_certified'::skill_verification_level, 'advanced'::skill_experience_level, null, null FROM skills WHERE slug='typescript'
UNION ALL SELECT '90000000-0000-0000-0000-000000000001'::uuid, id, 'self_declared'::skill_verification_level, 'advanced'::skill_experience_level, null, null FROM skills WHERE slug='api-development'
UNION ALL SELECT '90000000-0000-0000-0000-000000000002'::uuid, id, 'community_recognized'::skill_verification_level, 'expert'::skill_experience_level, null, null FROM skills WHERE slug='ui-design'
UNION ALL SELECT '90000000-0000-0000-0000-000000000002'::uuid, id, 'proof_certified'::skill_verification_level, 'expert'::skill_experience_level, null, null FROM skills WHERE slug='accessibility'
UNION ALL SELECT '90000000-0000-0000-0000-000000000002'::uuid, id, 'community_recognized'::skill_verification_level, 'advanced'::skill_experience_level, null, null FROM skills WHERE slug='figma'
UNION ALL SELECT '90000000-0000-0000-0000-000000000003'::uuid, id, 'proof_certified'::skill_verification_level, 'advanced'::skill_experience_level, null, null FROM skills WHERE slug='docker'
UNION ALL SELECT '90000000-0000-0000-0000-000000000003'::uuid, id, 'community_recognized'::skill_verification_level, 'advanced'::skill_experience_level, null, null FROM skills WHERE slug='devops'
UNION ALL SELECT '90000000-0000-0000-0000-000000000003'::uuid, id, 'proof_certified'::skill_verification_level, 'expert'::skill_experience_level, null, null FROM skills WHERE slug='observability'
UNION ALL SELECT '90000000-0000-0000-0000-000000000003'::uuid, id, 'community_recognized'::skill_verification_level, 'advanced'::skill_experience_level, null, null FROM skills WHERE slug='security'
UNION ALL SELECT '90000000-0000-0000-0000-000000000004'::uuid, id, 'community_recognized'::skill_verification_level, 'advanced'::skill_experience_level, null, null FROM skills WHERE slug='content-marketing'
UNION ALL SELECT '90000000-0000-0000-0000-000000000004'::uuid, id, 'self_declared'::skill_verification_level, 'intermediate'::skill_experience_level, null, null FROM skills WHERE slug='growth-marketing'
UNION ALL SELECT '90000000-0000-0000-0000-000000000005'::uuid, id, 'community_recognized'::skill_verification_level, 'expert'::skill_experience_level, null, null FROM skills WHERE slug='community-management'
UNION ALL SELECT '90000000-0000-0000-0000-000000000005'::uuid, id, 'community_recognized'::skill_verification_level, 'advanced'::skill_experience_level, null, null FROM skills WHERE slug='storytelling'
UNION ALL SELECT '90000000-0000-0000-0000-000000000005'::uuid, id, 'self_declared'::skill_verification_level, 'advanced'::skill_experience_level, null, null FROM skills WHERE slug='prompt-engineering'
UNION ALL SELECT '90000000-0000-0000-0000-000000000006'::uuid, id, 'self_declared'::skill_verification_level, 'advanced'::skill_experience_level, null, null FROM skills WHERE slug='sound-design'
UNION ALL SELECT '90000000-0000-0000-0000-000000000006'::uuid, id, 'self_declared'::skill_verification_level, 'intermediate'::skill_experience_level, null, null FROM skills WHERE slug='music-production'
UNION ALL SELECT '90000000-0000-0000-0000-000000000007'::uuid, id, 'proof_certified'::skill_verification_level, 'expert'::skill_experience_level, null, null FROM skills WHERE slug='illustration'
UNION ALL SELECT '90000000-0000-0000-0000-000000000007'::uuid, id, 'community_recognized'::skill_verification_level, 'advanced'::skill_experience_level, null, null FROM skills WHERE slug='motion-graphics'
UNION ALL SELECT '90000000-0000-0000-0000-000000000008'::uuid, id, 'proof_certified'::skill_verification_level, 'expert'::skill_experience_level, null, null FROM skills WHERE slug='technical-writing'
UNION ALL SELECT '90000000-0000-0000-0000-000000000008'::uuid, id, 'community_recognized'::skill_verification_level, 'advanced'::skill_experience_level, null, null FROM skills WHERE slug='copywriting'
UNION ALL SELECT '90000000-0000-0000-0000-000000000008'::uuid, id, 'community_recognized'::skill_verification_level, 'advanced'::skill_experience_level, null, null FROM skills WHERE slug='blogging'
ON CONFLICT DO NOTHING;

INSERT INTO public.profile_skills_learn (profile_id, skill_id)
SELECT '90000000-0000-0000-0000-000000000001'::uuid, id FROM skills WHERE slug='rust'
UNION ALL SELECT '90000000-0000-0000-0000-000000000002'::uuid, id FROM skills WHERE slug='motion-graphics'
UNION ALL SELECT '90000000-0000-0000-0000-000000000003'::uuid, id FROM skills WHERE slug='rust'
UNION ALL SELECT '90000000-0000-0000-0000-000000000003'::uuid, id FROM skills WHERE slug='react'
UNION ALL SELECT '90000000-0000-0000-0000-000000000004'::uuid, id FROM skills WHERE slug='data-analysis'
UNION ALL SELECT '90000000-0000-0000-0000-000000000005'::uuid, id FROM skills WHERE slug='sql'
UNION ALL SELECT '90000000-0000-0000-0000-000000000005'::uuid, id FROM skills WHERE slug='data-science'
UNION ALL SELECT '90000000-0000-0000-0000-000000000006'::uuid, id FROM skills WHERE slug='go'
UNION ALL SELECT '90000000-0000-0000-0000-000000000006'::uuid, id FROM skills WHERE slug='javascript'
UNION ALL SELECT '90000000-0000-0000-0000-000000000007'::uuid, id FROM skills WHERE slug='web-design'
UNION ALL SELECT '90000000-0000-0000-0000-000000000008'::uuid, id FROM skills WHERE slug='javascript'
UNION ALL SELECT '90000000-0000-0000-0000-000000000008'::uuid, id FROM skills WHERE slug='go'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Projects
-- ---------------------------------------------------------------------------
INSERT INTO public.projects
  (id, profile_id, title, description, goal, vision, status, stage, visibility,
   progress_percent, started_at, tags, is_featured, looking_for_feedback,
   looking_for_collaborators, cover_url, media, links, gallery, resources,
   uploaded_files, tools, readme, presentation_preset, season)
VALUES
  ('9a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001',
   'Kite','A tiny cross-device clipboard sync built on a Go service and a React web client. Encrypted at rest, offline first, self-hostable.',
   'Make clipboard history the one piece of your personal toolbox you never think about.', 'A self-hosted sync layer for the human residue of daily work: the pieces you copy, the commands you reuse, the answers you keep re-asking.',
   'active','testing','public', 74, now() - interval '5 months',
   ARRAY['go','sync','react','open-source'], true, true, true,
   'https://picsum.photos/seed/kite/1200/400','{}',
   '[{"label":"Docs","url":"https://kite.dev/docs","type":"docs"},{"label":"Source","url":"https://github.com/rin-sato/kite","type":"github"}]',
   '[{"url":"https://picsum.photos/seed/kite-1/1200/800","caption":"Private beta: sync status card","type":"image"},{"url":"https://picsum.photos/seed/kite-2/1200/800","caption":"Web client devices view","type":"image"},{"url":"https://picsum.photos/seed/kite-3/1200/800","caption":"Daemon terminal output","type":"image"},{"url":"https://vimeo.com/kite-sync-demo","caption":"Send and receive in one motion","type":"video"},{"url":"https://picsum.photos/seed/kite-4/1200/800","caption":"Encrypted storage toggle","type":"image"}]',
   NULL,
   '[{"name":"kite-linux-amd64","size":8201344,"uploaded_at":"2026-08-01T10:00:00Z"},{"name":"kite.schema.json","size":4182,"uploaded_at":"2026-08-08T12:00:00Z"},{"name":"web.wasm","size":407680,"uploaded_at":"2026-08-10T09:20:00Z"},{"name":"RUNBOOK.md","size":9811,"uploaded_at":"2026-08-12T18:40:00Z"},{"name":"demo-capture.mov","size":41822105,"uploaded_at":"2026-08-15T14:05:00Z"}]',
   '{"languages":["Go","TypeScript"],"frameworks":["React","Go stdlib"],"deploy":["Fly.io","Docker"]}',
   'Kite is clipboard history that respects the machine you run.\n\n## Why\nCopy is the most destructive action in computing and nobody ships a history for it. Kite keeps every piece of text you copy, syncs it across devices you own, and encrypts it so a stolen laptop is a nuisance, not a leak.\n\n## Status\nPrivate beta with a small waitlist from the first release thread. Feedback loop is fast: people file issues, I ship the fix in the same week.\n\n## The stack\n- Go daemon: sync protocol v2, WS transport, sqlite for local index\n- React web client: reads the stream, search over history\n- Encrypted at rest with a key derived from your account passphrase\n\n## What we need right now\n- Review of the sync protocol edge cases (offline conflict)\n- A logo lockup that is not a paper plane\n- Rust hands for the friendlier sync crate\n\n## Values\nSelf-hostable first. Telemetry opt-in. Docs that match reality.',
   'story-first','building'),
  ('9a000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002',
   'Lumina','A reading environment tuned for low vision that degrades gracefully instead of refusing.',
   'Let people choose their reading experience instead of accepting the default.', 'A web reader where contrast, spacing and type were designed from the evidence of real screen-reader sessions.',
   'active','building','public', 58, now() - interval '4 months',
   ARRAY['accessibility','ui-design','react'], true, true, true,
   'https://picsum.photos/seed/lumina/1200/400','{}',
   '[{"label":"Preview","url":"https://lum.app","type":"url"}]',
   '[{"url":"https://picsum.photos/seed/lumina-1/1200/800","caption":"Reading mode, default","type":"image"},{"url":"https://picsum.photos/seed/lumina-2/1200/800","caption":"Study A: spacing ladder","type":"image"},{"url":"https://picsum.photos/seed/lumina-3/1200/800","caption":"Night mode, high contrast","type":"image"},{"url":"https://picsum.photos/seed/lumina-4/1200/800","caption":"Focus ring pass","type":"image"}]',
   '{"audience":"Low-vision readers and their allies","success":"A beta cohort that reads a full article comfortably"}',
   '[]',
   '{"languages":["TypeScript"],"frameworks":["React","Tailwind"],"deploy":["Vercel"]}',
   'Lumina is a place to read long you do not have to squint through.\n\n## The design question\nDefault text size is a compromise nobody chose. Lumina treats reading preferences as first-class state and stores them per reader, not per device.\n\n## Rule one: degrade, never refuse\nIf a font cannot load, the fallback stack is still readable. If a reader needs 200% space, every control grows with them. Nothing is hidden behind an impossible toggle.\n\n## Evidence first\n- WCAG 2.2 audit of the current core flows (done)\n- Reading-mode prototypes tested in two sessions at the local library (done)\n- Screen-reader pass on the reading path (in progress)\n\n## Open offers\n- Real user interviews for the reading settings,\n- Collaborators who care about typography and care more about people.\n\n## Column\nWe measure success by articles finished, minutes focused; not time on screen.',
   'story-first','building'),
  ('9a000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000003',
   'Sloop','Self-hosted log reading for people who want observability without the vendor.',
   'Give a small team the query power of a big log platform, on hardware they already own.', 'Sloop is a log reader that runs in one container and answers the questions your on-call rotation actually asks.',
   'active','growing','public', 81, now() - interval '6 months',
   ARRAY['observability','devops','self-hosted'], false, true, false,
   'https://picsum.photos/seed/sloop/1200/400','{}',
   '[{"label":"GitHub","url":"https://github.com/marcusweb/sloop","type":"github"}]',
   '[{"url":"https://picsum.photos/seed/sloop-1/1200/800","caption":"Streaming query in the CLI","type":"image"},{"url":"https://picsum.photos/seed/sloop-2/1200/800","caption":"Retention tier dashboard","type":"image"},{"url":"https://picsum.photos/seed/sloop-3/1200/800","caption":"Search across one night of logs","type":"image"}]',
   NULL,
   '[{"name":"sloop_linux_amd64","size":14233600,"uploaded_at":"2026-08-14T08:00:00Z"},{"name":"docker-compose.yml","size":1240,"uploaded_at":"2026-08-14T08:05:00Z"}]',
   '{"languages":["Go"],"frameworks":["Go stdlib","ClickHouse"],"deploy":["Docker"]}',
   'Sloop reads logs the way you wish your vendor did.\n\n## Why not the big tools\nThe big log platforms are excellent at scale and exhausting at 200 MB a day. Sloop runs on one box, ships as one image, and keeps your logs yours.\n\n## Strengths now\n- Streaming query over a rolling window\n- Retention tiers: hot, warm, archive\n- One-command docker compose\n\n## Honest gaps\n- No kubernetes operator yet; a native chart is on its way\n- Docs are more notes than manuals (Sam is fixing that)\n\n## Next\nWrap the query language, publish the arm64 image, and hand the project to the people running it in anger.',
   'story-first','growing'),
  ('9a000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000007',
   'Field Notes','A shared zine about the places creative people build: garages, spare rooms, inky print shops.',
   'Document real working environments before they are redesigned away.', 'An archive of small spaces with big outputs, told in words, photos and a little too much ink.',
   'completed','launch','public', 100, now() - interval '7 months',
   ARRAY['zine','storytelling','design'], true, false, false,
   'https://picsum.photos/seed/fieldnotes/1200/400','{}',
   '[{"label":"Read issue 03","url":"https://fieldnotes.zine/issue-03","type":"url"}]',
   '[{"url":"https://picsum.photos/seed/fn-1/1200/900","caption":"Issue 01 cover","type":"image"},{"url":"https://picsum.photos/seed/fn-2/1200/900","caption":"A printer that still works","type":"image"},{"url":"https://picsum.photos/seed/fn-3/1200/900","caption":"Issue 03 spread","type":"image"}]',
   NULL,
   '[]',
   NULL,
   'Field Notes began as a question: where is the clay of the modern creative economy?\n\nThe answer was everywhere. A bassist in a shed. A zine maker at a kitchen table. A studio the size of a linen closet. Issue 03 is the places-and-thresholds issue, and it went to print with 48 pages of ink.\n\nWe print 200 copies by hand and the online edition is free.',
   'story-first','launch'),
  ('9a000000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000001',
   'Cadence','Audio stems for group composition of environments: a side project between Kite releases.',
   'Give a small writing group a shared sound palette for the places they describe.', 'A community recording project where every track is a room, and the rooms stack into scenes.',
   'planning','planning','public', 12, now() - interval '3 weeks',
   ARRAY['music','experiment'], false, true, true,
   NULL,'{}',
   '[{"label":"Mood board","url":"https://www.are.na/cadence","type":"url"}]',
   '[]',
   NULL,
   '[]',
   NULL,
   'Cadence is a reaction to the same-da-does-it plays. A group of writers, one sound designer, and a shared folder of stems.\n\nEvery month we record one room. A kitchen at 5am. A train platform. A server room that hums. The stems are CC-licensed and open to remix.', 'story-first','planning')
ON CONFLICT (id) DO NOTHING;

UPDATE public.projects SET readme = replace(readme, '\n', E'\n') WHERE readme IS NOT NULL AND id::text LIKE '9a000000-%';
UPDATE public.projects SET created_at = started_at WHERE id::text LIKE '9a000000-%' AND started_at IS NOT NULL;

INSERT INTO public.project_skills (project_id, skill_id)
SELECT '9a000000-0000-0000-0000-000000000001'::uuid, id FROM skills WHERE slug='go'
UNION ALL SELECT '9a000000-0000-0000-0000-000000000001'::uuid, id FROM skills WHERE slug='react'
UNION ALL SELECT '9a000000-0000-0000-0000-000000000001'::uuid, id FROM skills WHERE slug='api-development'
UNION ALL SELECT '9a000000-0000-0000-0000-000000000001'::uuid, id FROM skills WHERE slug='security'
UNION ALL SELECT '9a000000-0000-0000-0000-000000000002'::uuid, id FROM skills WHERE slug='ui-design'
UNION ALL SELECT '9a000000-0000-0000-0000-000000000002'::uuid, id FROM skills WHERE slug='accessibility'
UNION ALL SELECT '9a000000-0000-0000-0000-000000000002'::uuid, id FROM skills WHERE slug='react'
UNION ALL SELECT '9a000000-0000-0000-0000-000000000003'::uuid, id FROM skills WHERE slug='observability'
UNION ALL SELECT '9a000000-0000-0000-0000-000000000003'::uuid, id FROM skills WHERE slug='database'
UNION ALL SELECT '9a000000-0000-0000-0000-000000000003'::uuid, id FROM skills WHERE slug='docker'
UNION ALL SELECT '9a000000-0000-0000-0000-000000000004'::uuid, id FROM skills WHERE slug='illustration'
UNION ALL SELECT '9a000000-0000-0000-0000-000000000004'::uuid, id FROM skills WHERE slug='storytelling'
UNION ALL SELECT '9a000000-0000-0000-0000-000000000005'::uuid, id FROM skills WHERE slug='sound-design'
ON CONFLICT DO NOTHING;

INSERT INTO public.project_contributors (project_id, profile_id, role, joined_at, contribution_score, skills_used)
VALUES
  ('9a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','creator', now() - interval '5 months', 42, ARRAY['go','api-development','security']),
  ('9a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','contributor', now() - interval '21 days', 6, ARRAY['ui-design','accessibility']),
  ('9a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000004','contributor', now() - interval '12 days', 3, ARRAY['content-marketing']),
  ('9a000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','creator', now() - interval '4 months', 30, ARRAY['ui-design','accessibility']),
  ('9a000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000004','mentor', now() - interval '1 month', 7, ARRAY['content-marketing','product-design']),
  ('9a000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000007','mentor', now() - interval '6 weeks', 4, ARRAY['illustration']),
  ('9a000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000003','creator', now() - interval '6 months', 51, ARRAY['observability','database','docker']),
  ('9a000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000008','contributor', now() - interval '15 days', 3, ARRAY['technical-writing']),
  ('9a000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000007','creator', now() - interval '7 months', 22, ARRAY['illustration','storytelling']),
  ('9a000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000005','contributor', now() - interval '6 weeks', 4, ARRAY['community-management','storytelling']),
  ('9a000000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000001','creator', now() - interval '3 weeks', 2, ARRAY['go']),
  ('9a000000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000006','contributor', now() - interval '1 week', 1, ARRAY['sound-design'])
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Milestones, roles, needs, updates, discussions, repositories
-- ---------------------------------------------------------------------------
INSERT INTO public.project_milestones (id, project_id, title, description, status, position, due_date, completed_by)
VALUES
  ('9b000000-0000-0000-0000-000000000001','9a000000-0000-0000-0000-000000000001','Clipboard daemon on Linux','Tail-based clipboard polling without gnome extensions.','done',0,'2026-05-01','90000000-0000-0000-0000-000000000001'),
  ('9b000000-0000-0000-0000-000000000002','9a000000-0000-0000-0000-000000000001','Sync protocol v2','Rebuilt transport on WS with a proper sync log.','done',1,'2026-06-20','90000000-0000-0000-0000-000000000001'),
  ('9b000000-0000-0000-0000-000000000003','9a000000-0000-0000-0000-000000000001','Encrypted storage at rest','Key derived from account passphrase; sqlite rows encrypted.','in_progress',2,'2026-09-01',NULL),
  ('9b000000-0000-0000-0000-000000000004','9a000000-0000-0000-0000-000000000001','Public beta for invite list','Open signup with the waitlist cleared.','pending',3,'2026-09-20',NULL),
  ('9b000000-0000-0000-0000-000000000101','9a000000-0000-0000-0000-000000000002','Design audit against WCAG 2.2','Full audit of core reading flows.','done',0,'2026-06-10','90000000-0000-0000-0000-000000000002'),
  ('9b000000-0000-0000-0000-000000000102','9a000000-0000-0000-0000-000000000002','Reading mode prototypes','Two prototype variants tested at the local library.','done',1,'2026-07-05','90000000-0000-0000-0000-000000000002'),
  ('9b000000-0000-0000-0000-000000000103','9a000000-0000-0000-0000-000000000002','Screen reader pass on core flows','VoiceOver and NVDA pass on the reading path.','in_progress',2,'2026-09-08',NULL),
  ('9b000000-0000-0000-0000-000000000104','9a000000-0000-0000-0000-000000000002','Community beta','Waitlist cohort reads a full article comfortably.','pending',3,'2026-10-01',NULL),
  ('9b000000-0000-0000-0000-000000000201','9a000000-0000-0000-0000-000000000003','Streaming query API','Long-poll query over a rolling window.','done',0,'2026-07-01','90000000-0000-0000-0000-000000000003'),
  ('9b000000-0000-0000-0000-000000000202','9a000000-0000-0000-0000-000000000003','Log retention tiers','Hot, warm and archive tiers with automatic compaction.','in_progress',1,'2026-09-12',NULL),
  ('9b000000-0000-0000-0000-000000000203','9a000000-0000-0000-0000-000000000003','Docker arm64 image','Multi-arch build for the homelab crowd.','pending',2,'2026-09-25',NULL),
  ('9b000000-0000-0000-0000-000000000301','9a000000-0000-0000-0000-000000000004','Issue 03 shipped','Thresholds issue to print and to the web.','done',0,'2026-08-10','90000000-0000-0000-0000-000000000007'),
  ('9b000000-0000-0000-0000-000000000401','9a000000-0000-0000-0000-000000000005','Stem format spec','Draft the shared stem folder layout and licenses.','in_progress',0,'2026-09-15',NULL),
  ('9b000000-0000-0000-0000-000000000402','9a000000-0000-0000-0000-000000000005','First meetup scheduled','One room recorded per month, calendar published.','pending',1,'2026-10-01',NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_open_roles (id, project_id, title, description, skills, is_filled, filled_by)
VALUES
  ('9c000000-0000-0000-0000-000000000001','9a000000-0000-0000-0000-000000000001','React web client maintainer','Own the web client, search and keyboard flows.','react','typescript',false,NULL),
  ('9c000000-0000-0000-0000-000000000002','9a000000-0000-0000-0000-000000000001','Rust sync crate','A friendlier client crate on the sync protocol.','rust',false,NULL),
  ('9c000000-0000-0000-0000-000000000101','9a000000-0000-0000-0000-000000000002','User research volunteer','Run two sessions of reading interviews this month.','ux-research',false,NULL),
  ('9c000000-0000-0000-0000-000000000201','9a000000-0000-0000-0000-000000000003','Docs writer','Turn the notes into a manual people can trust.','technical-writing',true,'90000000-0000-0000-0000-000000000008'),
  ('9c000000-0000-0000-0000-000000000202','9a000000-0000-0000-0000-000000000003','Kubernetes operator','Native chart and operator for the big-homelab tier.','docker','go',false,NULL),
  ('9c000000-0000-0000-0000-000000000401','9a000000-0000-0000-0000-000000000005','Audio engineer mentor','Help shape the stem standard and review first captures.','sound-design',false,NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_needs (id, project_id, title, note, skill_id, urgency, is_filled, filled_by)
SELECT '9d000000-0000-0000-0000-000000000001'::uuid,'9a000000-0000-0000-0000-000000000001','Sync protocol review','Weigh in on the offline conflict strategy before the beta.','api-development','high',false,NULL
UNION ALL SELECT '9d000000-0000-0000-0000-000000000101','9a000000-0000-0000-0000-000000000002','Real user interviews','Low vision readers for two sessions; transcripts only.','ux-research','high',false,NULL
UNION ALL SELECT '9d000000-0000-0000-0000-000000000201','9a000000-0000-0000-0000-000000000003','Load test numbers','One evening of synthetic load against the query API.','database','normal',false,NULL
UNION ALL SELECT '9d000000-0000-0000-0000-000000000401','9a000000-0000-0000-0000-000000000005','Print run help','A printer who can do 200 copies of a zine scent.','content-marketing','low',true,'90000000-0000-0000-0000-000000000005'
ON CONFLICT DO NOTHING;

INSERT INTO public.project_updates (id, project_id, author_id, title, body, week_number, created_at)
VALUES
  ('9e000000-0000-0000-0000-000000000001','9a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','Latency cut by 40 percent','The write-ahead log experiment paid off. Sync now feels instant on the same network.',12, now() - interval '10 days'),
  ('9e000000-0000-0000-0000-000000000002','9a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','First commit from a stranger','Someone filed a PR improving the daemon loop. This is the good internet.',13, now() - interval '3 days'),
  ('9e000000-0000-0000-0000-000000000101','9a000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','Interview night at the library','Five readers, two hours, three settings changed. The spacing ladder was the surprise winner.',8, now() - interval '5 days'),
  ('9e000000-0000-0000-0000-000000000201','9a000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000003','Self-hosting week','Ten volunteers ran Sloop on a Pi and filed issues, bless every one of them.',20, now() - interval '7 days'),
  ('9e000000-0000-0000-0000-000000000301','9a000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000007','Issue 03 recap','48 pages, 200 copies, one very ink-stained table. The online edition is free.',0, now() - interval '6 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_discussions (id, project_id, author_id, title, body, category, is_pinned, created_at)
VALUES
  ('9f000000-0000-0000-0000-000000000001','9a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','Thread-safety in the daemon','Where do we lock, and where do we let the channel do the work?','architecture',false, now() - interval '12 days'),
  ('9f000000-0000-0000-0000-000000000002','9a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000003','Licensing question','MIT for the daemon but a serum license for the web client feels uneven.','governance',false, now() - interval '4 days'),
  ('9f000000-0000-0000-0000-000000000101','9a000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','Font pairing for reading mode','We keep coming back to the same three faces; lets write it down.','design',true, now() - interval '8 days'),
  ('9f000000-0000-0000-0000-000000000201','9a000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000003','Do we log in JSON? Yes.','Settled strategy for the schema so the query API stays boring.','architecture',true, now() - interval '6 days'),
  ('9f000000-0000-0000-0000-000000000301','9a000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000007','Pitch: issue 04 theme is thresholds','We already have the rooms; now the edges between them.','theme',false, now() - interval '3 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.discussion_replies (id, discussion_id, author_id, body, created_at)
VALUES
  ('9f100000-0000-0000-0000-000000000011','9f000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000004','A single goroutine owning the state killed all my races in a similar daemon.', now() - interval '11 days'),
  ('9f100000-0000-0000-0000-000000000012','9f000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000008','Document the lock order somewhere visible; future you will thank present you.', now() - interval '10 days'),
  ('9f100000-0000-0000-0000-000000000013','9f000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000001','MIT everywhere is the easiest story for adoption.', now() - interval '3 days'),
  ('9f100000-0000-0000-0000-000000000111','9f000000-0000-0000-0000-000000000101','90000000-0000-0000-0000-000000000006','Could I sit in on a session? I want to hear how text feels from someone who cannot just bump DPI.', now() - interval '7 days'),
  ('9f100000-0000-0000-0000-000000000211','9f000000-0000-0000-0000-000000000201','90000000-0000-0000-0000-000000000008','Yes, and thank you - the docs can finally stop guessing the schema.', now() - interval '5 days'),
  ('9f100000-0000-0000-0000-000000000311','9f000000-0000-0000-0000-000000000301','90000000-0000-0000-0000-000000000005','Thresholds is the connective tissue of the whole archive. Count me in.', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_repositories (id, project_id, url, provider, metadata, created_at)
VALUES
  ('9f200000-0000-0000-0000-000000000001','9a000000-0000-0000-0000-000000000001','https://github.com/rin-sato/kite','github','{"full_name":"rin-sato/kite","stargazers_count":214,"forks":18,"language":"Go"}', now() - interval '5 months'),
  ('9f200000-0000-0000-0000-000000000002','9a000000-0000-0000-0000-000000000001','https://github.com/rin-sato/kite-web','github','{"full_name":"rin-sato/kite-web","stargazers_count":61,"forks":9,"language":"TypeScript"}', now() - interval '4 months'),
  ('9f200000-0000-0000-0000-000000000101','9a000000-0000-0000-0000-000000000002','https://github.com/ana-vasquez/lumina','github','{"full_name":"ana-vasquez/lumina","stargazers_count":42,"forks":4,"language":"TypeScript"}', now() - interval '4 months'),
  ('9f200000-0000-0000-0000-000000000201','9a000000-0000-0000-0000-000000000003','https://github.com/marcusweb/sloop','github','{"full_name":"marcusweb/sloop","stargazers_count":128,"forks":11,"language":"Go"}', now() - interval '6 months')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Project activity feed (drives activity + timeline blocks)
-- ---------------------------------------------------------------------------
INSERT INTO public.project_activity (id, project_id, actor_id, kind, title, body, metadata, created_at)
VALUES
  ('9f300000-0000-0000-0000-000000000001','9a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','project_created','Project created','Kite opens its doors.', '{}', now() - interval '5 months'),
  ('9f300000-0000-0000-0000-000000000002','9a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','milestone_completed','Clipboard daemon on Linux','First device syncs.', '{"milestone_title":"Clipboard daemon on Linux"}', now() - interval '3 months'),
  ('9f300000-0000-0000-0000-000000000003','9a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','milestone_completed','Sync protocol v2','Transport rebuilt on WS.', '{"milestone_title":"Sync protocol v2"}', now() - interval '45 days'),
  ('9f300000-0000-0000-0000-000000000004','9a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','member_joined','Ana Vasquez joined as contributor','Design and a11y eyes on the beta.', '{"display_name":"Ana Vasquez","role":"contributor"}', now() - interval '21 days'),
  ('9f300000-0000-0000-0000-000000000005','9a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','update_published','Latency cut by 40 percent','The write-ahead log experiment paid off.', '{"title":"Latency cut by 40 percent"}', now() - interval '10 days'),
  ('9f300000-0000-0000-0000-000000000006','9a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','role_opened','React web client maintainer','Open call for collaborators.', '{"title":"React web client maintainer"}', now() - interval '6 days'),
  ('9f300000-0000-0000-0000-000000000007','9a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','file_added','kite.schema.json','Schema shipped to the repo.', '{"name":"kite.schema.json"}', now() - interval '4 days'),
  ('9f300000-0000-0000-0000-000000000101','9a000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','project_created','Project created','Lumina opens its doors.', '{}', now() - interval '4 months'),
  ('9f300000-0000-0000-0000-000000000102','9a000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','milestone_completed','Design audit against WCAG 2.2','Full audit of reading flows.', '{"milestone_title":"Design audit against WCAG 2.2"}', now() - interval '2 months'),
  ('9f300000-0000-0000-0000-000000000103','9a000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000004','member_joined','Misaa Lee joined as mentor','Discovery and launch planning.', '{"display_name":"Misaa Lee","role":"mentor"}', now() - interval '1 month'),
  ('9f300000-0000-0000-0000-000000000104','9a000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','update_published','Interview night at the library','Five readers, two hours.', '{"title":"Interview night at the library"}', now() - interval '5 days'),
  ('9f300000-0000-0000-0000-000000000105','9a000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','need_created','Real user interviews','Low vision readers needed.', '{"title":"Real user interviews"}', now() - interval '3 days'),
  ('9f300000-0000-0000-0000-000000000201','9a000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000003','project_created','Project created','Sloop opens its doors.', '{}', now() - interval '6 months'),
  ('9f300000-0000-0000-0000-000000000202','9a000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000003','milestone_completed','Streaming query API','Long-poll query over a rolling window.', '{"milestone_title":"Streaming query API"}', now() - interval '2 months'),
  ('9f300000-0000-0000-0000-000000000203','9a000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000008','member_joined','Sam Carter joined as docs writer','Docs went from notes to manuals.', '{"display_name":"Sam Carter","role":"contributor"}', now() - interval '15 days'),
  ('9f300000-0000-0000-0000-000000000204','9a000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000003','role_opened','Kubernetes operator','Native chart and operator.', '{"title":"Kubernetes operator"}', now() - interval '2 days'),
  ('9f300000-0000-0000-0000-000000000301','9a000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000007','project_created','Project created','Field Notes opens its doors.', '{}', now() - interval '7 months'),
  ('9f300000-0000-0000-0000-000000000302','9a000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000007','milestone_completed','Issue 03 shipped','To print and to the web.', '{"milestone_title":"Issue 03 shipped"}', now() - interval '2 weeks'),
  ('9f300000-0000-0000-0000-000000000303','9a000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000005','member_joined','Ola Adeyemi joined as contributor','Community wiring and open house.', '{"display_name":"Ola Adeyemi","role":"contributor"}', now() - interval '6 weeks'),
  ('9f300000-0000-0000-0000-000000000401','9a000000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000001','project_created','Project created','Cadence opens its doors.', '{}', now() - interval '3 weeks'),
  ('9f300000-0000-0000-0000-000000000402','9a000000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000001','challenge_completed','Record a two-minute project update','Cadence introduced on film.', '{"challenge":"Record a two-minute project update"}', now() - interval '5 days')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. Teams
-- ---------------------------------------------------------------------------
INSERT INTO public.teams (id, name, slug, description, created_by, created_at)
VALUES
  ('9a100000-0000-0000-0000-000000000001','Kite Crew','kite-crew','The crew building Kite: offline-first clipboard sync, encrypted at rest, self-hostable.','90000000-0000-0000-0000-000000000001', now() - interval '4 months'),
  ('9a100000-0000-0000-0000-000000000002','Writers Guild','writers-guild','Writers who keep each other shipping: docs, posts and the occasional physical zine.','90000000-0000-0000-0000-000000000008', now() - interval '3 months')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.team_members (team_id, profile_id, role, joined_at)
VALUES
  ('9a100000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','lead', now() - interval '4 months'),
  ('9a100000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','core', now() - interval '21 days'),
  ('9a100000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000004','core', now() - interval '12 days'),
  ('9a100000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000008','lead', now() - interval '3 months'),
  ('9a100000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000005','core', now() - interval '6 weeks'),
  ('9a100000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000007','contributor', now() - interval '2 months')
ON CONFLICT DO NOTHING;

INSERT INTO public.team_projects (team_id, project_id)
VALUES
  ('9a100000-0000-0000-0000-000000000001','9a000000-0000-0000-0000-000000000001'),
  ('9a100000-0000-0000-0000-000000000002','9a000000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. Community space + members
-- ---------------------------------------------------------------------------
INSERT INTO public.community_spaces (id, name, slug, description, created_by, created_at, join_type, rules, visibility, report_auto_dim_threshold)
VALUES
  ('9a200000-0000-0000-0000-000000000001','The Crafts Shed','the-crafts-shed','A space for people who make things and need company while they do. Show work, ask for help, share the mess.','90000000-0000-0000-0000-000000000005', now() - interval '2 months','auto', ARRAY['Work in progress belongs here','Help first, critique second','Credit the maker','No promo drops outside the open table'],'public',3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.community_space_members (space_id, user_id, role, joined_at)
VALUES
  ('9a200000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000005','owner', now() - interval '2 months'),
  ('9a200000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','moderator', now() - interval '2 months'),
  ('9a200000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','moderator', now() - interval '7 weeks'),
  ('9a200000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000003','member', now() - interval '6 weeks'),
  ('9a200000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000004','member', now() - interval '5 weeks'),
  ('9a200000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000006','member', now() - interval '4 weeks'),
  ('9a200000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000007','member', now() - interval '3 weeks'),
  ('9a200000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000008','member', now() - interval '2 weeks'),
  ('9a200000-0000-0000-0000-000000000001','812d3c58-91ed-4956-99ac-9ffa4b41212c','member', now() - interval '1 week')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. Posts, comments, post_actions
-- ---------------------------------------------------------------------------
INSERT INTO public.posts
  (id, author_id, type, title, body, community, skills, created_at, space_id,
   is_pinned, project_id, feedback_tags, flair)
VALUES
  ('9e100000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','showcase','Reading mode begins where fonts end',
   'Lumina passed its second library session this week. Five readers, three settings changed, and the spacing ladder was the quiet hero. The accessible case is never just "bigger text".',
   'General', ARRAY['accessibility','ui-design'], now() - interval '11 days', NULL, false, '9a000000-0000-0000-0000-000000000002', NULL, NULL),
  ('9e100000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000001','feedback_request','Kite sync protocol: is this safe offline?',
   'Two devices, no network, both edit history. The write-ahead log wins the happy path but I keep going in circles on the conflict edge. Would love eyes on the strategy before the beta invites go out.',
   'General', ARRAY['go','api-development'], now() - interval '5 days', NULL, false, '9a000000-0000-0000-0000-000000000001', ARRAY['architecture','reliability','offline'], 'help wanted'),
  ('9e100000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000006','question','Absolute beginner: how do you even start a Go project?',
   'I am two weeks in and my only Go program prints hello. Folder layout, build tags, how a tour becomes a real project: where does the path go after the basics?',
   'General', ARRAY['go'], now() - interval '3 days', NULL, false, NULL, NULL, NULL),
  ('9e100000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000003','discussion','What do you use for on-prem log search?',
   'Everything good is a vendor, everything self-hosted is a hobby fork. Sloop users: what were you running before, and what did you quit on?',
   'General', ARRAY['observability','database'], now() - interval '2 days', NULL, false, NULL, NULL, NULL),
  ('9e100000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000008','tutorial','Self-hosting a Go service with Docker',
   'The shortest path from go build to a container that survives a reboot, with the three mistakes everyone makes on the way. Written for the Sloop self-hosting week.',
   'General', ARRAY['go','docker'], now() - interval '9 days', NULL, false, NULL, NULL, NULL),
  ('9e100000-0000-0000-0000-000000000006','90000000-0000-0000-0000-000000000007','achievement','We printed Issue 03 of Field Notes',
   '48 pages, 200 copies, one very ink-stained table. Thresholds is out in the world and the online edition is free for anyone who wants it.',
   'General', ARRAY['storytelling','illustration'], now() - interval '6 days', NULL, false, '9a000000-0000-0000-0000-000000000004', NULL, NULL),
  ('9e100000-0000-0000-0000-000000000007','90000000-0000-0000-0000-000000000004','question','React state: built-in forms or zustand?',
   'For a mid-size app with one shared draft and a lot of local UI, is bringing a store still the default? Genuinely asking before the next project.' ,
   'General', ARRAY['react','typescript'], now() - interval '4 days', NULL, false, NULL, NULL, NULL),
  ('9e100000-0000-0000-0000-000000000008','90000000-0000-0000-0000-000000000002','feedback_request','Are these Lumina nav labels clear?',
   'Reading, Library, Schedule, Settings. Four words in the nav; each one does a lot. Before the screen reader pass, I want plain-eyes feedback on the naming.',
   'General', ARRAY['accessibility','ui-design'], now() - interval '20 hours', NULL, false, '9a000000-0000-0000-0000-000000000002', ARRAY['copy','navigation','accessibility'], NULL),
  ('9e100000-0000-0000-0000-000000000009','90000000-0000-0000-0000-000000000001','progress_update','Kite milestone: encrypted at rest lands',
   'Storage is now encrypted with a key derived from your account passphrase. Trade-off note in the README for anyone running the nightly image.',
   'General', ARRAY['go','security'], now() - interval '10 days', NULL, false, '9a000000-0000-0000-0000-000000000001', NULL, NULL),
  ('9e100000-0000-0000-0000-000000000010','90000000-0000-0000-0000-000000000005','announcement','We open the Crafts Shed this week',
   'The Shed is a space for people who make things and need company while they do. Work in progress belongs here; help comes before critique. Doors open Thursday.',
   'General', ARRAY['community-management','storytelling'], now() - interval '4 days', '9a200000-0000-0000-0000-000000000001', true, NULL, NULL, NULL),
  ('9e100000-0000-0000-0000-000000000011','90000000-0000-0000-0000-000000000003','open_role','Sloop needs a docs writer (I see you, writers)',
   'The README lies and I am tired of fighting it. Looking for someone to turn the notes into a manual people trust. Fully remote, fully credited, zero meetings.
',
   'General', ARRAY['technical-writing'], now() - interval '7 days', NULL, false, '9a000000-0000-0000-0000-000000000003', NULL, NULL),
  ('9e100000-0000-0000-0000-000000000012','90000000-0000-0000-0000-000000000006','showcase','My first go program that does something on its own',
   'It reads a folder, prints the files, and exits with a color. Nothing pirate-grade, but it is mine. Thank you for the directions this week.',
   'General', ARRAY['go'], now() - interval '6 hours', '9a200000-0000-0000-0000-000000000001', false, NULL, NULL, 'first build')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.comments (id, post_id, author_id, body, is_best_answer, parent_id, created_at)
VALUES
  ('9ee00000-0000-0000-0000-000000000001','9e100000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','The write-ahead log answers this in practice: resolve the happy path, keep the conflict row, expose it as a review queue.', false, NULL, now() - interval '4 days'),
  ('9ee00000-0000-0000-0000-000000000002','9e100000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000003','Encrypt before write, not after. And never sync the same encryption key across devices.', false, NULL, now() - interval '4 days'),
  ('9ee00000-0000-0000-0000-000000000003','9e100000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000001','Start with the tour and one tiny endpoint. A folder layout teaches you nothing; a project with one route teaches you everything.', false, NULL, now() - interval '3 days'),
  ('9ee00000-0000-0000-0000-000000000004','9e100000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000008','I wrote this exact first project as a post. Follow the tour, then delete the tour and rebuild it by hand. That second pass is where it clicks.', false, NULL, now() - interval '3 days'),
  ('9ee00000-0000-0000-0000-000000000005','9e100000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000004','Come to the Go study session on Thursday; bring the hello program, we will make it a server in an hour.', false, NULL, now() - interval '3 days'),
  ('9ee00000-0000-0000-0000-000000000006','9e100000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000001','ClickHouse for the long tail, plain files for the young rows. Sloop is basically that split under one CLI.', false, NULL, now() - interval '2 days'),
  ('9ee00000-0000-0000-0000-000000000007','9e100000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000008','Files plus a tiny reader service got me through three years of homelab without a vendor.', false, NULL, now() - interval '29 hours'),
  ('9ee00000-0000-0000-0000-000000000008','9e100000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000003','Concur on the healthcheck mistake; usually the first thing to bite people with containers.', false, NULL, now() - interval '8 days'),
  ('9ee00000-0000-0000-0000-000000000009','9e100000-0000-0000-0000-000000000007','90000000-0000-0000-0000-000000000002','Built-in forms are plenty until you need one shared draft across two surfaces. By then you will know why.', false, NULL, now() - interval '3 days'),
  ('9ee00000-0000-0000-0000-000000000010','9e100000-0000-0000-0000-000000000008','90000000-0000-0000-0000-000000000008','Schedule reads like an admin page. Try Full table of contents and add the aria label to the icon.', true, NULL, now() - interval '19 hours'),
  ('9ee00000-0000-0000-0000-000000000011','9e100000-0000-0000-0000-000000000008','90000000-0000-0000-0000-000000000006','As someone who reads through screen readers some nights, along with the plain-eyes pass, check the order the labels hit the tree.', false, NULL, now() - interval '18 hours'),
  ('9ee00000-0000-0000-0000-000000000012','9e100000-0000-0000-0000-000000000009','90000000-0000-0000-0000-000000000004','Great call on the storage tier. Ship the trade-off note as a banner in beta, not just a README footnote.', false, NULL, now() - interval '9 days'),
  ('9ee00000-0000-0000-0000-000000000013','9e100000-0000-0000-0000-000000000010','90000000-0000-0000-0000-000000000006','Joined. Bring requests for audio tutorials, the Shed asked and I deliver.',
 false, NULL, now() - interval '3 days'),
  ('9ee00000-0000-0000-0000-000000000014','9e100000-0000-0000-0000-000000000011','90000000-0000-0000-0000-000000000008','Docs writer found, thank you. Manual first pass lands in the repo this week.', false, NULL, now() - interval '6 days'),
  ('9ee00000-0000-0000-0000-000000000015','9e100000-0000-0000-0000-000000000012','90000000-0000-0000-0000-000000000001','That is the whole job. Colors are a luxury; structure is the craft. Bring the next one to the study session.', false, NULL, now() - interval '5 hours'),
  ('9ee00000-0000-0000-0000-000000000016','9e100000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000005','Echoing rin: make it print a file count, then make it walk a folder. Small wins compound.', false, NULL, now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.post_actions (id, post_id, user_id, action, created_at)
SELECT v.id, v.post_id, v.user_id, v.action::public.post_action, v.created_at
FROM (VALUES
  ('9ef00000-0000-0000-0000-000000000001','9e100000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000004','like', now() - interval '10 days'),
  ('9ef00000-0000-0000-0000-0000-000000000002','9e100000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','like', now() - interval '4 days'),
  ('9ef00000-0000-0000-0000-0000-000000000003','9e100000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000006','like', now() - interval '4 days'),
  ('9ef00000-0000-0000-0000-000000000004','9e100000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000001','helpful', now() - interval '3 days'),
  ('9ef00000-0000-0000-0000-000000000005','9e100000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000002','helpful', now() - interval '3 days'),
  ('9ef00000-0000-0000-0000-000000000006','9e100000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000005','like', now() - interval '3 days'),
  ('9ef00000-0000-0000-0000-000000000007','9e100000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000007','like', now() - interval '3 days'),
  ('9ef00000-0000-0000-0000-000000000008','9e100000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000004','helpful', now() - interval '8 days'),
  ('9ef00000-0000-0000-0000-000000000009','9e100000-0000-0000-0000-000000000006','90000000-0000-0000-0000-000000000008','like', now() - interval '5 days'),
  ('9ef00000-0000-0000-0000-000000000010','9e100000-0000-0000-0000-000000000007','90000000-0000-0000-0000-000000000002','like', now() - interval '3 days'),
  ('9ef00000-0000-0000-0000-000000000011','9e100000-0000-0000-0000-000000000010','90000000-0000-0000-0000-000000000001','like', now() - interval '3 days'),
  ('9ef00000-0000-0000-0000-000000000012','9e100000-0000-0000-0000-000000000010','90000000-0000-0000-0000-000000000004','like', now() - interval '3 days'),
  ('9ef00000-0000-0000-0000-000000000013','9e100000-0000-0000-0000-000000000011','90000000-0000-0000-0000-000000000008','save', now() - interval '6 days'),
  ('9ef00000-0000-0000-0000-000000000014','9e100000-0000-0000-0000-000000000012','90000000-0000-0000-0000-000000000001','like', now() - interval '5 hours'),
  ('9ef00000-0000-0000-0000-000000000015','9e100000-0000-0000-0000-000000000012','90000000-0000-0000-0000-000000000003','like', now() - interval '5 hours')
) AS v(id, post_id, user_id, action, created_at)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10. Connections + follows (personas linked to each other and to the test user)
-- ---------------------------------------------------------------------------
INSERT INTO public.connections (id, requester_id, addressee_id, status, intro_message, created_at)
VALUES
  ('9e200000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','accepted','Your reading-mode post changed how I look at sync settings. Happy to compare notes.', now() - interval '20 days'),
  ('9e200000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000001','accepted','Saw Kite on the feed; the write-ahead log idea has legs.', now() - interval '15 days'),
  ('9e200000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000001','accepted','Opening the Crafts Shed soon; could use a builder opinion on the space.', now() - interval '12 days'),
  ('9e200000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000002','accepted','Love what you are doing with Lumina. Have waitlist ideas when you want them.', now() - interval '10 days'),
  ('9e200000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000008','90000000-0000-0000-0000-000000000003','accepted','Your docs writer call found me. Manual first pass up this week.', now() - interval '15 days'),
  ('9e200000-0000-0000-0000-000000000006','90000000-0000-0000-0000-000000000006','90000000-0000-0000-0000-000000000001','pending','Two weeks in, your posts were the path. May I pester you with beginner questions?', now() - interval '2 days'),
  ('9e200000-0000-0000-0000-000000000007','90000000-0000-0000-0000-000000000006','90000000-0000-0000-0000-000000000004','pending','The Go study session seems like exactly where I belong.', now() - interval '1 day'),
  ('9e200000-0000-0000-0000-000000000008','812d3c58-91ed-4956-99ac-9ffa4b41212c','90000000-0000-0000-0000-000000000001','accepted','Testing the sync loop with you, if you do not mind.', now() - interval '3 days'),
  ('9e200000-0000-0000-0000-000000000009','812d3c58-91ed-4956-99ac-9ffa4b41212c','90000000-0000-0000-0000-000000000005','pending','Would love to bring a project to the Shed.', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.follows (follower_id, following_id, created_at)
SELECT * FROM (VALUES
  ('90000000-0000-0000-0000-000000000006'::uuid,'90000000-0000-0000-0000-000000000001'::uuid, now() - interval '3 weeks'),
  ('90000000-0000-0000-0000-000000000006','90000000-0000-0000-0000-000000000004', now() - interval '2 weeks'),
  ('90000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000001', now() - interval '3 weeks'),
  ('90000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000007', now() - interval '6 weeks'),
  ('90000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000001', now() - interval '2 weeks'),
  ('90000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000002', now() - interval '4 weeks'),
  ('90000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000005', now() - interval '3 weeks'),
  ('90000000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000007', now() - interval '6 weeks'),
  ('90000000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000008', now() - interval '3 weeks'),
  ('90000000-0000-0000-0000-000000000007','90000000-0000-0000-0000-000000000008', now() - interval '2 months'),
  ('90000000-0000-0000-0000-000000000008','90000000-0000-0000-0000-000000000003', now() - interval '2 weeks'),
  ('90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000003', now() - interval '1 week'),
  ('812d3c58-91ed-4956-99ac-9ffa4b41212c','90000000-0000-0000-0000-000000000001', now() - interval '3 days'),
  ('812d3c58-91ed-4956-99ac-9ffa4b41212c','90000000-0000-0000-0000-000000000002', now() - interval '3 days'),
  ('812d3c58-91ed-4956-99ac-9ffa4b41212c','90000000-0000-0000-0000-000000000005', now() - interval '3 days')
) AS v(follower_id, following_id, created_at)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 11. Sessions
-- ---------------------------------------------------------------------------
INSERT INTO public.sessions
  (id, organizer_id, title, description, session_type, status, skill_id, project_id,
   starts_at, ends_at, duration_minutes, timezone, is_recurring)
VALUES
  ('9e300000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000003','Sloop build night','Ship the retention tiers, answer questions, no slides.','project_meeting','scheduled',NULL,'9a000000-0000-0000-0000-000000000003', now() + interval '2 days', now() + interval '2 days 90 minutes', 90, 'Europe/Berlin', false),
  ('9e300000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000004','Go study session','Bring hello world; leave with a tiny server. Open to total beginners.','study_session','scheduled','go',NULL, now() + interval '3 days', now() + interval '3 days 1 hour', 60, 'Asia/Seoul', true),
  ('9e300000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000002','Lumina reading-mode critique','Group critique of the spacing ladder and nav labels.','workshop','scheduled',NULL,'9a000000-0000-0000-0000-000000000002', now() + interval '5 days', now() + interval '5 days 2 hours', 120, 'America/Mexico_City', false),
  ('9e300000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000008','Writing lab: first technical post','One hour, one post, one round of honest feedback.','mentoring','completed',NULL,NULL, now() - interval '8 days', now() - interval '8 days 1 hour', 60, 'America/Toronto', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.session_participants (id, session_id, profile_id, role, status, responded_at, created_at)
VALUES
  ('9e400000-0000-0000-0000-000000000001','9e300000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000003','organizer','accepted', now() - interval '6 days', now() - interval '6 days'),
  ('9e400000-0000-0000-0000-000000000002','9e300000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','participant','accepted', now() - interval '5 days', now() - interval '5 days'),
  ('9e400000-0000-0000-0000-000000000003','9e300000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000008','participant','invited', NULL, now() - interval '4 days'),
  ('9e400000-0000-0000-0000-000000000004','9e300000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000004','organizer','accepted', now() - interval '3 days', now() - interval '3 days'),
  ('9e400000-0000-0000-0000-000000000005','9e300000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000006','participant','invited', NULL, now() - interval '2 days'),
  ('9e400000-0000-0000-0000-000000000006','9e300000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000001','mentor','invited', NULL, now() - interval '2 days'),
  ('9e400000-0000-0000-0000-000000000007','9e300000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000002','organizer','accepted', now() - interval '4 days', now() - interval '4 days'),
  ('9e400000-0000-0000-0000-000000000008','9e300000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000007','participant','accepted', now() - interval '3 days', now() - interval '3 days'),
  ('9e400000-0000-0000-0000-000000000009','9e300000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000004','participant','accepted', now() - interval '3 days', now() - interval '3 days'),
  ('9e400000-0000-0000-0000-000000000010','9e300000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000008','organizer','accepted', now() - interval '9 days', now() - interval '9 days'),
  ('9e400000-0000-0000-0000-000000000011','9e300000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000006','participant','accepted', now() - interval '8 days', now() - interval '8 days')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 12. Challenge participation (reuses the 5 starter challenges)
-- ---------------------------------------------------------------------------
ALTER TABLE public.challenge_participants DISABLE TRIGGER enforce_challenge_review_insert;
ALTER TABLE public.challenge_participants DISABLE TRIGGER enforce_challenge_review_transition;

INSERT INTO public.challenge_participants
  (challenge_id, user_id, status, progress, joined_at, submission_url,
   submission_note, submitted_at, review_status, reviewer_note, reviewed_at)
VALUES
  ('4a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','completed','{"progress":100}', now() - interval '30 days', 'https://lum.app',
   'Shipped the reading environment as my one-page portfolio project.', now() - interval '20 days', 'passed', 'Clean hierarchy, strong focus states. Pass.', now() - interval '20 days'),
  ('4a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000004','in_progress','{"progress":70}', now() - interval '6 days', NULL, NULL, NULL, 'none', NULL, NULL),
  ('4a000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000008','joined','{}', now() - interval '2 days', NULL, NULL, NULL, 'none', NULL, NULL),
  ('4a000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000008','completed','{"progress":100}', now() - interval '20 days', 'https://samcarter.writing/self-hosting',
   'Self-hosting a Go service with Docker, with the three mistakes everyone makes.', now() - interval '9 days', 'passed', 'Practical, well-paced, generously nested. Pass.', now() - interval '9 days'),
  ('4a000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000003','in_progress','{"progress":40}', now() - interval '5 days', NULL, NULL, NULL, 'none', NULL, NULL),
  ('4a000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000001','joined','{}', now() - interval '1 day', NULL, NULL, NULL, 'none', NULL, NULL),
  ('4a000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000002','completed','{"progress":100}', now() - interval '18 days', 'https://github.com/ana-vasquez/lumina/pull/41',
   'ARIA label and tree-order fixes from the weekly audit.', now() - interval '11 days', 'passed', 'Documented, tested against two screen readers. Pass.', now() - interval '11 days'),
  ('4a000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000007','joined','{}', now() - interval '3 days', NULL, NULL, NULL, 'none', NULL, NULL),
  ('4a000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000001','completed','{"progress":100}', now() - interval '25 days', 'https://github.com/rin-sato/kite/releases/cli-v0.4',
   'kite-cli: paste history searchable from a terminal.', now() - interval '16 days', 'passed', 'Tight little tool, ships in the README. Pass.', now() - interval '16 days'),
  ('4a000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000003','joined','{}', now() - interval '2 days', NULL, NULL, NULL, 'none', NULL, NULL),
  ('4a000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000006','joined','{}', now() - interval '1 day', NULL, NULL, NULL, 'none', NULL, NULL),
  ('4a000000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000001','completed','{"progress":100}', now() - interval '12 days', 'https://kite.dev/cadence-intro',
   'Two-minute update introducing Cadence.', now() - interval '5 days', 'passed', 'Clear intro, shows the mood board. Pass.', now() - interval '5 days'),
  ('4a000000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000005','completed','{"progress":100}', now() - interval '12 days', 'https://vimeo.com/crafts-shed-intro',
   'Open house intro for the first session.', now() - interval '5 days', 'passed', 'Warm, honest, community forward. Pass.', now() - interval '5 days'),
  ('4a000000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000004','joined','{}', now() - interval '2 days', NULL, NULL, NULL, 'none', NULL, NULL)
ON CONFLICT DO NOTHING;

ALTER TABLE public.challenge_participants ENABLE TRIGGER enforce_challenge_review_insert;
ALTER TABLE public.challenge_participants ENABLE TRIGGER enforce_challenge_review_transition;

-- ---------------------------------------------------------------------------
-- 13. Reputation log + activity events
-- ---------------------------------------------------------------------------
INSERT INTO public.contribution_log (id, profile_id, category, action, points, metadata, created_at)
VALUES
  ('9e500000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','community','joined_tethyr',10,'{}', now() - interval '5 months'),
  ('9e500000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000001','project_impact','milestone_completed',5,'{"project_id":"9a000000-0000-0000-0000-000000000001"}', now() - interval '45 days'),
  ('9e500000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000001','learning','helped_on_feed',3,'{"post_id":"9e100000-0000-0000-0000-000000000003"}', now() - interval '3 days'),
  ('9e500000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000002','community','joined_tethyr',10,'{}', now() - interval '4 months'),
  ('9e500000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000003','community','joined_tethyr',10,'{}', now() - interval '6 months'),
  ('9e500000-0000-0000-0000-000000000006','90000000-0000-0000-0000-000000000004','community','joined_tethyr',10,'{}', now() - interval '10 months'),
  ('9e500000-0000-0000-0000-000000000007','90000000-0000-0000-0000-000000000005','community','joined_tethyr',10,'{}', now() - interval '8 months'),
  ('9e500000-0000-0000-0000-000000000008','90000000-0000-0000-0000-000000000006','community','joined_tethyr',10,'{}', now() - interval '3 weeks'),
  ('9e500000-0000-0000-0000-000000000009','90000000-0000-0000-0000-000000000007','community','joined_tethyr',10,'{}', now() - interval '7 months'),
  ('9e500000-0000-0000-0000-000000000010','90000000-0000-0000-0000-000000000008','community','joined_tethyr',10,'{}', now() - interval '9 months')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.activity_events (id, profile_id, kind, metadata, created_at)
VALUES
  ('9e600000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','project_published','{"title":"Kite"}', now() - interval '5 months'),
  ('9e600000-0000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000001','joined_tethyr','{}', now() - interval '5 months'),
  ('9e600000-0000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000001','skill_teach_added','{"skill_name":"Go"}', now() - interval '4 months'),
  ('9e600000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000002','project_published','{"title":"Lumina"}', now() - interval '4 months'),
  ('9e600000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000002','joined_tethyr','{}', now() - interval '4 months'),
  ('9e600000-0000-0000-0000-0000-000000000006','90000000-0000-0000-0000-000000000003','project_published','{"title":"Sloop"}', now() - interval '6 months'),
  ('9e600000-0000-0000-0000-0000-000000000007','90000000-0000-0000-0000-000000000003','joined_tethyr','{}', now() - interval '6 months'),
  ('9e600000-0000-0000-0000-0000-000000000008','90000000-0000-0000-0000-000000000005','project_published','{"title":"Field Notes"}', now() - interval '6 weeks'),
  ('9e600000-0000-0000-0000-0000-000000000009','90000000-0000-0000-0000-000000000007','project_published','{"title":"Field Notes"}', now() - interval '7 months'),
  ('9e600000-0000-0000-0000-000000000010','90000000-0000-0000-0000-000000000007','skill_teach_added','{"skill_name":"Illustration"}', now() - interval '6 months'),
  ('9e600000-0000-0000-0000-000000000011','90000000-0000-0000-0000-000000000006','joined_tethyr','{}', now() - interval '3 weeks'),
  ('9e600000-0000-0000-0000-000000000012','90000000-0000-0000-0000-000000000005','skill_teach_added','{"skill_name":"Community Management"}', now() - interval '7 months')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 14. Stored layouts for persona + project pages (block arrangement per page)
-- ---------------------------------------------------------------------------
INSERT INTO public.layouts
  (id, name, description, type, category, theme_id, sections, is_template, created_by, usage_count, fork_count, created_at, updated_at)
VALUES
  ('9a300000-0000-0000-0000-000000000001','Rin · Kite Workspace','Compact studio: skills beside projects, tools and gallery below.','standard','profile','00000000-0000-0000-0000-000000000011',
   '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-header","position":0,"config":{"showTitle":true,"showHandle":true,"showLocation":true,"showReputation":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"divider","position":0,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"full","blocks":[{"id":"b3","type":"profile-bio","position":0,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"two_column","blocks":[{"id":"b4","type":"profile-skills","position":0,"config":{},"visible":true},{"id":"b5","type":"profile-projects","position":1,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b6","type":"profile-tools","position":0,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b7","type":"profile-gallery","position":0,"config":{},"visible":true}]},{"id":"s7","position":6,"layout":"full","blocks":[{"id":"b8","type":"profile-links","position":0,"config":{},"visible":true}]},{"id":"s8","position":7,"layout":"full","blocks":[{"id":"b9","type":"profile-achievements","position":0,"config":{},"visible":true}]}]',
   false,'90000000-0000-0000-0000-000000000001',1,0, now() - interval '2 months', now() - interval '2 months'),
  ('9a300000-0000-0000-0000-000000000002','Ana · Lumina Studio','Evidence-first studio: direction and projects, reading settings, gallery.','standard','profile','00000000-0000-0000-0000-000000000013',
   '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-header","position":0,"config":{"showTitle":true,"showHandle":true,"showLocation":true,"showReputation":true},"visible":true}]},{"id":"s2","position":1,"layout":"two_column","blocks":[{"id":"b2","type":"profile-bio","position":0,"config":{},"visible":true},{"id":"b3","type":"profile-direction","position":1,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"full","blocks":[{"id":"b4","type":"profile-projects","position":0,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"two_column","blocks":[{"id":"b5","type":"profile-skills","position":0,"config":{},"visible":true},{"id":"b6","type":"profile-experience","position":1,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"two_column","blocks":[{"id":"b7","type":"profile-tools","position":0,"config":{},"visible":true},{"id":"b8","type":"profile-links","position":1,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b9","type":"profile-gallery","position":0,"config":{},"visible":true}]},{"id":"s7","position":6,"layout":"full","blocks":[{"id":"b10","type":"profile-achievements","position":0,"config":{},"visible":true}]}]',
   false,'90000000-0000-0000-0000-000000000002',1,0, now() - interval '2 months', now() - interval '2 months'),
  ('9a300000-0000-0000-0000-000000000003','Marcus · Terminal Studio','Spare layout, plain text energy: skills beside bio, projects, tools.','standard','profile','00000000-0000-0000-0000-000000000012',
   '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-header","position":0,"config":{"showTitle":true,"showHandle":true,"showLocation":true,"showReputation":true},"visible":true}]},{"id":"s2","position":1,"layout":"two_column","blocks":[{"id":"b2","type":"profile-bio","position":0,"config":{},"visible":true},{"id":"b3","type":"profile-skills","position":1,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"full","blocks":[{"id":"b4","type":"profile-projects","position":0,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"two_column","blocks":[{"id":"b5","type":"profile-tools","position":0,"config":{},"visible":true},{"id":"b6","type":"profile-experience","position":1,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b7","type":"profile-links","position":0,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b8","type":"profile-achievements","position":0,"config":{},"visible":true}]}]',
   false,'90000000-0000-0000-0000-000000000003',1,0, now() - interval '2 months', now() - interval '2 months'),
  ('9a300000-0000-0000-0000-000000000004','Misaa · Quiet Launchpad','Minimal studio: bio, experience, then the work, then the shelf.','standard','profile','00000000-0000-0000-0000-000000000010',
   '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-header","position":0,"config":{"showTitle":true,"showHandle":true,"showLocation":true,"showReputation":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"profile-bio","position":0,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"two_column","blocks":[{"id":"b3","type":"profile-experience","position":0,"config":{},"visible":true},{"id":"b4","type":"profile-skills","position":1,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"full","blocks":[{"id":"b5","type":"profile-gallery","position":0,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b6","type":"profile-projects","position":0,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b7","type":"profile-links","position":0,"config":{},"visible":true}]},{"id":"s7","position":6,"layout":"full","blocks":[{"id":"b8","type":"profile-achievements","position":0,"config":{},"visible":true}]}]',
   false,'90000000-0000-0000-0000-000000000004',1,0, now() - interval '2 months', now() - interval '2 months'),
  ('9a300000-0000-0000-0000-000000000005','Ola · The Shed','Door-open studio: direction up top, community projects, warm shelf.','standard','profile','00000000-0000-0000-0000-000000000021',
   '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-header","position":0,"config":{"showTitle":true,"showHandle":true,"showLocation":true,"showReputation":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"profile-direction","position":0,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"full","blocks":[{"id":"b3","type":"profile-bio","position":0,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"full","blocks":[{"id":"b4","type":"profile-projects","position":0,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"two_column","blocks":[{"id":"b5","type":"profile-skills","position":0,"config":{},"visible":true},{"id":"b6","type":"profile-links","position":1,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b7","type":"profile-gallery","position":0,"config":{},"visible":true}]},{"id":"s7","position":6,"layout":"full","blocks":[{"id":"b8","type":"profile-achievements","position":0,"config":{},"visible":true}]}]',
   false,'90000000-0000-0000-0000-000000000005',1,0, now() - interval '2 months', now() - interval '2 months'),
  ('9a300000-0000-0000-0000-000000000006','Dee · First Session','Beginner studio: gallery up top, shelves, and nowhere to hide.','standard','profile','00000000-0000-0000-0000-000000000022',
   '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-header","position":0,"config":{"showTitle":true,"showHandle":true,"showLocation":true,"showReputation":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"profile-gallery","position":0,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"two_column","blocks":[{"id":"b3","type":"profile-projects","position":0,"config":{},"visible":true},{"id":"b4","type":"profile-links","position":1,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"full","blocks":[{"id":"b5","type":"profile-skills","position":0,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"two_column","blocks":[{"id":"b6","type":"profile-tools","position":0,"config":{},"visible":true},{"id":"b7","type":"profile-experience","position":1,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b8","type":"profile-direction","position":0,"config":{},"visible":true}]},{"id":"s7","position":6,"layout":"full","blocks":[{"id":"b9","type":"profile-achievements","position":0,"config":{},"visible":true}]}]',
   false,'90000000-0000-0000-0000-000000000006',1,0, now() - interval '7 days', now() - interval '7 days'),
  ('9a300000-0000-0000-0000-000000000007','Yuki · Paper Cuts','Gallery-forward studio for the zine, shelves last.','standard','profile','00000000-0000-0000-0000-000000000017',
   '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-header","position":0,"config":{"showTitle":true,"showHandle":true,"showLocation":true,"showReputation":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"profile-gallery","position":0,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"two_column","blocks":[{"id":"b3","type":"profile-skills","position":0,"config":{},"visible":true},{"id":"b4","type":"profile-projects","position":1,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"full","blocks":[{"id":"b5","type":"profile-direction","position":0,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b6","type":"profile-links","position":0,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b7","type":"profile-achievements","position":0,"config":{},"visible":true}]}]',
   false,'90000000-0000-0000-0000-000000000007',1,0, now() - interval '6 weeks', now() - interval '6 weeks'),
  ('9a300000-0000-0000-0000-000000000008','Sam · Writers Desk','Typographic studio: bio, projects beside experience, links then shelf.','standard','profile','00000000-0000-0000-0000-000000000014',
   '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"profile-header","position":0,"config":{"showTitle":true,"showHandle":true,"showLocation":true,"showReputation":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"profile-bio","position":0,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"two_column","blocks":[{"id":"b3","type":"profile-projects","position":0,"config":{},"visible":true},{"id":"b4","type":"profile-experience","position":1,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"two_column","blocks":[{"id":"b5","type":"profile-skills","position":0,"config":{},"visible":true},{"id":"b6","type":"profile-tools","position":1,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b7","type":"profile-links","position":0,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b8","type":"profile-achievements","position":0,"config":{},"visible":true}]},{"id":"s7","position":6,"layout":"full","blocks":[{"id":"b9","type":"profile-gallery","position":0,"config":{},"visible":true}]}]',
   false,'90000000-0000-0000-0000-000000000008',1,0, now() - interval '2 months', now() - interval '2 months'),
  ('9a300000-0000-0000-0000-000000000101','Kite Project Page','Full workspace layout: hero, about, status and milestones, team, files, repos, needs, sessions, evidence, credits, activity.','standard','project','00000000-0000-0000-0000-000000000011',
   '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":true,"showTags":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"divider","position":0,"config":{},"visible":true},{"id":"b3","type":"project-about","position":1,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"two_column","blocks":[{"id":"b4","type":"project-status","position":0,"config":{},"visible":true},{"id":"b5","type":"project-milestones","position":1,"config":{"showDueDates":true,"showDescriptions":true},"visible":true}]},{"id":"s4","position":3,"layout":"two_column","blocks":[{"id":"b6","type":"project-team","position":0,"config":{},"visible":true},{"id":"b7","type":"project-roles","position":1,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b8","type":"project-files","position":0,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b9","type":"project-repos","position":0,"config":{},"visible":true}]},{"id":"s7","position":6,"layout":"two_column","blocks":[{"id":"b10","type":"project-needs","position":0,"config":{},"visible":true},{"id":"b11","type":"project-discussions","position":1,"config":{},"visible":true}]},{"id":"s8","position":7,"layout":"full","blocks":[{"id":"b12","type":"project-sessions","position":0,"config":{},"visible":true}]},{"id":"s9","position":8,"layout":"full","blocks":[{"id":"b13","type":"project-evidence","position":0,"config":{},"visible":true}]},{"id":"s10","position":9,"layout":"full","blocks":[{"id":"b14","type":"project-credits","position":0,"config":{},"visible":true}]},{"id":"s11","position":10,"layout":"full","blocks":[{"id":"b15","type":"project-activity","position":0,"config":{},"visible":true}]},{"id":"s12","position":11,"layout":"full","blocks":[{"id":"b16","type":"project-timeline","position":0,"config":{},"visible":true}]}]',
   false,'90000000-0000-0000-0000-000000000001',1,0, now() - interval '2 months', now() - interval '2 months'),
  ('9a300000-0000-0000-0000-000000000102','Lumina Project Page','Paper workspace: hero, about, status and milestones, team, repositories, needs, evidence, activity.','standard','project','00000000-0000-0000-0000-000000000013',
   '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":true,"showTags":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"divider","position":0,"config":{},"visible":true},{"id":"b3","type":"project-about","position":1,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"two_column","blocks":[{"id":"b4","type":"project-status","position":0,"config":{},"visible":true},{"id":"b5","type":"project-milestones","position":1,"config":{"showDueDates":true,"showDescriptions":true},"visible":true}]},{"id":"s4","position":3,"layout":"two_column","blocks":[{"id":"b6","type":"project-team","position":0,"config":{},"visible":true},{"id":"b7","type":"project-roles","position":1,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b8","type":"project-repos","position":0,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"two_column","blocks":[{"id":"b9","type":"project-needs","position":0,"config":{},"visible":true},{"id":"b10","type":"project-discussions","position":1,"config":{},"visible":true}]},{"id":"s7","position":6,"layout":"full","blocks":[{"id":"b11","type":"project-evidence","position":0,"config":{},"visible":true}]},{"id":"s8","position":7,"layout":"full","blocks":[{"id":"b12","type":"project-activity","position":0,"config":{},"visible":true}]},{"id":"s9","position":8,"layout":"full","blocks":[{"id":"b13","type":"project-timeline","position":0,"config":{},"visible":true}]}]',
   false,'90000000-0000-0000-0000-000000000002',1,0, now() - interval '2 months', now() - interval '2 months'),
  ('9a300000-0000-0000-0000-000000000103','Sloop Project Page','Terminal workspace: hero, about, status and timeline, team, repos, needs, activity.','standard','project','00000000-0000-0000-0000-000000000012',
   '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":true,"showTags":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"divider","position":0,"config":{},"visible":true},{"id":"b3","type":"project-about","position":1,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"two_column","blocks":[{"id":"b4","type":"project-status","position":0,"config":{},"visible":true},{"id":"b5","type":"project-timeline","position":1,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"two_column","blocks":[{"id":"b6","type":"project-team","position":0,"config":{},"visible":true},{"id":"b7","type":"project-roles","position":1,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b8","type":"project-repos","position":0,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b9","type":"project-needs","position":0,"config":{},"visible":true}]},{"id":"s7","position":6,"layout":"full","blocks":[{"id":"b10","type":"project-activity","position":0,"config":{},"visible":true}]}]',
   false,'90000000-0000-0000-0000-000000000003',1,0, now() - interval '2 months', now() - interval '2 months'),
  ('9a300000-0000-0000-0000-000000000104','Field Notes Project Page','Minimal workspace for a shipped zine: hero, about, evidence, credits, activity, timeline.','standard','project','00000000-0000-0000-0000-000000000010',
   '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":true,"showTags":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"divider","position":0,"config":{},"visible":true},{"id":"b3","type":"project-about","position":1,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"full","blocks":[{"id":"b4","type":"project-evidence","position":0,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"full","blocks":[{"id":"b5","type":"project-credits","position":0,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b6","type":"project-activity","position":0,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b7","type":"project-timeline","position":0,"config":{},"visible":true}]}]',
   false,'90000000-0000-0000-0000-000000000007',1,0, now() - interval '6 weeks', now() - interval '6 weeks'),
  ('9a300000-0000-0000-0000-000000000105','Cadence Project Page','Plan-stage workspace: hero, about, evidence, credits, timeline.','standard','project','00000000-0000-0000-0000-000000000022',
   '[{"id":"s1","position":0,"layout":"full","blocks":[{"id":"b1","type":"project-hero","position":0,"config":{"showDescription":true,"showProgress":true,"showTags":true},"visible":true}]},{"id":"s2","position":1,"layout":"full","blocks":[{"id":"b2","type":"divider","position":0,"config":{},"visible":true},{"id":"b3","type":"project-about","position":1,"config":{},"visible":true}]},{"id":"s3","position":2,"layout":"full","blocks":[{"id":"b4","type":"project-evidence","position":0,"config":{},"visible":true}]},{"id":"s4","position":3,"layout":"full","blocks":[{"id":"b5","type":"project-credits","position":0,"config":{},"visible":true}]},{"id":"s5","position":4,"layout":"full","blocks":[{"id":"b6","type":"project-activity","position":0,"config":{},"visible":true}]},{"id":"s6","position":5,"layout":"full","blocks":[{"id":"b7","type":"project-timeline","position":0,"config":{},"visible":true}]}]',
   false,'90000000-0000-0000-0000-000000000001',1,0, now() - interval '3 weeks', now() - interval '3 weeks')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 15. Pages — publish the persona studios + project pages
-- ---------------------------------------------------------------------------
INSERT INTO public.pages
  (id, owner_id, owner_type, layout_id, theme_id, status, published_at, created_at, updated_at)
VALUES
  ('9a400000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','profile','9a300000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','published', now() - interval '2 months', now() - interval '2 months', now() - interval '2 months'),
  ('9a400000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002','profile','9a300000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000013','published', now() - interval '2 months', now() - interval '2 months', now() - interval '2 months'),
  ('9a400000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000003','profile','9a300000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000012','published', now() - interval '2 months', now() - interval '2 months', now() - interval '2 months'),
  ('9a400000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000004','profile','9a300000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000010','published', now() - interval '2 months', now() - interval '2 months', now() - interval '2 months'),
  ('9a400000-0000-0000-0000-000000000005','90000000-0000-0000-0000-000000000005','profile','9a300000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000021','published', now() - interval '2 months', now() - interval '2 months', now() - interval '2 months'),
  ('9a400000-0000-0000-0000-000000000006','90000000-0000-0000-0000-000000000006','profile','9a300000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000022','published', now() - interval '7 days', now() - interval '7 days', now() - interval '7 days'),
  ('9a400000-0000-0000-0000-000000000007','90000000-0000-0000-0000-000000000007','profile','9a300000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000017','published', now() - interval '6 weeks', now() - interval '6 weeks', now() - interval '6 weeks'),
  ('9a400000-0000-0000-0000-000000000008','90000000-0000-0000-0000-000000000008','profile','9a300000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000014','published', now() - interval '2 months', now() - interval '2 months', now() - interval '2 months'),
  ('9a400000-0000-0000-0000-000000000101','9a000000-0000-0000-0000-000000000001','project','9a300000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000011','published', now() - interval '2 months', now() - interval '2 months', now() - interval '2 months'),
  ('9a400000-0000-0000-0000-000000000102','9a000000-0000-0000-0000-000000000002','project','9a300000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000013','published', now() - interval '2 months', now() - interval '2 months', now() - interval '2 months'),
  ('9a400000-0000-0000-0000-000000000103','9a000000-0000-0000-0000-000000000003','project','9a300000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000012','published', now() - interval '2 months', now() - interval '2 months', now() - interval '2 months'),
  ('9a400000-0000-0000-0000-000000000104','9a000000-0000-0000-0000-000000000004','project','9a300000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000010','published', now() - interval '6 weeks', now() - interval '6 weeks', now() - interval '6 weeks'),
  ('9a400000-0000-0000-0000-000000000105','9a000000-0000-0000-0000-000000000005','project','9a300000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000022','published', now() - interval '3 weeks', now() - interval '3 weeks', now() - interval '3 weeks')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 16. Backfill achievements for every profile so everything looks lived-in
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM set_config('request.jwt.claim.sub', r.id::text, true);
    PERFORM public.award_earned_achievements();
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;