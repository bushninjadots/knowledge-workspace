-- Add theme_overrides column to pages table.
-- This lets users customize radius/colors/typography without modifying
-- shared theme records (which are read-only for built-in themes).

ALTER TABLE pages ADD COLUMN IF NOT EXISTS theme_overrides jsonb DEFAULT NULL;

COMMENT ON COLUMN pages.theme_overrides IS 'User-customized theme token overrides (radius, colors, typography) merged on top of the base theme tokens.';

-- Allow users to update their own page's theme_overrides.
-- The existing "Owner can update their own pages" RLS policy already covers this.
