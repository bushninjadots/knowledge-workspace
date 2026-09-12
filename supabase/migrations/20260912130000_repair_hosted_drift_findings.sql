-- ============================================================================
-- Repair the hosted drift audit findings F1–F4
-- ============================================================================
-- The 2026-09-11 hosted drift audit found that migrations 20260705022445 and
-- 20260706100000 are recorded as applied on hosted but their objects are absent.
-- Because the history rows exist, no future db push will re-run them. Only a
-- new forward migration can restore the intended state.
--
-- This migration restates every object the audit found missing. It uses
-- CREATE OR REPLACE for functions (idempotent), DROP IF EXISTS + CREATE for
-- policies and triggers (always creates fresh — not replay-fragile like
-- CREATE IF NOT EXISTS), and CREATE INDEX IF NOT EXISTS for indexes (an index
-- either exists or it doesn't; no order-dependent semantics).
--
-- See docs/TETHYR_HOSTED_DRIFT_AUDIT_2026-09-11.md findings F1–F4.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- F1: skill-proofs SELECT policy must be TO authenticated, not PUBLIC.
-- The hosted database still carries the old world-readable policy.
-- Also re-assert the bucket's public flag (a row, not schema — the audit
-- could not verify it from a schema dump).
-- ---------------------------------------------------------------------------
UPDATE storage.buckets SET public = false WHERE id = 'skill-proofs';

DROP POLICY IF EXISTS "Skill proof files are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Skill proof files readable by authenticated users" ON storage.objects;
CREATE POLICY "Skill proof files readable by authenticated users"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'skill-proofs');

-- ---------------------------------------------------------------------------
-- F2: connections immutability trigger + tightened addressee policy.
-- The trigger function, trigger, and tightened policy are all absent on
-- hosted while their migration (20260705022445) is recorded as applied.
-- ---------------------------------------------------------------------------

-- 1. Immutability trigger function
CREATE OR REPLACE FUNCTION public.trg_connections_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.requester_id <> OLD.requester_id
     OR NEW.addressee_id <> OLD.addressee_id
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'requester_id, addressee_id and created_at are immutable';
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Immutability trigger
DROP TRIGGER IF EXISTS connections_immutable ON public.connections;
CREATE TRIGGER connections_immutable
  BEFORE UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.trg_connections_immutable_fields();

-- 3. Tightened addressee UPDATE policy: pending -> accepted/declined only
DROP POLICY IF EXISTS "Addressee can respond" ON public.connections;
CREATE POLICY "Addressee can respond"
  ON public.connections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = addressee_id AND status = 'pending')
  WITH CHECK (
    auth.uid() = addressee_id
    AND status IN ('accepted', 'declined')
  );

-- ---------------------------------------------------------------------------
-- F3: increment_usage_count must not be executable by anon.
-- The hosted database still carries GRANT ALL ON FUNCTION ... TO anon from
-- the original migration. 20260829110000 revoked it, but that migration is
-- also in the batch that may not have applied correctly on hosted.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.increment_usage_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_usage_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_usage_count(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- F4: four indexes missing on hosted (query-plan regression, not correctness).
-- Created by 20260706100000, absent remotely. IF NOT EXISTS is safe here —
-- an index has no "version" to be clobbered by a replay.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS profile_skills_teach_profile_idx
  ON public.profile_skills_teach(profile_id);

CREATE INDEX IF NOT EXISTS profile_skills_learn_profile_idx
  ON public.profile_skills_learn(profile_id);

CREATE INDEX IF NOT EXISTS profile_skills_wishlist_profile_idx
  ON public.profile_skills_wishlist(profile_id);

CREATE INDEX IF NOT EXISTS skill_endorsements_skill_idx
  ON public.skill_endorsements(skill_id);

-- Column grants / PostgREST schema cache are unaffected by these changes,
-- but the policy recreation should refresh the cached policy set.
NOTIFY pgrst, 'reload schema';
