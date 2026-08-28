GRANT USAGE ON SCHEMA auth TO sandbox_exec;
GRANT SELECT, REFERENCES ON auth.users TO sandbox_exec;
GRANT USAGE ON SCHEMA storage TO sandbox_exec;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES ON storage.objects TO sandbox_exec;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES ON storage.buckets TO sandbox_exec;
GRANT USAGE ON SCHEMA supabase_migrations TO sandbox_exec;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA supabase_migrations TO sandbox_exec;
GRANT USAGE ON SCHEMA extensions TO sandbox_exec;
GRANT anon, authenticated, service_role TO sandbox_exec;