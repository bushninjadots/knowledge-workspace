-- Migration: Poll post type support
-- Adds poll_data column to posts table and extends post_type enum

-- 1. Add poll_data column for storing poll questions and options
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS poll_data jsonb;

-- 2. Add 'poll' to the post_type enum if not already present
ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'poll';

COMMENT ON COLUMN public.posts.poll_data IS
  'JSON object: { question: string, options: string[], votes: { option_index: number, user_id: string }[], ends_at: timestamptz | null }';
