-- ============================================================================
-- DEMO SEED — temporary mock data for local testing only.
-- Do NOT run against production. Delete this file when done, or run
-- `supabase db reset` to wipe back to just the test user.
--
-- Populates: extra profiles, projects across every stage, milestones, open
-- roles, contributors, needs, updates, discussions, community spaces, posts,
-- comments, challenges, sessions, connections, and reputation/activity.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Auth users for mock profiles (profiles.id requires an auth.users row)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pw_hash text := crypt('password123', gen_salt('bf', 10));
BEGIN
  INSERT INTO auth.users
    (instance_id, id, aud, role, email, encrypted_password,
     email_confirmed_at, invited_at,
     confirmation_token, confirmation_sent_at,
     recovery_token, recovery_sent_at,
     email_change_token_new, email_change, email_change_sent_at,
     email_change_token_current, email_change_confirm_status,
     phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
     last_sign_in_at,
     raw_app_meta_data, raw_user_meta_data,
     is_super_admin, is_anonymous, is_sso_user,
     created_at, updated_at)
  VALUES
    ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000001','authenticated','authenticated','maya@tethyr.dev',pw_hash,now(),NULL,'',NULL,'',NULL,'','',NULL,'',0,NULL,NULL,'','',NULL,now(),'{"provider":"email","providers":["email"]}','{"display_name":"Maya Chen","handle":"maya","craft":"Design"}',false,false,false,now(),now()),
    ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000002','authenticated','authenticated','devon@tethyr.dev',pw_hash,now(),NULL,'',NULL,'',NULL,'','',NULL,'',0,NULL,NULL,'','',NULL,now(),'{"provider":"email","providers":["email"]}','{"display_name":"Devon Okafor","handle":"devon","craft":"Development"}',false,false,false,now(),now()),
    ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000003','authenticated','authenticated','priya@tethyr.dev',pw_hash,now(),NULL,'',NULL,'',NULL,'','',NULL,'',0,NULL,NULL,'','',NULL,now(),'{"provider":"email","providers":["email"]}','{"display_name":"Priya Nair","handle":"priya","craft":"Development"}',false,false,false,now(),now()),
    ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000004','authenticated','authenticated','alex@tethyr.dev',pw_hash,now(),NULL,'',NULL,'',NULL,'','',NULL,'',0,NULL,NULL,'','',NULL,now(),'{"provider":"email","providers":["email"]}','{"display_name":"Alex Ruiz","handle":"alexr","craft":"Design"}',false,false,false,now(),now()),
    ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000005','authenticated','authenticated','sam@tethyr.dev',pw_hash,now(),NULL,'',NULL,'',NULL,'','',NULL,'',0,NULL,NULL,'','',NULL,now(),'{"provider":"email","providers":["email"]}','{"display_name":"Sam Lee","handle":"samlee","craft":"Marketing"}',false,false,false,now(),now()),
    ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000006','authenticated','authenticated','nia@tethyr.dev',pw_hash,now(),NULL,'',NULL,'',NULL,'','',NULL,'',0,NULL,NULL,'','',NULL,now(),'{"provider":"email","providers":["email"]}','{"display_name":"Nia Thompson","handle":"nia","craft":"Music"}',false,false,false,now(),now()),
    ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000007','authenticated','authenticated','omar@tethyr.dev',pw_hash,now(),NULL,'',NULL,'',NULL,'','',NULL,'',0,NULL,NULL,'','',NULL,now(),'{"provider":"email","providers":["email"]}','{"display_name":"Omar Haddad","handle":"omar","craft":"Development"}',false,false,false,now(),now()),
    ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000008','authenticated','authenticated','lena@tethyr.dev',pw_hash,now(),NULL,'',NULL,'',NULL,'','',NULL,'',0,NULL,NULL,'','',NULL,now(),'{"provider":"email","providers":["email"]}','{"display_name":"Lena Fischer","handle":"lena","craft":"Writing"}',false,false,false,now(),now())
  ON CONFLICT (id) DO NOTHING;

  -- Auth identities are required for GoTrue password login. seed.sql creates
  -- one for the test user; these mock users need the same treatment or their
  -- password grant returns 400 and nobody can sign in as them.
  INSERT INTO auth.identities
    (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES
    ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','maya@tethyr.dev',jsonb_build_object('sub','10000000-0000-0000-0000-000000000001','email','maya@tethyr.dev','email_verified',true,'phone_verified',false),'email',now(),now(),now()),
    ('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','devon@tethyr.dev',jsonb_build_object('sub','10000000-0000-0000-0000-000000000002','email','devon@tethyr.dev','email_verified',true,'phone_verified',false),'email',now(),now(),now()),
    ('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','priya@tethyr.dev',jsonb_build_object('sub','10000000-0000-0000-0000-000000000003','email','priya@tethyr.dev','email_verified',true,'phone_verified',false),'email',now(),now(),now()),
    ('10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000004','alex@tethyr.dev',jsonb_build_object('sub','10000000-0000-0000-0000-000000000004','email','alex@tethyr.dev','email_verified',true,'phone_verified',false),'email',now(),now(),now()),
    ('10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000005','sam@tethyr.dev',jsonb_build_object('sub','10000000-0000-0000-0000-000000000005','email','sam@tethyr.dev','email_verified',true,'phone_verified',false),'email',now(),now(),now()),
    ('10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000006','nia@tethyr.dev',jsonb_build_object('sub','10000000-0000-0000-0000-000000000006','email','nia@tethyr.dev','email_verified',true,'phone_verified',false),'email',now(),now(),now()),
    ('10000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000007','omar@tethyr.dev',jsonb_build_object('sub','10000000-0000-0000-0000-000000000007','email','omar@tethyr.dev','email_verified',true,'phone_verified',false),'email',now(),now(),now()),
    ('10000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000008','lena@tethyr.dev',jsonb_build_object('sub','10000000-0000-0000-0000-000000000008','email','lena@tethyr.dev','email_verified',true,'phone_verified',false),'email',now(),now(),now())
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ---------------------------------------------------------------------------
-- Profiles (the test user is a1d676d3-... from seed.sql)
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles
  (id, display_name, handle, category, creator_title, bio, availability, reputation_score, years_experience, country, timezone, favourite_tools, software_stack, languages, teaching_style, background)
VALUES
  ('10000000-0000-0000-0000-000000000001','Maya Chen','maya','Design','Product Designer & Illustrator','Designing calm, useful products and drawing the internet''s friendliest mascots.','available',482,8,'United States','America/New_York',ARRAY['Figma','Procreate'],ARRAY['Figma','Notion'],ARRAY['English','Mandarin'],'Hands-on, project-based, async reviews','{"mode":"pattern","pattern":"dots","color":"#a78bfa","image_url":null}'::jsonb),
  ('10000000-0000-0000-0000-000000000002','Devon Okafor','devon','Development','Full-Stack Engineer','I build fast, accessible web apps and care too much about error messages.','available',515,9,'United Kingdom','Europe/London',ARRAY['VS Code','Postgres'],ARRAY['React','TypeScript','Node'],ARRAY['English'],'Pair programming, code reviews','{"mode":"color","color":"#2dd4bf","pattern":null,"image_url":null}'::jsonb),
  ('10000000-0000-0000-0000-000000000003','Priya Nair','priya','Development','Frontend Engineer','Turning messy product ideas into clean interfaces and clean code.','busy',298,5,'India','Asia/Kolkata',ARRAY['VS Code','Figma'],ARRAY['React','TypeScript','Tailwind'],ARRAY['English','Hindi'],'Async, written walkthroughs','{"mode":"pattern","pattern":"grid","color":"#38bdf8","image_url":null}'::jsonb),
  ('10000000-0000-0000-0000-000000000004','Alex Ruiz','alexr','Design','Motion Designer','Making interfaces feel alive one easing curve at a time.','learning',156,4,'Mexico','America/Mexico_City',ARRAY['After Effects','Lottie'],ARRAY['After Effects','Figma'],ARRAY['English','Spanish'],'Show-and-tell, iteration',NULL),
  ('10000000-0000-0000-0000-000000000005','Sam Lee','samlee','Marketing','Growth & Community','Helping indie builders find their first hundred users without feeling gross.','available',231,7,'Canada','America/Toronto',ARRAY['Notion','Amplitude'],ARRAY['Figma','Webflow'],ARRAY['English'],'Workshops, teardowns','{"mode":"pattern","pattern":"diagonal","color":"#fb7185","image_url":null}'::jsonb),
  ('10000000-0000-0000-0000-000000000006','Nia Thompson','nia','Music','Producer & Sound Designer','Producer, synth nerd, and keeper of the good headphones.','available',344,10,'United States','America/Los_Angeles',ARRAY['Ableton Live','Pro Tools'],ARRAY['Ableton Live','Logic Pro'],ARRAY['English'],'By ear, then by theory','{"mode":"color","color":"#fbbf24","pattern":null,"image_url":null}'::jsonb),
  ('10000000-0000-0000-0000-000000000007','Omar Haddad','omar','Development','Backend & Infra','Scaling things until they break, then fixing them so they don''t.','busy',402,11,'Germany','Europe/Berlin',ARRAY['Docker','Grafana'],ARRAY['Go','Rust','Postgres'],ARRAY['English','Arabic','German'],'Whiteboarding, system design','{"mode":"pattern","pattern":"crosshatch","color":"#94a3b8","image_url":null}'::jsonb),
  ('10000000-0000-0000-0000-000000000008','Lena Fischer','lena','Writing','Writer & Researcher','Long-form writer and researcher who believes footnotes are a love language.','available',187,6,'Germany','Europe/Berlin',ARRAY['Obsidian','Zotero'],ARRAY['Obsidian','Notion'],ARRAY['English','German'],'Editing passes, structured feedback',NULL)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  handle = EXCLUDED.handle,
  category = EXCLUDED.category,
  creator_title = EXCLUDED.creator_title,
  bio = EXCLUDED.bio,
  availability = EXCLUDED.availability,
  reputation_score = EXCLUDED.reputation_score,
  background = EXCLUDED.background;

-- Enrich the test user's own profile
UPDATE public.profiles
SET display_name = 'Test User',
    handle = 'testuser',
    category = 'Development',
    creator_title = 'Indie Builder',
    bio = 'Just kicking the tires on Tethyr — building things, meeting people, shipping weekly.',
    availability = 'available',
    reputation_score = 120,
    years_experience = 5,
    country = 'United Kingdom',
    timezone = 'Europe/London',
    favourite_tools = ARRAY['VS Code','Figma'],
    software_stack = ARRAY['React','TypeScript'],
    languages = ARRAY['English'],
    teaching_style = 'Pair programming and async code reviews',
    learning_goals = 'Ship a real side project and find two collaborators this quarter.',
    portfolio_links = '[{"label":"My site","url":"https://example.com"}]'::jsonb,
    social_links = '{"github":"https://github.com/testuser"}'::jsonb
WHERE id = 'a1d676d3-1a76-401f-bc30-0e4195569e26';

-- ---------------------------------------------------------------------------
-- Projects (one per stage, plus a private one and one owned by the test user)
-- ---------------------------------------------------------------------------
INSERT INTO public.projects
  (id, profile_id, title, description, goal, vision, status, stage, visibility, progress_percent, started_at, tags, is_featured, looking_for_feedback, looking_for_collaborators, gallery, resources, links, media, readme)
VALUES
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Atlas','An offline-first travel companion that builds day plans from your saved places.','Reach 1,000 weekly active travelers and ship the offline maps beta.','Travel apps fight you the whole way. Atlas should feel like a friend who already knows where you want to go.','active','growing','public',68, now() - interval '210 days', ARRAY['travel','react-native','offline','maps'], true, true, true, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '# Atlas\n\n**A travel companion that works offline.** Atlas turns your saved places, notes, and wishlists into a day plan — no cell signal required.\n\n## Why\nEvery trip starts with 40 open tabs and a dying battery. Atlas keeps the plan on your phone and out of your face.\n\n## Current focus\n- Offline maps beta (testing)\n- Smart day-planning v2\n- Community-sourced place tips\n\n## How to help\nCheck the open roles below, or grab a need from the top of the project.'),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Bloom','A private, beautiful journaling app that turns scattered thoughts into a weekly review.','Launch the App Store build and onboard the first 500 beta users.','Journaling should be a soft landing at the end of the day, not another empty text box.','active','launch','public',82, now() - interval '150 days', ARRAY['journaling','mental-health','ios','design'], true, true, false, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '# Bloom\n\nA journaling app that ends each week with a gentle review of what actually happened.\n\n## Principles\n- Private by default\n- No streaks, no guilt\n- Your words, beautifully set\n\n## Launch checklist\n- [x] Onboarding flow\n- [x] Weekly review generator\n- [ ] App Store screenshots\n- [ ] Beta waitlist page'),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000006','Reverb','A browser-based collaborative music workspace where musicians sketch, record, and remix together.','Ship the collaborative timeline and invite the first 200 producers.','Music software has been stuck on desktop for a decade. Reverb brings the session to the browser.','active','building','public',41, now() - interval '90 days', ARRAY['music','audio','collaboration','web-audio'], true, false, true, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '# Reverb\n\nA collaborative music workspace in the browser. Sketch a loop, invite a friend, remix each other.\n\n## What works\n- Multi-track timeline\n- Real-time presence\n- Stem export\n\n## Next up\n- Collaborative timeline (in progress)\n- MIDI device support\n- Versioned project history'),
  ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000003','Threadline','Async video feedback for teams that hate meetings.','Finish the playback-speed and timestamped-comment beta before the public launch.','Feedback shouldn''t need a calendar invite. Leave a 2-minute video instead of a 30-minute meeting.','active','testing','public',56, now() - interval '70 days', ARRAY['async','video','remote-work','feedback'], false, true, false, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '# Threadline\n\nRecord short video walkthroughs and let teammates reply with timestamped comments.\n\n## Beta focus\n- Playback speed controls\n- Timestamped comments\n- Transcript search\n\n## Known issues\n- Safari autoplay quirks\n- Large uploads on slow connections'),
  ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000005','Kindling','A newsletter engine that turns any creator''s archive into weekly, ready-to-send issues.','Validate the concept with 20 interviews before writing a line of product code.','Newsletter writers spend hours re-formatting ideas they already have. Kindling automates the grunt work.','planning','planning','public',12, now() - interval '14 days', ARRAY['newsletter','creators','automation','no-code'], false, false, true, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '# Kindling\n\nAn idea in search of its first users. Turns a writer''s existing archive into a weekly newsletter draft.\n\n## What we''re doing now\n- Customer interviews (goal: 20)\n- Landing page + waitlist\n- Pricing experiments\n\n## What we need\n- People who run newsletters (interview us!)\n- A landing page designer'),
  ('20000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000007','Orbit','API observability for small teams that never wanted to be SREs.','Ship v1.0 with tracing, alerts, and a free tier — done and out the door.','Observability tooling is priced and built for enterprises. Orbit gives small teams the 20% that matters.','completed','growing','public',100, now() - interval '300 days', ARRAY['observability','apis','devtools','backend'], true, false, false, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '# Orbit\n\nAPI observability for small teams. Trace a request, get alerted, go back to building.\n\n## Shipped\n- Distributed tracing\n- Alert rules\n- Free tier\n- OpenTelemetry support\n\n## Maintainers wanted\nWe''re in maintenance mode — if you want to steward this project, say hello.'),
  ('20000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000008','Commonplace','A shared research notebook where a team''s notes, sources, and quotes become a searchable second brain.','Build the citation engine and invite the first three research teams.','Research dies in individual docs. Commonplace makes the group''s reading a shared, searchable asset.','active','building','public',34, now() - interval '45 days', ARRAY['research','knowledge','notes','writing'], false, false, true, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '# Commonplace\n\nA shared research notebook. Collect sources, tag quotes, and let the group''s reading compound.\n\n## Status\n- Source clipping: done\n- Tagging + search: done\n- Citation engine: in progress\n- Zotero import: planned'),
  ('20000000-0000-0000-0000-000000000008','a1d676d3-1a76-401f-bc30-0e4195569e26','Studio Starter','My first Tethyr project — a place to learn the ropes and meet collaborators.','Learn how projects, roles, and credits work by actually shipping something small.','A sandbox to figure out how building in public feels.','planning','planning','public',5, now() - interval '3 days', ARRAY['learning','sandbox'], false, true, true, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '# Studio Starter\n\nThis is my first project on Tethyr. I''m figuring out how READMEs, milestones, roles, and credits all fit together.\n\n## Goals\n- [ ] Ship a tiny v1\n- [ ] Meet two collaborators\n- [ ] Post a weekly update\n\n**Open to collaborators** — if this looks fun, apply to a role below.'),
  ('20000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000002','Atlas — Internal Metrics','Private dashboard and analytics for the Atlas core team.','Internal analytics for the Atlas maintainers.','(Private) Team-only metrics and roadmap.','active','building','private',44, now() - interval '100 days', ARRAY['internal','analytics'], false, false, false, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '# Atlas — Internal\n\nPrivate working space for the Atlas core team.')
ON CONFLICT (id) DO NOTHING;

-- Convert literal \n in README markdown to real newlines for rendering
UPDATE public.projects SET readme = replace(readme, '\n', E'\n') WHERE readme IS NOT NULL;

-- Deterministic ordering: backfill created_at from each project's real start
-- date so Explore's "newest first" shelf isn't a tie-break lottery.
UPDATE public.projects SET created_at = started_at WHERE id::text LIKE '20000000-%' AND started_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Project skills
-- ---------------------------------------------------------------------------
INSERT INTO public.project_skills (project_id, skill_id)
SELECT t.project_id::uuid, s.id FROM (VALUES
  ('20000000-0000-0000-0000-000000000001','react-native'),
  ('20000000-0000-0000-0000-000000000001','typescript'),
  ('20000000-0000-0000-0000-000000000001','nodejs'),
  ('20000000-0000-0000-0000-000000000002','ui-design'),
  ('20000000-0000-0000-0000-000000000002','react'),
  ('20000000-0000-0000-0000-000000000002','illustration'),
  ('20000000-0000-0000-0000-000000000003','ableton-live'),
  ('20000000-0000-0000-0000-000000000003','sound-design'),
  ('20000000-0000-0000-0000-000000000003','music-production'),
  ('20000000-0000-0000-0000-000000000004','typescript'),
  ('20000000-0000-0000-0000-000000000004','react'),
  ('20000000-0000-0000-0000-000000000004','nodejs'),
  ('20000000-0000-0000-0000-000000000005','content-marketing'),
  ('20000000-0000-0000-0000-000000000005','copywriting'),
  ('20000000-0000-0000-0000-000000000005','growth-marketing'),
  ('20000000-0000-0000-0000-000000000006','observability'),
  ('20000000-0000-0000-0000-000000000006','go'),
  ('20000000-0000-0000-0000-000000000006','backend-development'),
  ('20000000-0000-0000-0000-000000000007','technical-writing'),
  ('20000000-0000-0000-0000-000000000007','research'),
  ('20000000-0000-0000-0000-000000000008','product-design'),
  ('20000000-0000-0000-0000-000000000008','react')
) AS t(project_id, skill_slug)
JOIN public.skills s ON s.slug = t.skill_slug
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Contributors
-- ---------------------------------------------------------------------------
INSERT INTO public.project_contributors (project_id, profile_id, role, contribution_score, skills_used, joined_at)
VALUES
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','creator',220,ARRAY['typescript','react-native'],now() - interval '210 days'),
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','contributor',90,ARRAY['react','typescript'],now() - interval '120 days'),
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','contributor',75,ARRAY['ui-design'],now() - interval '100 days'),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','creator',180,ARRAY['ui-design','illustration'],now() - interval '150 days'),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004','contributor',40,ARRAY['motion-graphics'],now() - interval '60 days'),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000006','creator',150,ARRAY['ableton-live','sound-design'],now() - interval '90 days'),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000007','mentor',30,ARRAY['backend-development'],now() - interval '40 days'),
  ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000003','creator',110,ARRAY['typescript','react'],now() - interval '70 days'),
  ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000005','creator',20,ARRAY['content-marketing'],now() - interval '14 days'),
  ('20000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000007','creator',260,ARRAY['observability','go'],now() - interval '300 days'),
  ('20000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000008','creator',70,ARRAY['technical-writing','research'],now() - interval '45 days'),
  ('20000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','contributor',25,ARRAY['ui-design'],now() - interval '20 days'),
  ('20000000-0000-0000-0000-000000000008','a1d676d3-1a76-401f-bc30-0e4195569e26','creator',5,ARRAY['react'],now() - interval '3 days')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Milestones
-- ---------------------------------------------------------------------------
INSERT INTO public.project_milestones (id, project_id, title, description, status, position, due_date, completed_by)
VALUES
  ('21000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Offline maps beta','Sync maps and saved places for offline use.','done',0, now() - interval '20 days','10000000-0000-0000-0000-000000000002'),
  ('21000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Smart day-planning v2','Cluster saved places into a sensible day route.','in_progress',1, now() + interval '14 days',NULL),
  ('21000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','Community place tips','Surface curated tips from travelers.','pending',2, now() + interval '40 days',NULL),
  ('21000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000002','App Store screenshots','Design and capture the launch screenshots.','done',0, now() - interval '5 days','10000000-0000-0000-0000-000000000001'),
  ('21000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000002','Beta waitlist page','Launch a waitlist landing page.','in_progress',1, now() + interval '7 days',NULL),
  ('21000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000003','Multi-track timeline','Core editing timeline with audio tracks.','done',0, now() - interval '30 days','10000000-0000-0000-0000-000000000006'),
  ('21000000-0000-0000-0000-000000000007','20000000-0000-0000-0000-000000000003','Collaborative timeline','Real-time multi-user editing.','in_progress',1, now() + interval '21 days',NULL),
  ('21000000-0000-0000-0000-000000000008','20000000-0000-0000-0000-000000000004','Timestamped comments','Reply at a specific moment in a video.','in_progress',0, now() + interval '10 days',NULL),
  ('21000000-0000-0000-0000-000000000009','20000000-0000-0000-0000-000000000004','Transcript search','Full-text search across transcripts.','pending',1, now() + interval '30 days',NULL),
  ('21000000-0000-0000-0000-000000000010','20000000-0000-0000-0000-000000000006','Tracing','Distributed tracing pipeline.','done',0, now() - interval '90 days','10000000-0000-0000-0000-000000000007'),
  ('21000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000006','Alert rules','Configure thresholds and alert channels.','done',1, now() - interval '60 days','10000000-0000-0000-0000-000000000007'),
  ('21000000-0000-0000-0000-000000000012','20000000-0000-0000-0000-000000000006','Free tier','Self-serve free tier and billing.','done',2, now() - interval '30 days','10000000-0000-0000-0000-000000000007'),
  ('21000000-0000-0000-0000-000000000013','20000000-0000-0000-0000-000000000007','Source clipping','Clip web sources into the notebook.','done',0, now() - interval '20 days','10000000-0000-0000-0000-000000000008'),
  ('21000000-0000-0000-0000-000000000014','20000000-0000-0000-0000-000000000007','Citation engine','Generate citations from clipped sources.','in_progress',1, now() + interval '14 days',NULL)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Open roles (joinable)
-- ---------------------------------------------------------------------------
INSERT INTO public.project_open_roles (id, project_id, title, description, skills, is_filled, filled_by)
VALUES
  ('22000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','React Native engineer','Ship the offline maps beta and day-planning v2.','{react-native,typescript}', false, NULL),
  ('22000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Illustrator','Draw the place tips and empty-state illustrations.','{illustration}', false, NULL),
  ('22000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Motion designer','Animate the onboarding and weekly-review moments.','{motion-graphics}', true, '10000000-0000-0000-0000-000000000004'),
  ('22000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000003','Sound designer','Design UI sounds and help with the audio engine.','{sound-design}', false, NULL),
  ('22000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000003','Backend engineer','Real-time collaboration server and presence.','{nodejs,go}', false, NULL),
  ('22000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000004','QA / tester','Break the playback and comment flows before launch.','{software-testing}', false, NULL),
  ('22000000-0000-0000-0000-000000000007','20000000-0000-0000-0000-000000000005','Landing page designer','Design the waitlist landing page.','{ui-design,figma}', false, NULL),
  ('22000000-0000-0000-0000-000000000008','20000000-0000-0000-0000-000000000005','Newsletter writers','Join the customer interview round.','{content-marketing}', false, NULL),
  ('22000000-0000-0000-0000-000000000009','20000000-0000-0000-0000-000000000007','React developer','Build the citation and search UI.','{react,typescript}', false, NULL),
  ('22000000-0000-0000-0000-000000000010','20000000-0000-0000-0000-000000000008','Design buddy','Help me make Studio Starter look decent.','{ui-design}', false, NULL),
  ('22000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000008','React buddy','Pair with me on a tiny v1.','{react}', false, NULL)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Project needs ("help now")
-- ---------------------------------------------------------------------------
INSERT INTO public.project_needs (id, project_id, title, note, skill_id, urgency, is_filled, filled_by)
VALUES
  ('23000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Review our offline maps beta','Try the beta build and tell us what breaks on your device.',(SELECT id FROM skills WHERE slug='software-testing'),'high',false,NULL),
  ('23000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','Test the collaborative timeline','Invite a friend and try editing together — we need real-session feedback.',(SELECT id FROM skills WHERE slug='music-production'),'high',false,NULL),
  ('23000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000005','Pilot newsletter interview','Run a 20-minute interview with a newsletter writer this week.',(SELECT id FROM skills WHERE slug='content-marketing'),'normal',false,NULL),
  ('23000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000002','Fresh eyes on onboarding','Watch someone sign up and journal for the first time.',(SELECT id FROM skills WHERE slug='ui-design'),'normal',false,NULL),
  ('23000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000008','Point me at a good starter stack','Help me pick a simple stack for my first build.',(SELECT id FROM skills WHERE slug='react'),'low',false,NULL)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Weekly updates
-- ---------------------------------------------------------------------------
INSERT INTO public.project_updates (id, project_id, author_id, title, body, week_number)
VALUES
  ('24000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Week 30 — Offline maps shipped','Offline maps are live for beta. Next: smart day-planning v2 and community tips.',30),
  ('24000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Week 28 — Place clustering','Day-planning now clusters nearby places. Testing the route quality this week.',28),
  ('24000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Week 21 — App Store build','Submitted the first App Store build. Screenshots and waitlist are next.',21),
  ('24000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000006','Week 13 — Timeline basics','Multi-track timeline is in. Real-time presence is the next mountain.',13),
  ('24000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000003','Week 10 — Comment beta','Timestamped comments are working end to end. Looking for testers.',10),
  ('24000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000008','Week 6 — Clipping shipped','Source clipping and tagging are live. Citation engine is underway.',6)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Discussions + replies
-- ---------------------------------------------------------------------------
INSERT INTO public.project_discussions (id, project_id, author_id, title, body, category, is_pinned)
VALUES
  ('25000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','Should day plans optimize for time or vibe?','Curious what travelers actually want — the fastest route or the nicest afternoon?','feedback', true),
  ('25000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Empty-state illustration direction','Sharing some rough sketches for the no-plans-yet state.','idea', false),
  ('25000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000007','Latency budget for real-time editing','How low should our round-trip latency be to feel instant?','question', false),
  ('25000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000008','a1d676d3-1a76-401f-bc30-0e4195569e26','What should I build first?','Total beginner question: what makes a good first Tethyr project?','question', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.discussion_replies (id, discussion_id, author_id, body)
VALUES
  ('26000000-0000-0000-0000-000000000001','25000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Vibe, honestly. If I wanted the fastest route I''d use a maps app.'),
  ('26000000-0000-0000-0000-000000000002','25000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005','Time for commuters, vibe for travelers. Maybe a toggle?'),
  ('26000000-0000-0000-0000-000000000003','25000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000007','Under ~200ms feels instant for cursor moves; audio can tolerate more.'),
  ('26000000-0000-0000-0000-000000000004','25000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','Something you''d actually use. Small scope, real user. Ship it in a weekend.'),
  ('26000000-0000-0000-0000-000000000005','25000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','And post a weekly update. The loop is the point.')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Repositories
-- ---------------------------------------------------------------------------
INSERT INTO public.project_repositories (id, project_id, provider, url)
VALUES
  ('27000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','github','https://github.com/atlas-travel/atlas'),
  ('27000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','github','https://github.com/reverb-audio/reverb'),
  ('27000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000004','github','https://github.com/threadline-app/threadline'),
  ('27000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000006','github','https://github.com/orbit-obs/orbit')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Community spaces + members
-- ---------------------------------------------------------------------------
INSERT INTO public.community_spaces (id, name, slug, description, created_by, join_type, rules, visibility, report_auto_dim_threshold)
VALUES
  ('30000000-0000-0000-0000-000000000001','Design Guild','design-guild','Critique, portfolio teardowns, and design questions for makers.','10000000-0000-0000-0000-000000000001','auto',ARRAY['Be kind, be specific','No self-promo outside the showcase thread'],'public',3),
  ('30000000-0000-0000-0000-000000000002','Ship It Saturdays','ship-it-saturdays','A weekly accountability thread for shipping something every Saturday.','10000000-0000-0000-0000-000000000002','auto',ARRAY['Post what you shipped','Encourage, don''t dunk'],'public',3),
  ('30000000-0000-0000-0000-000000000003','Indie Hackers Tethyr','indie-hackers','Building in public, revenue experiments, and honest numbers.','10000000-0000-0000-0000-000000000005','review',ARRAY['Real numbers only','No get-rich-quick spam'],'public',2),
  ('30000000-0000-0000-0000-000000000004','Music Makers','music-makers','Producers and songwriters sharing work and feedback.','10000000-0000-0000-0000-000000000006','auto',ARRAY['Credit your collaborators','Constructive feedback only'],'public',3),
  ('30000000-0000-0000-0000-000000000005','Studio Core','studio-core','Private working group for the Studio Starter core crew — invite only.','a1d676d3-1a76-401f-bc30-0e4195569e26','review',ARRAY['Keep it focused on Studio Starter'],'private',3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.community_space_members (space_id, user_id, role)
VALUES
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','owner'),
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','moderator'),
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','member'),
  ('30000000-0000-0000-0000-000000000001','a1d676d3-1a76-401f-bc30-0e4195569e26','member'),
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','owner'),
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000005','moderator'),
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','member'),
  ('30000000-0000-0000-0000-000000000002','a1d676d3-1a76-401f-bc30-0e4195569e26','member'),
  ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000005','owner'),
  ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','member'),
  ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000007','member'),
  ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000006','owner'),
  ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000004','member'),
  ('30000000-0000-0000-0000-000000000005','a1d676d3-1a76-401f-bc30-0e4195569e26','owner'),
  ('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000002','member')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Community posts + comments + actions
-- ---------------------------------------------------------------------------
INSERT INTO public.posts (id, author_id, type, title, body, community, skills, space_id, project_id, created_at, flair, is_pinned)
VALUES
  ('31000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','showcase','Rebranding a local coffee shop','Here is the full brand refresh I just shipped — logo, menu, and window signage.', 'Design', ARRAY['branding'], '30000000-0000-0000-0000-000000000001', NULL, now() - interval '1 day', 'Showcase', true),
  ('31000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','question','How do you test Tailwind color contrast?','Trying to make sure my accent colors pass WCAG AA without eyeballing every combo.', 'Development', ARRAY['tailwind-css','accessibility'], '30000000-0000-0000-0000-000000000001', NULL, now() - interval '2 days', 'Question', false),
  ('31000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','project_update','Atlas — offline maps shipped','Offline maps are live in beta. Weekend trip, no signal, plan intact.', 'Development', ARRAY['react-native'], NULL, '20000000-0000-0000-0000-000000000001', now() - interval '2 days', 'Update', false),
  ('31000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000006','tutorial','Sidechain compression without the guesswork','A practical walkthrough for making your kick and bass sit together.', 'Music', ARRAY['mixing-mastering','music-production'], '30000000-0000-0000-0000-000000000004', NULL, now() - interval '3 days', 'Tutorial', false),
  ('31000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000005','open_role','Looking for a landing page designer','Kindling needs a waitlist page. Small scope, paid, this week.', 'Marketing', ARRAY['ui-design'], NULL, '20000000-0000-0000-0000-000000000005', now() - interval '4 days', 'Open Role', false),
  ('31000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000008','resource','My favorite books on research methods','A short annotated list of the books that shaped how I take notes.', 'Writing', ARRAY['research','technical-writing'], NULL, NULL, now() - interval '5 days', 'Resource', false),
  ('31000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000002','achievement','Atlas hit 1,000 weekly travelers','Small milestone, big feeling. Thanks to everyone who beta-tested offline maps.', 'Development', ARRAY['react-native'], NULL, '20000000-0000-0000-0000-000000000001', now() - interval '6 days', 'Achievement', false),
  ('31000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000007','lesson_learned','The observability feature nobody used','We built dashboards first and alerts second. Flip it.', 'Development', ARRAY['observability'], NULL, '20000000-0000-0000-0000-000000000006', now() - interval '7 days', 'Lesson', false),
  ('31000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000004','feedback_request','Is this onboarding animation too much?','Twenty seconds of motion for a journaling app — too flashy or just right?', 'Design', ARRAY['motion-graphics'], '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', now() - interval '1 day', 'Feedback', false),
  ('31000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001','collaboration_request','Illustrator wanted for a travel app','Atlas needs warm, friendly empty-state illustrations. Small set, credited.', 'Design', ARRAY['illustration'], NULL, '20000000-0000-0000-0000-000000000001', now() - interval '2 days', 'Collab', false),
  ('31000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000005','poll','What should I build first for Kindling?','Help me pick the first feature.', 'Marketing', ARRAY['content-marketing'], '30000000-0000-0000-0000-000000000003', NULL, now() - interval '3 days', 'Poll', false)
ON CONFLICT (id) DO NOTHING;

-- Give the poll some options via poll_data
UPDATE public.posts
SET poll_data = jsonb_build_object('question','What should I build first for Kindling?','options',ARRAY['Landing page + waitlist','Newsletter draft importer','Pricing experiments'],'votes','[]'::jsonb,'ends_at',NULL)
WHERE id = '31000000-0000-0000-0000-000000000011';

INSERT INTO public.comments (id, post_id, author_id, body)
VALUES
  ('32000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','That window signage is gorgeous. The serif choice is perfect.'),
  ('32000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','I use a contrast checker on every accent before it ships. Worth the 30 seconds.'),
  ('32000000-0000-0000-0000-000000000003','31000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000005','Congrats! Offline maps are the killer feature.'),
  ('32000000-0000-0000-0000-000000000004','31000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000006','Bookmarking this. My kick/bass has been a mud fight for weeks.'),
  ('32000000-0000-0000-0000-000000000005','31000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000003','Just right. Any faster would feel frantic, any slower would feel slow.'),
  ('32000000-0000-0000-0000-000000000006','31000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000002','Landing page first — validate before you build anything else.'),
  ('32000000-0000-0000-0000-000000000007','31000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','This list is gold — just added two of these to my queue.'),
  ('32000000-0000-0000-0000-000000000008','31000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000003','Huge! Offline maps are the reason I started using it.'),
  ('32000000-0000-0000-0000-000000000009','31000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000005','Alerts-first is the real takeaway. Bookmarking.'),
  ('32000000-0000-0000-0000-000000000010','31000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000002','Happy to intro you to the illustrator I worked with on Atlas.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.post_actions (id, post_id, user_id, action)
VALUES
  ('33000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','like'),
  ('33000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','like'),
  ('33000000-0000-0000-0000-000000000003','31000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004','helpful'),
  ('33000000-0000-0000-0000-000000000004','31000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000006','helpful'),
  ('33000000-0000-0000-0000-000000000005','31000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000005','like'),
  ('33000000-0000-0000-0000-000000000006','31000000-0000-0000-0000-000000000007','a1d676d3-1a76-401f-bc30-0e4195569e26','like'),
  ('33000000-0000-0000-0000-000000000007','31000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','save'),
  ('33000000-0000-0000-0000-000000000008','31000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000006','like'),
  ('33000000-0000-0000-0000-000000000009','31000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','like'),
  ('33000000-0000-0000-0000-000000000010','31000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000006','save'),
  ('33000000-0000-0000-0000-000000000011','31000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','like'),
  ('33000000-0000-0000-0000-000000000012','31000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004','like'),
  ('33000000-0000-0000-0000-000000000013','31000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','like'),
  ('33000000-0000-0000-0000-000000000014','31000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000008','save'),
  ('33000000-0000-0000-0000-000000000015','31000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','like'),
  ('33000000-0000-0000-0000-000000000016','31000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000002','helpful'),
  ('33000000-0000-0000-0000-000000000017','31000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000003','save'),
  ('33000000-0000-0000-0000-000000000018','31000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000003','like'),
  ('33000000-0000-0000-0000-000000000019','31000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','helpful'),
  ('33000000-0000-0000-0000-000000000020','31000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000004','like'),
  ('33000000-0000-0000-0000-000000000021','31000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000007','like')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Challenges + participants
-- ---------------------------------------------------------------------------
INSERT INTO public.challenges (id, title, description, type, skills, difficulty, status, created_by, start_date, end_date, max_participants, pass_criteria, project_id)
VALUES
  ('40000000-0000-0000-0000-000000000001','Design a landing page in 48 hours','Design and build a one-page landing site for a fictional product. Submit a live URL.','skill',ARRAY['ui-design','figma'],'intermediate','active','10000000-0000-0000-0000-000000000001', now() - interval '2 days', now() + interval '5 days', 20, 'A live URL with a clear hero, one call-to-action, and a responsive layout.', '20000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000002','Build a rate-limited REST API','Build a small REST API with rate limiting and tests. Any language.','project',ARRAY['api-development','backend-development'],'intermediate','active','10000000-0000-0000-0000-000000000007', now() - interval '4 days', now() + interval '10 days', 15, 'Working endpoints, a rate limiter, and a passing test suite in a public repo.', '20000000-0000-0000-0000-000000000006'),
  ('40000000-0000-0000-0000-000000000003','Ship your first tutorial','Write and publish a short tutorial teaching something you just learned.','learning',ARRAY['technical-writing'],'beginner','active','10000000-0000-0000-0000-000000000008', now() - interval '1 day', now() + interval '7 days', 30, 'A published post (blog, Notion, or Tethyr post) with code or screenshots.', '20000000-0000-0000-0000-000000000007'),
  ('40000000-0000-0000-0000-000000000004','Build a portfolio homepage in a weekend','Design and ship a personal portfolio homepage you would be proud to share. Submit a live URL.','skill',ARRAY['ui-design','html-css'],'beginner','active','a1d676d3-1a76-401f-bc30-0e4195569e26', now() - interval '2 days', now() + interval '5 days', 25, 'A live homepage with your name, three projects, and a clear way to contact you.', '20000000-0000-0000-0000-000000000008')
ON CONFLICT (id) DO NOTHING;

-- Deterministic challenge ordering (challenges list sorts by created_at desc).
UPDATE public.challenges SET created_at = start_date WHERE id::text LIKE '40000000-%' AND start_date IS NOT NULL;

-- The review-transition triggers require auth.uid() = creator, which is NULL in a
-- seed context. Temporarily disable them so we can seed reviewed states directly.
ALTER TABLE public.challenge_participants DISABLE TRIGGER enforce_challenge_review_insert;
ALTER TABLE public.challenge_participants DISABLE TRIGGER enforce_challenge_review_transition;

INSERT INTO public.challenge_participants (id, challenge_id, user_id, status, progress, joined_at, submission_url, submission_note, submitted_at, review_status, reviewer_note, reviewed_at)
VALUES
  ('41000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','completed', NULL, now() - interval '2 days', 'https://example.com/alex-landing','Ship it. Went with a warm gradient-free palette.', now() - interval '1 day', 'passed', 'Clean hierarchy, strong CTA. Pass.', now() - interval '20 hours'),
  ('41000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','completed', NULL, now() - interval '2 days', 'https://example.com/priya-landing','Minimal single-column layout.', now() - interval '12 hours', 'submitted', NULL, NULL),
  ('41000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','a1d676d3-1a76-401f-bc30-0e4195569e26','in_progress', NULL, now() - interval '1 day', NULL, NULL, NULL, 'none', NULL, NULL),
  ('41000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','completed', NULL, now() - interval '3 days', 'https://github.com/devon/ratelimit-api','Go + tests, rate limiter with a sliding window.', now() - interval '1 day', 'submitted', NULL, NULL),
  ('41000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000006','completed', NULL, now() - interval '1 day', 'https://example.com/nia-tutorial','How to sidechain compress like you mean it.', now() - interval '1 day', 'passed', 'Practical and well-paced. Pass.', now() - interval '12 hours'),
  ('41000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000005','joined', NULL, now() - interval '6 hours', NULL, NULL, NULL, 'none', NULL, NULL),
  ('41000000-0000-0000-0000-000000000007','40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000003','completed', NULL, now() - interval '1 day', 'https://example.com/priya-portfolio','Shipped a clean single-page portfolio with my three best projects.', now() - interval '12 hours', 'submitted', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.challenge_participants ENABLE TRIGGER enforce_challenge_review_insert;
ALTER TABLE public.challenge_participants ENABLE TRIGGER enforce_challenge_review_transition;

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
INSERT INTO public.sessions (id, organizer_id, title, description, session_type, status, skill_id, project_id, starts_at, ends_at, duration_minutes, timezone, is_recurring)
VALUES
  ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Atlas weekly sync','Standup and roadmap for Atlas maintainers.','project_meeting','scheduled', NULL, '20000000-0000-0000-0000-000000000001', now() + interval '1 day', now() + interval '1 day 1 hour', 60, 'Europe/London', true),
  ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Design critique: Bloom onboarding','Group critique of the Bloom onboarding flow.','workshop', 'scheduled', NULL, '20000000-0000-0000-0000-000000000002', now() + interval '2 days', now() + interval '2 days 90 minutes', 90, 'America/New_York', false),
  ('50000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000006','Reverb sound jam','Open jam to test the collaborative timeline.','skill_exchange','scheduled',NULL,'20000000-0000-0000-0000-000000000003', now() + interval '3 days', now() + interval '3 days 2 hours', 120, 'America/Los_Angeles', false),
  ('50000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000007','Orbit post-mortem','What we learned shipping Orbit v1.0.','mentoring','completed',NULL,'20000000-0000-0000-0000-000000000006', now() - interval '10 days', now() - interval '10 days 1 hour', 60, 'Europe/Berlin', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.session_participants (id, session_id, profile_id, role, status)
VALUES
  ('51000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','organizer','accepted'),
  ('51000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','participant','accepted'),
  ('51000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','participant','accepted'),
  ('51000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001','a1d676d3-1a76-401f-bc30-0e4195569e26','participant','invited'),
  ('51000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','organizer','accepted'),
  ('51000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004','participant','accepted'),
  ('51000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000002','a1d676d3-1a76-401f-bc30-0e4195569e26','participant','accepted'),
  ('51000000-0000-0000-0000-000000000008','50000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000006','organizer','accepted'),
  ('51000000-0000-0000-0000-000000000009','50000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004','participant','pending'),
  ('51000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000007','organizer','accepted'),
  ('51000000-0000-0000-0000-000000000011','50000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','mentor','accepted')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Connections (test user connected to several people)
-- ---------------------------------------------------------------------------
INSERT INTO public.connections (id, requester_id, addressee_id, status, intro_message)
VALUES
  ('60000000-0000-0000-0000-000000000001','a1d676d3-1a76-401f-bc30-0e4195569e26','10000000-0000-0000-0000-000000000001','accepted','Loved the Bloom onboarding flow — would love to connect.'),
  ('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','a1d676d3-1a76-401f-bc30-0e4195569e26','accepted','Saw you''re learning React — happy to review PRs.'),
  ('60000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000005','a1d676d3-1a76-401f-bc30-0e4195569e26','pending','Want to be interviewed for Kindling?')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Reputation / contribution log + activity events
-- ---------------------------------------------------------------------------
INSERT INTO public.contribution_log (id, profile_id, category, action, points, metadata)
VALUES
  ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','project_impact','milestone_completed',5,'{"project_id":"20000000-0000-0000-0000-000000000001","milestone_title":"Offline maps beta"}'),
  ('70000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','project_impact','milestone_completed',5,'{"project_id":"20000000-0000-0000-0000-000000000002","milestone_title":"App Store screenshots"}'),
  ('70000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000006','project_impact','milestone_completed',5,'{"project_id":"20000000-0000-0000-0000-000000000003","milestone_title":"Multi-track timeline"}'),
  ('70000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000007','project_impact','milestone_completed',5,'{"project_id":"20000000-0000-0000-0000-000000000006","milestone_title":"Tracing"}'),
  ('70000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000008','project_impact','milestone_completed',5,'{"project_id":"20000000-0000-0000-0000-000000000007","milestone_title":"Source clipping"}'),
  ('70000000-0000-0000-0000-000000000006','a1d676d3-1a76-401f-bc30-0e4195569e26','community','joined_tethyr',10,'{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.activity_events (id, profile_id, kind, metadata)
VALUES
  ('71000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','project_published','{"title":"Atlas"}'),
  ('71000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','project_published','{"title":"Bloom"}'),
  ('71000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000006','project_published','{"title":"Reverb"}'),
  ('71000000-0000-0000-0000-000000000004','a1d676d3-1a76-401f-bc30-0e4195569e26','joined_tethyr','{}'),
  ('71000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000003','skill_teach_added','{"skill_name":"TypeScript"}'),
  ('71000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','skill_teach_added','{"skill_name":"UI Design"}')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Teach / learn skills (a few, so profiles and matching look alive)
-- ---------------------------------------------------------------------------
INSERT INTO public.profile_skills_teach (profile_id, skill_id, verification_level, experience_level)
SELECT '10000000-0000-0000-0000-000000000001'::uuid, id, 'community_recognized'::skill_verification_level, 'expert'::skill_experience_level FROM skills WHERE slug='ui-design'
UNION ALL SELECT '10000000-0000-0000-0000-000000000001'::uuid, id, 'proof_certified'::skill_verification_level, 'advanced'::skill_experience_level FROM skills WHERE slug='illustration'
UNION ALL SELECT '10000000-0000-0000-0000-000000000002'::uuid, id, 'community_recognized'::skill_verification_level, 'expert'::skill_experience_level FROM skills WHERE slug='react'
UNION ALL SELECT '10000000-0000-0000-0000-000000000002'::uuid, id, 'proof_certified'::skill_verification_level, 'advanced'::skill_experience_level FROM skills WHERE slug='typescript'
UNION ALL SELECT '10000000-0000-0000-0000-000000000003'::uuid, id, 'self_declared'::skill_verification_level, 'advanced'::skill_experience_level FROM skills WHERE slug='react'
UNION ALL SELECT '10000000-0000-0000-0000-000000000006'::uuid, id, 'community_recognized'::skill_verification_level, 'expert'::skill_experience_level FROM skills WHERE slug='sound-design'
UNION ALL SELECT '10000000-0000-0000-0000-000000000007'::uuid, id, 'proof_certified'::skill_verification_level, 'expert'::skill_experience_level FROM skills WHERE slug='observability'
UNION ALL SELECT '10000000-0000-0000-0000-000000000008'::uuid, id, 'proof_certified'::skill_verification_level, 'advanced'::skill_experience_level FROM skills WHERE slug='technical-writing'
UNION ALL SELECT '10000000-0000-0000-0000-000000000005'::uuid, id, 'self_declared'::skill_verification_level, 'advanced'::skill_experience_level FROM skills WHERE slug='growth-marketing'
UNION ALL SELECT 'a1d676d3-1a76-401f-bc30-0e4195569e26'::uuid, id, 'self_declared'::skill_verification_level, 'intermediate'::skill_experience_level FROM skills WHERE slug='typescript'
UNION ALL SELECT 'a1d676d3-1a76-401f-bc30-0e4195569e26'::uuid, id, 'self_declared'::skill_verification_level, 'intermediate'::skill_experience_level FROM skills WHERE slug='nodejs'
ON CONFLICT DO NOTHING;

INSERT INTO public.profile_skills_learn (profile_id, skill_id)
SELECT 'a1d676d3-1a76-401f-bc30-0e4195569e26'::uuid, id FROM skills WHERE slug='react'
UNION ALL SELECT 'a1d676d3-1a76-401f-bc30-0e4195569e26'::uuid, id FROM skills WHERE slug='ui-design'
UNION ALL SELECT '10000000-0000-0000-0000-000000000004'::uuid, id FROM skills WHERE slug='motion-graphics'
UNION ALL SELECT '10000000-0000-0000-0000-000000000005'::uuid, id FROM skills WHERE slug='product-management'
UNION ALL SELECT '10000000-0000-0000-0000-000000000006'::uuid, id FROM skills WHERE slug='backend-development'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- The curated-starter migration creates the Tethyr Team curator with a random
-- password (no known credential ships to production). Reset it here so local
-- dev/test can log in as the curator to review starter submissions.
-- ---------------------------------------------------------------------------
UPDATE auth.users
SET encrypted_password = crypt('password123', gen_salt('bf', 10))
WHERE id = 'a1d676d3-1a76-401f-bc30-0e4195569e27';

-- ---------------------------------------------------------------------------
-- Backfill achievements for every seeded profile so profiles look lived-in.
-- award_earned_achievements() is SECURITY DEFINER and reads auth.uid() from
-- the request.jwt.claim.sub setting, so we set it per profile and call it.
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

-- ---------------------------------------------------------------------------
-- Teams & crews (so the crew page has a lived-in roster + activity to show)
-- ---------------------------------------------------------------------------
INSERT INTO public.teams (id, name, slug, description, created_by)
VALUES
  ('40000000-0000-0000-0000-000000000001','Atlas Core','atlas-core','The crew building Atlas — offline-first travel, maps, and day planning.','10000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.team_members (team_id, profile_id, role)
VALUES
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','lead'),
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','core'),
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','contributor')
ON CONFLICT DO NOTHING;

INSERT INTO public.team_projects (team_id, project_id)
VALUES
  ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;
