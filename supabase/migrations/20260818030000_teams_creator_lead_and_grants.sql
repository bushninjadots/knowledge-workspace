-- Crew/team creation fixups.
--
-- 1. The "Form a crew" flow created the team but then tried to insert the
--    creator as a `lead` member, which the `team_members` INSERT policy
--    rejected (it only allows joining via a pending invite). Result: a new
--    crew had zero members and the lead could not invite, manage, or update
--    anything. Auto-add the creator as lead at insert time instead.
--
-- 2. The teams tables were created without `service_role` grants (the only
--    tables in the schema that lack them), so server-side functions could not
--    touch teams. Add them to match the rest of the schema.

-- ---------------------------------------------------------------------------
-- Creator becomes lead automatically (SECURITY DEFINER bypasses RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_team_creator_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.team_members (team_id, profile_id, role)
  VALUES (NEW.id, NEW.created_by, 'lead')
  ON CONFLICT (team_id, profile_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_creator_lead ON public.teams;
CREATE TRIGGER trg_team_creator_lead
AFTER INSERT ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.trg_team_creator_lead();

-- ---------------------------------------------------------------------------
-- service_role grants for the teams tables
-- ---------------------------------------------------------------------------
GRANT ALL ON public.teams TO service_role;
GRANT ALL ON public.team_members TO service_role;
GRANT ALL ON public.team_projects TO service_role;
GRANT ALL ON public.team_invites TO service_role;
