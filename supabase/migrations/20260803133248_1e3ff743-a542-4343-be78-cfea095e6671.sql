DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    GRANT CREATE, USAGE ON SCHEMA public TO sandbox_exec;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO sandbox_exec;
    GRANT anon, authenticated, service_role TO sandbox_exec;
  END IF;
END
$$;