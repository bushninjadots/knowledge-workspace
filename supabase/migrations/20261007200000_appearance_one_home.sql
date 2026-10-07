-- Appearance, one home per audience. Tethyr's own accent and density were set
-- in two places: Settings → Site appearance (profiles.site_appearance) and the
-- profile Appearance dialog (profiles.background.accentMode/.density), and the
-- two fought (the dialog's accent repainted highlights over Site appearance).
-- Site appearance is now the only home; carry each member's visible choice
-- across so nobody's Tethyr changes colour or spacing.
--
-- Accent: a custom dialog accent becomes the Site appearance accent; the
-- dialog's default ("dynamic" = follow the banner) was what members saw on top
-- of any Site appearance accent, so an unset/"Theme" accent becomes "banner".
-- Rows never synced (site_appearance NULL) keep NULL unless there is something
-- non-default to carry: the code default is already "banner".
UPDATE public.profiles AS p
SET site_appearance =
  coalesce(p.site_appearance, '{}'::jsonb)
  || CASE
       WHEN coalesce(p.site_appearance ->> 'accent', '') <> '' THEN '{}'::jsonb
       WHEN p.background ->> 'accentMode' = 'custom'
            AND p.background ->> 'accentColor' ~* '^#[0-9a-f]{6}$'
         THEN jsonb_build_object('accent', lower(p.background ->> 'accentColor'))
       WHEN p.site_appearance IS NOT NULL THEN '{"accent": "banner"}'::jsonb
       ELSE '{}'::jsonb
     END
  || CASE
       WHEN p.background ->> 'density' = 'compact'
            AND coalesce(p.site_appearance ->> 'density', 'comfortable') = 'comfortable'
         THEN '{"density": "compact"}'::jsonb
       ELSE '{}'::jsonb
     END
WHERE p.site_appearance IS NOT NULL
   OR (p.background ->> 'accentMode' = 'custom'
       AND p.background ->> 'accentColor' ~* '^#[0-9a-f]{6}$')
   OR p.background ->> 'density' = 'compact';

-- The profile documents keep only backdrop, header look and card-border
-- choices. accentColor stays: it is the owner's signature colour on project
-- covers in Explore.
UPDATE public.profiles
SET background = background - 'accentMode' - 'density'
WHERE background ?| ARRAY['accentMode', 'density'];

UPDATE public.profiles
SET public_background = public_background - 'accentMode' - 'density'
WHERE public_background ?| ARRAY['accentMode', 'density'];

COMMENT ON COLUMN public.profiles.site_appearance IS
  'Site appearance ({ preset, density, shape, accent ("" | "banner" | #hex), motion }); NULL = never set.';
