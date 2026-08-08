-- Server-side GitHub token storage.
--
-- The token NEVER reaches the browser: this table has NO client RLS policies,
-- so the Supabase client cannot read or write it at all. All access goes
-- through TanStack Start server functions running with the service role
-- (src/lib/github-server.ts), which use the stored token to call GitHub on
-- behalf of the signed-in user.

CREATE TABLE IF NOT EXISTS public.user_github_tokens (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_github_tokens ENABLE ROW LEVEL SECURITY;

-- Deliberately NO policies here — the table is invisible to the client.
-- Only the service role (server functions) may touch it.
GRANT ALL ON public.user_github_tokens TO service_role;
