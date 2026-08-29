-- Local development guard: the Lovable sandbox environment pre-creates a
-- `sandbox_exec` role that later migrations grant privileges to. When running
-- the stack locally (supabase start) the role does not exist, so the
-- unguarded GRANTs in 20260827154250+ fail. Create it here when missing; this
-- is a no-op in environments where the role already exists.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    CREATE ROLE sandbox_exec;
  END IF;
END
$$;
