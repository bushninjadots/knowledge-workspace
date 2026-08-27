DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'GRANT ALL ON TABLE storage.objects TO sandbox_exec';
    EXECUTE 'GRANT ALL ON TABLE storage.buckets TO sandbox_exec';
  END IF;
END $$;