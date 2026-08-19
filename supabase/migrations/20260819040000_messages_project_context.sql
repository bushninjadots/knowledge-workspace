-- Messages can carry project context, so a conversation can be "about" a
-- project. The context is optional metadata: read/write access stays governed
-- by the existing "participants of the accepted connection" policies, and the
-- project reference just lets the thread surface what it relates to.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_project ON public.messages(project_id);
