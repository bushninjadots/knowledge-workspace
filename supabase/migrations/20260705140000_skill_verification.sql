-- Skill credibility tiers: self-declared (default), proof-certified (creator
-- attaches evidence), community-recognized (earned via peer endorsements).
-- Only applies to "skills I teach" — that's the credibility claim other
-- people actually rely on when deciding to learn from someone.

DO $$ BEGIN
  CREATE TYPE public.skill_verification_level AS ENUM (
    'self_declared',
    'proof_certified',
    'community_recognized'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.profile_skills_teach
  ADD COLUMN IF NOT EXISTS verification_level public.skill_verification_level
    NOT NULL DEFAULT 'self_declared',
  ADD COLUMN IF NOT EXISTS proof_url text,
  ADD COLUMN IF NOT EXISTS proof_note text;

-- profile_skills_teach previously only supported insert/delete (add or
-- remove a skill) — there was no update policy because there was nothing
-- to update. Proof fields need one.
GRANT UPDATE ON public.profile_skills_teach TO authenticated;
CREATE POLICY "Users manage own teach skills update" ON public.profile_skills_teach
  FOR UPDATE USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

-- 1. Endorsements — one person can vouch for another's specific skill once.
CREATE TABLE IF NOT EXISTS public.skill_endorsements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  endorsed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skill_endorsements_no_self_endorse CHECK (endorsed_by <> profile_id),
  CONSTRAINT skill_endorsements_unique UNIQUE (profile_id, skill_id, endorsed_by)
);
GRANT SELECT ON public.skill_endorsements TO anon;
GRANT SELECT, INSERT, DELETE ON public.skill_endorsements TO authenticated;
GRANT ALL ON public.skill_endorsements TO service_role;
ALTER TABLE public.skill_endorsements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Endorsements viewable by everyone" ON public.skill_endorsements
  FOR SELECT USING (true);
CREATE POLICY "Anyone but the owner can endorse" ON public.skill_endorsements
  FOR INSERT WITH CHECK (endorsed_by = auth.uid() AND endorsed_by <> profile_id);
CREATE POLICY "Only the endorser can retract" ON public.skill_endorsements
  FOR DELETE USING (endorsed_by = auth.uid());

CREATE INDEX IF NOT EXISTS skill_endorsements_lookup_idx
  ON public.skill_endorsements(profile_id, skill_id);

-- 2. Auto-upgrade to community_recognized once a skill has 3+ endorsers.
-- Upgrade-only: never downgrades a level a creator or an earlier endorsement
-- pass already earned.
CREATE OR REPLACE FUNCTION public.trg_endorsement_upgrade_level()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count int;
BEGIN
  SELECT count(*) INTO _count FROM public.skill_endorsements
    WHERE profile_id = NEW.profile_id AND skill_id = NEW.skill_id;
  IF _count >= 3 THEN
    UPDATE public.profile_skills_teach
      SET verification_level = 'community_recognized'
      WHERE profile_id = NEW.profile_id
        AND skill_id = NEW.skill_id
        AND verification_level <> 'community_recognized';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS endorsement_upgrade_level ON public.skill_endorsements;
CREATE TRIGGER endorsement_upgrade_level AFTER INSERT ON public.skill_endorsements
  FOR EACH ROW EXECUTE FUNCTION public.trg_endorsement_upgrade_level();
