GRANT SELECT, REFERENCES ON TABLE auth.users TO sandbox_exec;
GRANT USAGE ON SCHEMA auth, storage TO sandbox_exec;
GRANT ALL ON TABLE storage.objects TO sandbox_exec;
GRANT ALL ON TABLE storage.buckets TO sandbox_exec;