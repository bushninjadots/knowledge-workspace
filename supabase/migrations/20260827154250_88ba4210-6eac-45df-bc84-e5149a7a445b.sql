-- Grant sandbox access only when the Lovable sandbox role exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA auth TO sandbox_exec';
    EXECUTE 'GRANT SELECT, REFERENCES ON auth.users TO sandbox_exec';
    EXECUTE 'GRANT USAGE ON SCHEMA storage TO sandbox_exec';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES ON storage.objects TO sandbox_exec';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES ON storage.buckets TO sandbox_exec';
    EXECUTE 'GRANT USAGE ON SCHEMA supabase_migrations TO sandbox_exec';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA supabase_migrations TO sandbox_exec';
    EXECUTE 'GRANT USAGE ON SCHEMA extensions TO sandbox_exec';
    EXECUTE 'GRANT anon, authenticated, service_role TO sandbox_exec';
  END IF;
END $$;