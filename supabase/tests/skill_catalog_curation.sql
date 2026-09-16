CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(6);

-- Invariant 1: no unused skill is named identically to its own category.
-- Such entries are grouping labels, not skills: the directory already renders
-- the category heading above them, and an unadopted one is pure noise.
-- Mirrors the guard in 20260916150000_skill_catalog_curation.sql — if a
-- self-named skill is ever genuinely adopted it may stay, but an unused one
-- must not survive a fresh migration.
SELECT is(
  (
    SELECT count(*)
    FROM public.skills s
    WHERE lower(s.name) = lower(s.category)
      AND NOT EXISTS (SELECT 1 FROM public.profile_skills_teach t WHERE t.skill_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.profile_skills_learn l WHERE l.skill_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.profile_skills_wishlist w WHERE w.skill_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.project_skills p WHERE p.skill_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.skill_endorsements e WHERE e.skill_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.sessions se WHERE se.skill_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.project_needs n WHERE n.skill_id = s.id)
  ),
  0::bigint,
  'no unused skill is named identically to its category'
);

-- The directory links every card to /skills/:slug, so slugs must exist and be
-- URL-safe (kebab-case). A missing or malformed slug is a dead directory link.
SELECT is(
  (
    SELECT count(*)
    FROM public.skills
    WHERE slug IS NULL
      OR slug = ''
      OR slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  0::bigint,
  'every skill has a non-empty kebab-case slug'
);

-- Slugs are the directory join key — duplicates would collide.
SELECT is(
  (
    SELECT count(*)
    FROM (
      SELECT slug FROM public.skills WHERE slug IS NOT NULL GROUP BY slug HAVING count(*) > 1
    ) d
  ),
  0::bigint,
  'skill slugs are unique'
);

-- Every catalog entry must be renderable by the directory page.
SELECT is(
  (
    SELECT count(*)
    FROM public.skills
    WHERE name IS NULL
      OR name = ''
      OR category IS NULL
      OR category = ''
  ),
  0::bigint,
  'every skill has a name and a category'
);

-- Curation moved Accessibility out of DevOps & Cloud: it is a UX/design craft
-- and belongs beside the UI/UX and Web Design entries.
SELECT is(
  (SELECT category FROM public.skills WHERE slug = 'accessibility'),
  'Design',
  'accessibility is categorized under Design'
);

-- Guard the seed against name collisions: two skills sharing a display name
-- makes the directory ambiguous (same label, different destinations).
SELECT is(
  (
    SELECT count(*)
    FROM (SELECT name FROM public.skills GROUP BY name HAVING count(*) > 1) d
  ),
  0::bigint,
  'skill display names are unique'
);

SELECT * FROM finish();

ROLLBACK;
