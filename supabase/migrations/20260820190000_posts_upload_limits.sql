-- ============================================================================
-- Community posts upload limits + bucket MIME allowlists.
--
-- Post images are stored as base64 data URLs directly in posts.images — they
-- never touch Supabase Storage, so the storage hardening doesn't cover them.
-- The RLS insert policy only checked author_id; a client could POST unlimited
-- oversized base64 blobs or a javascript: link straight into the DB.
--
-- This migration mirrors the composer's client-side rules server-side:
--   * max 4 images per post, each <= 8 MB raw (base64 ~= 11.2 MB + data: prefix)
--   * body <= 2000 chars (composer slices to MAX_CHARS = 2000)
--   * title <= 500 chars (generous; derived titles are <= 80)
--   * link_url must be http(s) — blocks javascript:/data: hrefs (stored XSS)
--   * image buckets only accept image MIME types (storage-service enforced)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. posts table CHECK constraints
-- ---------------------------------------------------------------------------
-- Immutable helper: images array is valid when it has <= 4 elements and every
-- element is a data:image or http(s) URL under the base64 size cap.
CREATE OR REPLACE FUNCTION public.posts_images_are_valid(p_images text[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _img text;
BEGIN
  IF p_images IS NULL OR cardinality(p_images) > 4 THEN
    RETURN false;
  END IF;
  FOREACH _img IN ARRAY p_images
  LOOP
    IF octet_length(_img) > 12582912 THEN  -- 12 MB (8 MB raw -> base64 + data: prefix)
      RETURN false;
    END IF;
    IF NOT (_img LIKE 'data:image/%' OR _img ~ '^https?://') THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_images_limit
    CHECK (public.posts_images_are_valid(images));

ALTER TABLE public.posts
  ADD CONSTRAINT posts_body_length
    CHECK (char_length(body) <= 2000);

ALTER TABLE public.posts
  ADD CONSTRAINT posts_title_length
    CHECK (char_length(title) <= 500);

-- Blocks javascript:/data: hrefs stored via the API (rendered into <a href>).
ALTER TABLE public.posts
  ADD CONSTRAINT posts_link_url_scheme
    CHECK (link_url IS NULL OR link_url ~ '^https?://');

-- ---------------------------------------------------------------------------
-- 2. allowed_mime_types on image/proof buckets (storage-service enforced)
--    The client always sends an explicit contentType (check.contentType) for
--    these buckets, so the allowlist matches exactly what the app uploads.
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
  SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  WHERE id IN ('avatars', 'banners', 'backgrounds', 'team-avatars');

UPDATE storage.buckets
  SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  WHERE id = 'skill-proofs';
