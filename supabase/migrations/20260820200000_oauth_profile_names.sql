-- ============================================================================
-- OAuth-friendly profile creation.
--
-- The signup form passes display_name/handle/craft through user metadata, but
-- OAuth users never see that form — providers put the name in different keys:
--   Google  -> full_name
--   GitHub  -> user_name / name
--   Apple   -> full_name
--   GitLab  -> name
--   Discord -> full_name / global_name
--
-- Without this, an OAuth sign-in lands on a profile named after the email
-- prefix ("alex@gmail.com" -> "alex"), which reads as a dropped ball. The
-- fallback chain below prefers the app's own metadata, then the provider's
-- name fields, then the email prefix. Handles stay unique (generated) and the
-- user claims their real handle later in settings.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, handle, category)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'user_name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'handle', 'user_' || substr(NEW.id::text, 1, 8)),
    NEW.raw_user_meta_data->>'craft'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
