-- Phase 6: Challenges schema

CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'skill', -- skill | project | learning
  skills TEXT[] NOT NULL DEFAULT '{}',
  difficulty TEXT NOT NULL DEFAULT 'intermediate', -- beginner | intermediate | advanced
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  max_participants INTEGER,
  status TEXT NOT NULL DEFAULT 'active', -- draft | active | completed | archived
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'joined', -- joined | in_progress | completed
  progress JSONB DEFAULT '{}',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

-- Index for fast status & date filtering
CREATE INDEX IF NOT EXISTS idx_challenges_status_created ON public.challenges(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge ON public.challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user ON public.challenge_participants(user_id);

-- Enable RLS
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT SELECT ON public.challenges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_participants TO authenticated;
GRANT SELECT ON public.challenge_participants TO anon;

-- Policies for challenges
CREATE POLICY "Public read active or completed challenges" ON public.challenges
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users insert challenges" ON public.challenges
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators update challenges" ON public.challenges
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Creators delete challenges" ON public.challenges
  FOR DELETE USING (auth.uid() = created_by);

-- Policies for challenge_participants
CREATE POLICY "Public read participants" ON public.challenge_participants
  FOR SELECT USING (true);

CREATE POLICY "Users insert own participation" ON public.challenge_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own participation" ON public.challenge_participants
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own participation" ON public.challenge_participants
  FOR DELETE USING (auth.uid() = user_id);
