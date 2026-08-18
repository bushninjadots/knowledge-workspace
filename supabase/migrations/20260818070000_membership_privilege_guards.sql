-- Membership privilege guards.
--
-- Several INSERT policies let a user self-insert with an elevated role or
-- status, so a plain client could become a team lead, space owner/moderator,
-- an accepted role applicant, or a session organizer/attendee without being
-- invited. This migration pins those columns down and prevents a crew from
-- losing its last lead.

-- ============================================================================
-- 1. team_members — invitees join as contributors only, and a crew keeps a lead
-- ============================================================================

-- An invitee may only join as a contributor. Leads are auto-added by the
-- trg_team_creator_lead trigger and promoted/demoted by existing leads.
DROP POLICY IF EXISTS "Invitee can join a team" ON public.team_members;
CREATE POLICY "Invitee can join a team"
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND role = 'contributor'
    AND EXISTS (
      SELECT 1 FROM public.team_invites ti
      WHERE ti.team_id = team_members.team_id
        AND ti.profile_id = auth.uid()
        AND ti.status = 'pending'
    )
  );

-- A crew must always keep at least one lead: block removing or demoting the
-- last lead (otherwise the crew becomes unmanageable with no recovery path).
CREATE OR REPLACE FUNCTION public.trg_guard_last_team_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _remaining integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role <> 'lead' THEN RETURN OLD; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role <> 'lead' OR NEW.role = 'lead' THEN RETURN NEW; END IF;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT count(*) INTO _remaining
    FROM public.team_members
    WHERE team_id = OLD.team_id AND role = 'lead' AND profile_id <> OLD.profile_id;

  IF _remaining = 0 THEN
    RAISE EXCEPTION 'A crew must keep at least one lead';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_last_team_lead ON public.team_members;
CREATE TRIGGER trg_guard_last_team_lead
BEFORE UPDATE OR DELETE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.trg_guard_last_team_lead();

-- ============================================================================
-- 2. community_space_members — no self-granted owner/moderator, owners protected
-- ============================================================================

-- Helper: is the caller an owner of this space?
CREATE OR REPLACE FUNCTION public.is_space_owner(p_space_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE PARALLEL SAFE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_space_members
    WHERE space_id = p_space_id
      AND user_id = COALESCE(p_user_id, auth.uid())
      AND role = 'owner'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_space_owner(uuid, uuid) TO authenticated;

-- A user may only self-join as a member of an auto-join space, or create their
-- own owner row when they founded the space. Moderators are promoted via the
-- owner-only UPDATE policy below.
DROP POLICY IF EXISTS "Users can join spaces" ON public.community_space_members;
CREATE POLICY "Users can join spaces"
  ON public.community_space_members FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (
        role = 'owner'
        AND EXISTS (
          SELECT 1 FROM public.community_spaces s
          WHERE s.id = space_id AND s.created_by = auth.uid()
        )
      )
      OR (
        role = 'member'
        AND EXISTS (
          SELECT 1 FROM public.community_spaces s
          WHERE s.id = space_id AND s.join_type = 'auto'
        )
      )
    )
  );

-- Only owners manage/remove members, and owners can never be demoted or removed
-- (mirrors the existing "owners can't be banned" rule and the settings UI, where
-- only an owner can edit non-owner members).
DROP POLICY IF EXISTS "Owners and moderators can manage members" ON public.community_space_members;
CREATE POLICY "Owners can manage non-owner members"
  ON public.community_space_members FOR UPDATE TO authenticated
  USING (public.is_space_owner(space_id, auth.uid()) AND role <> 'owner')
  WITH CHECK (public.is_space_owner(space_id, auth.uid()) AND role <> 'owner');

DROP POLICY IF EXISTS "Owners and moderators can remove members" ON public.community_space_members;
CREATE POLICY "Owners can remove non-owner members"
  ON public.community_space_members FOR DELETE TO authenticated
  USING (public.is_space_owner(space_id, auth.uid()) AND role <> 'owner');

-- ============================================================================
-- 3. project_role_applications — applicants can't self-accept
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can apply" ON public.project_role_applications;
CREATE POLICY "Authenticated users can apply"
  ON public.project_role_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = profile_id AND status = 'pending');

-- ============================================================================
-- 4. session_participants — no self-granted organizer role or accepted status
-- ============================================================================
-- The organizer adds participants (any role/status). A self-insert (if any)
-- is only a pending participant — never an organizer/mentor or pre-accepted.
DROP POLICY IF EXISTS "Organizer can add participants" ON public.session_participants;
CREATE POLICY "Organizer can add participants"
  ON public.session_participants FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_participants.session_id AND s.organizer_id = auth.uid()
    )
    OR (
      profile_id = auth.uid()
      AND role = 'participant'
      AND status = 'pending'
    )
  );

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
