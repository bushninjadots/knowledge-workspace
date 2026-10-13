-- Space identity: let a space's owner make it their own place — a banner and
-- picture, a one-line tagline, a longer "About", a colour, topics, links and
-- a welcome note for people who join. Every field is bounded here, not just
-- in the UI, since owners write the row directly under RLS ("Only creator can
-- update spaces" — unchanged).
--
-- Images are paths in the existing `avatars` / `banners` buckets under the
-- owner's own folder, so the existing storage policies already cover upload
-- (owner only) and viewing (everyone).

ALTER TABLE public.community_spaces
  ADD COLUMN tagline text,
  ADD COLUMN about text,
  ADD COLUMN banner_url text,
  ADD COLUMN accent_color text,
  ADD COLUMN topics text[] NOT NULL DEFAULT '{}',
  ADD COLUMN links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN welcome_message text;

-- Validates one link list: an array of at most five {label, url} objects with
-- short labels and http(s) URLs. IMMUTABLE so it can back a CHECK.
CREATE FUNCTION public.space_links_valid(p_links jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_typeof(p_links) = 'array'
    AND jsonb_array_length(p_links) <= 5
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_links) AS item
      WHERE jsonb_typeof(item) <> 'object'
         OR coalesce(length(item ->> 'label'), 0) NOT BETWEEN 1 AND 40
         OR coalesce(item ->> 'url', '') !~* '^https?://[^\s]{3,}$'
         OR length(item ->> 'url') > 300
    );
$$;

-- Same idea for topics: at most eight, each 1–30 characters.
CREATE FUNCTION public.space_topics_valid(p_topics text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(cardinality(p_topics), 0) <= 8
    AND NOT EXISTS (
      SELECT 1 FROM unnest(p_topics) AS topic
      WHERE length(btrim(topic)) NOT BETWEEN 1 AND 30
    );
$$;

ALTER TABLE public.community_spaces
  ADD CONSTRAINT community_spaces_tagline_length CHECK (tagline IS NULL OR length(tagline) <= 80),
  ADD CONSTRAINT community_spaces_about_length CHECK (about IS NULL OR length(about) <= 4000),
  ADD CONSTRAINT community_spaces_welcome_length
    CHECK (welcome_message IS NULL OR length(welcome_message) <= 500),
  ADD CONSTRAINT community_spaces_accent_hex
    CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9a-fA-F]{6}$'),
  ADD CONSTRAINT community_spaces_topics_valid CHECK (public.space_topics_valid(topics)),
  ADD CONSTRAINT community_spaces_links_valid CHECK (public.space_links_valid(links)),
  ADD CONSTRAINT community_spaces_image_paths
    CHECK (
      (avatar_url IS NULL OR length(avatar_url) <= 300)
      AND (banner_url IS NULL OR length(banner_url) <= 300)
    );

-- CHECK constraints run their functions as the writing role, so owners
-- (authenticated) need EXECUTE; nobody else does.
REVOKE ALL ON FUNCTION public.space_links_valid(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.space_topics_valid(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.space_links_valid(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.space_topics_valid(text[]) TO authenticated;
