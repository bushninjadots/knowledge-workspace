-- Security hardening migration
-- Fixes: RLS self-insert on project_contributors, skill-proofs public access,
-- missing indexes, and UNIQUE constraint on projects.

-- 1. Fix project_contributors: remove self-insert clause
-- Only project owners can add contributors now.
DROP POLICY IF EXISTS "Owner or self can add contributor" ON public.project_contributors;
CREATE POLICY "Owner can add contributor" ON public.project_contributors
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.profile_id = auth.uid())
  );

-- 2. Restrict skill-proofs bucket: authenticated users only, not public
UPDATE storage.buckets SET public = false WHERE id = 'skill-proofs';

DROP POLICY IF EXISTS "Skill proof files are publicly accessible" ON storage.objects;
CREATE POLICY "Skill proof files readable by authenticated users"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'skill-proofs');

-- 3. Add missing indexes for skill junction tables
CREATE INDEX IF NOT EXISTS profile_skills_teach_profile_idx
  ON public.profile_skills_teach(profile_id);

CREATE INDEX IF NOT EXISTS profile_skills_learn_profile_idx
  ON public.profile_skills_learn(profile_id);

CREATE INDEX IF NOT EXISTS profile_skills_wishlist_profile_idx
  ON public.profile_skills_wishlist(profile_id);

CREATE INDEX IF NOT EXISTS skill_endorsements_skill_idx
  ON public.skill_endorsements(skill_id);

-- 4. Add UNIQUE constraint on (profile_id, title) for projects
ALTER TABLE public.projects
  ADD CONSTRAINT projects_profile_title_unique UNIQUE (profile_id, title);
