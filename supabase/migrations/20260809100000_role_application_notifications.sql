-- Role application outcomes
-- Keep owner decisions atomic and notify applicants immediately.

CREATE OR REPLACE FUNCTION public.notify_role_application_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role_title text;
  _project_title text;
  _project_owner uuid;
  _notification_type text;
  _title text;
  _body text;
BEGIN
  IF OLD.status = NEW.status OR NEW.status NOT IN ('accepted', 'declined') THEN
    RETURN NEW;
  END IF;

  SELECT por.title, p.title, p.profile_id
    INTO _role_title, _project_title, _project_owner
  FROM public.project_open_roles por
  JOIN public.projects p ON p.id = por.project_id
  WHERE por.id = NEW.role_id;

  IF _project_owner IS NULL OR NEW.profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'accepted' THEN
    _notification_type := 'role_application_accepted';
    _title := 'Your application was accepted';
    _body := 'You were accepted for “' || COALESCE(_role_title, 'an open role') || '” on “' ||
      COALESCE(_project_title, 'a project') || '”.';
  ELSE
    _notification_type := 'role_application_declined';
    _title := 'Application update';
    _body := 'Your application for “' || COALESCE(_role_title, 'an open role') || '” on “' ||
      COALESCE(_project_title, 'a project') || '” was declined.';
  END IF;

  PERFORM public.insert_notification(
    NEW.profile_id,
    _project_owner,
    _notification_type,
    _title,
    _body,
    'project_role_application',
    NEW.id,
    jsonb_build_object(
      'role_id', NEW.role_id,
      'project_id', (SELECT project_id FROM public.project_open_roles WHERE id = NEW.role_id),
      'status', NEW.status,
      'role_title', _role_title,
      'project_title', _project_title
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_role_application_status ON public.project_role_applications;
CREATE TRIGGER notify_on_role_application_status
  AFTER UPDATE OF status ON public.project_role_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_role_application_status();

CREATE OR REPLACE FUNCTION public.accept_project_role_application(
  p_application_id uuid,
  p_profile_id uuid,
  p_role_id uuid,
  p_project_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _role_project_id uuid;
  _application_profile_id uuid;
  _application_role_id uuid;
  _application_status text;
  _role_filled boolean;
BEGIN
  SELECT p.profile_id, por.project_id, por.is_filled
    INTO _owner_id, _role_project_id, _role_filled
  FROM public.project_open_roles por
  JOIN public.projects p ON p.id = por.project_id
  WHERE por.id = p_role_id
  FOR UPDATE OF por;

  SELECT profile_id, role_id, status
    INTO _application_profile_id, _application_role_id, _application_status
  FROM public.project_role_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF _owner_id IS NULL OR _owner_id <> auth.uid()
     OR _role_project_id <> p_project_id
     OR _application_profile_id <> p_profile_id
     OR _application_role_id <> p_role_id THEN
    RAISE EXCEPTION 'Not authorized to accept this application';
  END IF;

  IF _role_filled OR _application_status <> 'pending' THEN
    RAISE EXCEPTION 'This role is no longer available';
  END IF;

  UPDATE public.project_role_applications
  SET status = 'accepted'
  WHERE id = p_application_id AND status = 'pending';

  INSERT INTO public.project_contributors (project_id, profile_id, role)
  VALUES (p_project_id, p_profile_id, 'contributor')
  ON CONFLICT (project_id, profile_id) DO NOTHING;

  UPDATE public.project_open_roles
  SET is_filled = true, filled_by = p_profile_id
  WHERE id = p_role_id AND is_filled = false;

  UPDATE public.project_role_applications
  SET status = 'declined'
  WHERE role_id = p_role_id
    AND status = 'pending'
    AND id <> p_application_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_project_role_application(
  p_application_id uuid,
  p_role_id uuid,
  p_project_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _role_project_id uuid;
  _application_role_id uuid;
  _application_status text;
BEGIN
  SELECT p.profile_id, por.project_id
    INTO _owner_id, _role_project_id
  FROM public.project_open_roles por
  JOIN public.projects p ON p.id = por.project_id
  WHERE por.id = p_role_id
  FOR UPDATE OF por;

  SELECT role_id, status
    INTO _application_role_id, _application_status
  FROM public.project_role_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF _owner_id IS NULL OR _owner_id <> auth.uid()
     OR _role_project_id <> p_project_id
     OR _application_role_id <> p_role_id THEN
    RAISE EXCEPTION 'Not authorized to decline this application';
  END IF;

  IF _application_status <> 'pending' THEN
    RAISE EXCEPTION 'This application has already been decided';
  END IF;

  UPDATE public.project_role_applications
  SET status = 'declined'
  WHERE id = p_application_id AND status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.accept_project_role_application(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decline_project_role_application(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_project_role_application(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_project_role_application(uuid, uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
