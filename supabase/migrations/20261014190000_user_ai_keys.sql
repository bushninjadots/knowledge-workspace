-- ============================================================================
-- Bring your own AI key
--
-- A member's own Anthropic API key, for the optional "Explain with AI" step of
-- Code → docs. Same posture as user_github_tokens: RLS on with no client
-- policies — only the server (service role) reads or writes it, the browser
-- never sees the key after it's saved. The member pays their provider
-- directly; Tethyr never bills or stores usage.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_ai_keys (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'anthropic' CHECK (provider IN ('anthropic')),
  api_key text NOT NULL CHECK (char_length(api_key) BETWEEN 20 AND 400),
  model text NOT NULL DEFAULT 'claude-opus-4-8' CHECK (model ~ '^[a-z0-9.-]{3,60}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_ai_keys ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_ai_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.user_ai_keys TO service_role;
