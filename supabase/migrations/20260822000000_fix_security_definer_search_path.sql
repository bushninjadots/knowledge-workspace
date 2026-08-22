-- Security advisor: function_search_path_mutable
--
-- SECURITY DEFINER functions must pin a fixed search_path so a caller can't
-- influence which objects (functions, tables, operators) the function body
-- resolves. Without it, a user who can create objects in an earlier schema
-- could shadow names inside the function and escalate privileges.
--
-- All other SECURITY DEFINER functions in this project already set
-- `search_path = public`. These four were the stragglers:
--   * is_session_organizer(uuid)            — orphaned 1-arg duplicate, dropped
--   * is_session_organizer(uuid, uuid)      — used by sessions RLS policies
--   * is_session_participant(uuid, uuid)    — used by sessions RLS policies
--   * is_space_owner(uuid, uuid)            — used by community space policies

-- Drop the dead 1-arg duplicate (no policy, trigger, or client references it).
DROP FUNCTION IF EXISTS public.is_session_organizer(uuid);

ALTER FUNCTION public.is_session_organizer(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.is_session_participant(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.is_space_owner(uuid, uuid) SET search_path = public;
