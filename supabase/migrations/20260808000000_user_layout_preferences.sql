-- Personal layout / workspace preferences.
-- Users can arrange dashboard + profile modules (order, size, visibility,
-- pinned) and the arrangement persists per page per user.
--
-- layout is a JSONB document owned entirely by the client:
-- {
--   "v": 1,
--   "items": [{ "i": "projects", "x": 0, "y": 0, "w": 8, "h": 6, "minW": 4, ... }],
--   "hidden": ["trending-skills"],
--   "pinned": ["projects"]
-- }

CREATE TABLE IF NOT EXISTS public.user_layout_preferences (
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  page        text NOT NULL,                        -- 'dashboard' | 'profile'
  layout      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, page)
);

-- Index for fast lookups by page
CREATE INDEX IF NOT EXISTS idx_user_layout_preferences_page ON public.user_layout_preferences(page);

ALTER TABLE public.user_layout_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own layout preferences.
CREATE POLICY "Users can read their own layout preferences"
  ON public.user_layout_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own layout preferences"
  ON public.user_layout_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own layout preferences"
  ON public.user_layout_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own layout preferences"
  ON public.user_layout_preferences FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_layout_preferences TO authenticated;
GRANT ALL ON public.user_layout_preferences TO service_role;
