
DO $$ BEGIN
  CREATE TYPE public.connection_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.connection_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connections_no_self CHECK (requester_id <> addressee_id),
  CONSTRAINT connections_unique_pair UNIQUE (requester_id, addressee_id)
);

CREATE INDEX connections_addressee_idx ON public.connections (addressee_id, status);
CREATE INDEX connections_requester_idx ON public.connections (requester_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own connections"
  ON public.connections FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users send their own requests"
  ON public.connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Addressee can respond"
  ON public.connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

CREATE POLICY "Either party can delete"
  ON public.connections FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE TRIGGER connections_updated_at
  BEFORE UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Activity log
CREATE OR REPLACE FUNCTION public.trg_log_connection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity(NEW.requester_id, 'connection_requested',
      jsonb_build_object('addressee_id', NEW.addressee_id));
    PERFORM public.log_activity(NEW.addressee_id, 'connection_received',
      jsonb_build_object('requester_id', NEW.requester_id));
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    IF NEW.status = 'accepted' THEN
      PERFORM public.log_activity(NEW.addressee_id, 'connection_accepted',
        jsonb_build_object('requester_id', NEW.requester_id));
      PERFORM public.log_activity(NEW.requester_id, 'connection_accepted',
        jsonb_build_object('addressee_id', NEW.addressee_id));
    ELSIF NEW.status = 'declined' THEN
      PERFORM public.log_activity(NEW.requester_id, 'connection_declined',
        jsonb_build_object('addressee_id', NEW.addressee_id));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER connections_log_change
  AFTER INSERT OR UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_connection();
