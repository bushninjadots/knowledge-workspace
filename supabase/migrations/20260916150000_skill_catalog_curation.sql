-- Skill catalog curation: keep the /skills directory relevant.
--
-- Two data issues found while auditing the catalog for the directory page:
--
-- 1. Umbrella skills: three entries are named exactly like their own category
--    ("Video Editing" in Video Editing, "Photography" in Photography,
--    "Streaming" in Streaming). They are grouping labels masquerading as
--    skills, they duplicate the category heading rendered right above them,
--    and none of them is referenced anywhere. The rule below prunes ANY
--    unused self-named skill — idempotent, and it protects any entry that
--    has actually been adopted (teach, learn, wishlist, project, endorsement,
--    session, or project need).
--
-- 2. "Accessibility" was filed under "DevOps & Cloud". It is a UX/design
--    craft (it pairs with the UI/UX and Web Design entries), so it moves to
--    the Design category. Category is plain data — no FK targets it.

DELETE FROM public.skills s
WHERE lower(s.name) = lower(s.category)
  AND NOT EXISTS (SELECT 1 FROM public.profile_skills_teach t WHERE t.skill_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.profile_skills_learn l WHERE l.skill_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.profile_skills_wishlist w WHERE w.skill_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.project_skills p WHERE p.skill_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.skill_endorsements e WHERE e.skill_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.sessions se WHERE se.skill_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.project_needs n WHERE n.skill_id = s.id);

UPDATE public.skills
SET category = 'Design'
WHERE slug = 'accessibility'
  AND category = 'DevOps & Cloud';
