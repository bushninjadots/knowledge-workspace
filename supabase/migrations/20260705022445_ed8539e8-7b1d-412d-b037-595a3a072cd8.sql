
-- 1. Immutability trigger for connections
CREATE OR REPLACE FUNCTION public.trg_connections_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.requester_id <> OLD.requester_id
     OR NEW.addressee_id <> OLD.addressee_id
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'requester_id, addressee_id and created_at are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS connections_immutable ON public.connections;
CREATE TRIGGER connections_immutable
  BEFORE UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.trg_connections_immutable_fields();

-- 2. Tighten addressee UPDATE policy to only allow valid status transitions
DROP POLICY IF EXISTS "Addressee can respond" ON public.connections;
CREATE POLICY "Addressee can respond"
  ON public.connections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = addressee_id AND status = 'pending')
  WITH CHECK (
    auth.uid() = addressee_id
    AND status IN ('accepted', 'declined')
  );

-- 3. Handle format constraint
UPDATE public.profiles
  SET handle = 'user_' || substr(id::text, 1, 8)
  WHERE handle IS NULL OR handle !~ '^[a-zA-Z0-9_-]{1,30}$';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS handle_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT handle_format
  CHECK (handle ~ '^[a-zA-Z0-9_-]{1,30}$');

-- 4. Public SELECT policy for avatars bucket
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
CREATE POLICY "Public can view avatars"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');
