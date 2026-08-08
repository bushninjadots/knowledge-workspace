-- ============================================================
-- People events in project_activity.
--
-- The Activity timeline already captures updates, milestones,
-- discussions, files and repos. This adds the human layer:
--   - someone joins as a contributor  → 'contributor_joined'
--   - an open role gets filled        → 'role_filled'
-- Creator rows (auto-inserted when a project is created) are
-- skipped — that's not a "join".
-- ============================================================

-- ------------------------------------------------------------
-- 1. Contributor joined → 'contributor_joined'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_project_contributor_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role <> 'creator' THEN
    INSERT INTO project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
    VALUES (
      NEW.project_id,
      NEW.profile_id,
      'contributor_joined',
      'Joined the project as a contributor',
      NULL,
      jsonb_build_object('profile_id', NEW.profile_id, 'role', NEW.role),
      COALESCE(NEW.joined_at, now())
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_activity_contributor ON public.project_contributors;
CREATE TRIGGER trg_project_activity_contributor
AFTER INSERT ON public.project_contributors
FOR EACH ROW
EXECUTE FUNCTION public.record_project_contributor_activity();

-- ------------------------------------------------------------
-- 2. Open role filled → 'role_filled'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_project_role_filled_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_filled AND (OLD.is_filled IS DISTINCT FROM TRUE) THEN
    INSERT INTO project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
    VALUES (
      NEW.project_id,
      NEW.filled_by,
      'role_filled',
      'Filled the role: ' || NEW.title,
      NULL,
      jsonb_build_object('role_id', NEW.id, 'title', NEW.title, 'filled_by', NEW.filled_by),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_activity_role_filled ON public.project_open_roles;
CREATE TRIGGER trg_project_activity_role_filled
AFTER UPDATE ON public.project_open_roles
FOR EACH ROW
EXECUTE FUNCTION public.record_project_role_filled_activity();

-- ------------------------------------------------------------
-- Backfill — only when the people-event kinds are missing entirely.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.project_activity WHERE kind IN ('contributor_joined', 'role_filled') LIMIT 1) THEN

    INSERT INTO public.project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
    SELECT project_id, profile_id, 'contributor_joined',
           'Joined the project as a contributor', NULL,
           jsonb_build_object('profile_id', profile_id, 'role', role),
           COALESCE(joined_at, now())
    FROM public.project_contributors
    WHERE role <> 'creator';

    INSERT INTO public.project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
    SELECT project_id, filled_by, 'role_filled',
           'Filled the role: ' || title, NULL,
           jsonb_build_object('role_id', id, 'title', title, 'filled_by', filled_by),
           now()
    FROM public.project_open_roles
    WHERE is_filled AND filled_by IS NOT NULL;

  END IF;
END;
$$;
