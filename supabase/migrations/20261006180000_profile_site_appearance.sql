-- Site appearance (how Tethyr itself looks to a member: theme preset,
-- density, shape, accent, motion) follows the member across devices, like
-- notification_preferences. NULL until they first change it; the browser
-- keeps a copy for first paint. Light/dark mode stays per device on purpose.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS site_appearance JSONB;

COMMENT ON COLUMN public.profiles.site_appearance IS
  'Site appearance ({ preset, density, shape, accent, motion }); NULL = never set.';
