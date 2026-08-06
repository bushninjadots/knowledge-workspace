DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    GRANT anon TO sandbox_exec WITH ADMIN OPTION;
    GRANT authenticated TO sandbox_exec WITH ADMIN OPTION;
    GRANT service_role TO sandbox_exec WITH ADMIN OPTION;
    GRANT REFERENCES, SELECT ON TABLE auth.users TO sandbox_exec;
    GRANT USAGE ON SCHEMA auth, storage TO sandbox_exec;
  END IF;
END
$$;