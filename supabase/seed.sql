-- Seed file: creates a default test user on `supabase start`
-- Email: test@tethyr.com  Password: password123
-- Runs after migrations. Idempotent (ON CONFLICT DO NOTHING).

DO $$
DECLARE
  pw_hash text;
  uid uuid := 'a1d676d3-1a76-401f-bc30-0e4195569e26';
BEGIN
  pw_hash := crypt('password123', gen_salt('bf', 10));

  -- Create auth user with ALL required columns for GoTrue v2
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at,
    confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at,
    email_change_token_new, email_change, email_change_sent_at,
    email_change_token_current, email_change_confirm_status,
    phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_anonymous, is_sso_user,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    uid,
    'authenticated', 'authenticated',
    'test@tethyr.com',
    pw_hash,
    now(), NULL,
    '', NULL,
    '', NULL,
    '', '', NULL,
    '', 0,
    NULL, NULL, '', '', NULL,
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"display_name": "Test User", "handle": "testuser", "craft": "Development", "email": "test@tethyr.com"}',
    false, false, false,
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;

  -- Create identity
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    uid, uid, 'test@tethyr.com',
    jsonb_build_object('sub', uid::text, 'email', 'test@tethyr.com', 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  ) ON CONFLICT (id) DO NOTHING;

  -- Ensure profile exists
  INSERT INTO public.profiles (id, display_name, handle, category)
  VALUES (uid, 'Test User', 'testuser', 'Development')
  ON CONFLICT (id) DO NOTHING;
END $$;
