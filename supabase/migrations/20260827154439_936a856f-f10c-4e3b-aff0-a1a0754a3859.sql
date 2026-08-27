DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'GRANT REFERENCES ON TABLE auth.users TO sandbox_exec';
  END IF;
END $$;