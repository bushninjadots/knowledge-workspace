-- Per-category notification mute preferences, stored as JSON on the profile so
-- they follow the member across devices. The owner-update RLS policy on
-- profiles already covers writes; reads are the owner's own row.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{"mutedCategories": []}'::jsonb;

COMMENT ON COLUMN public.profiles.notification_preferences IS
  'Per-category notification preferences ({ mutedCategories: NotificationCategory[] }).';
