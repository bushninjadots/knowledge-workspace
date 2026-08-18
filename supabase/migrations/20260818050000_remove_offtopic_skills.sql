-- Remove skill categories that are outside Tethyr's domain.
--
-- Tethyr is a creative collaboration network where people get known for what
-- they build. A large imported catalog batch brought in service/job-marketplace
-- skills that have nothing to do with that loop (teaching, finance, wellness,
-- hospitality, legal, academic science, sports coaching, and physical trades).
-- They only added noise to the skill picker and the "trending skills" panel.
--
-- FKs on profile_skills_*, project_skills, and skill_endorsements are
-- ON DELETE CASCADE, and sessions.skill_id / project_needs.skill_id are
-- ON DELETE SET NULL, so removing these rows is safe.

DELETE FROM public.skills
WHERE category IN (
  'Education',
  'Finance',
  'Health & Wellness',
  'Hospitality',
  'Law & Compliance',
  'Science & Research',
  'Sports & Coaching',
  'Trades & Hands-on'
);
