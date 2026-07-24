-- Seed file: creates a default test user on `supabase start`
-- Email: test@tethyr.com  Password: password123
-- Runs after migrations. Idempotent (ON CONFLICT DO NOTHING).

DO $$
DECLARE
  pw_hash text;
  uid uuid := 'a1d676d3-1a76-401f-bc30-0e4195569e26';
BEGIN
  pw_hash := crypt('password123', gen_salt('bf', 10));

  -- Create auth user
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, confirmation_token, recovery_token, raw_app_meta_data,
    raw_user_meta_data, is_super_admin, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    uid,
    'authenticated', 'authenticated',
    'test@tethyr.com',
    pw_hash,
    now(), now(), now(),
    '', '',
    '{"provider": "email", "providers": ["email"]}',
    '{"display_name": "Test User", "handle": "testuser", "craft": "Development", "email": "test@tethyr.com"}',
    false, false
  ) ON CONFLICT (id) DO NOTHING;

  -- Create identity
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    uid,
    uid,
    'test@tethyr.com',
    jsonb_build_object(
      'sub', uid::text,
      'email', 'test@tethyr.com',
      'email_verified', true,
      'phone_verified', false
    ),
    'email', now(), now(), now()
  ) ON CONFLICT (id) DO NOTHING;

  -- Ensure profile exists
  INSERT INTO public.profiles (id, display_name, handle, category)
  VALUES (uid, 'Test User', 'testuser', 'Development')
  ON CONFLICT (id) DO NOTHING;
END $$;
