CREATE OR REPLACE FUNCTION public.is_project_visible(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
      AND (
        p.visibility = 'public'
        OR p.profile_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_contributors pc
          WHERE pc.project_id = p.id AND pc.profile_id = auth.uid()
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_project_visible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_project_visible(uuid) TO authenticated, anon;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT 'building',
  ADD COLUMN IF NOT EXISTS collaboration_brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lineage jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_season_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_season_check
  CHECK (season IN ('research', 'prototype', 'feedback', 'launch', 'building'));

CREATE TABLE IF NOT EXISTS public.project_watchers (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

ALTER TABLE public.project_watchers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.project_watchers TO authenticated;
GRANT ALL ON public.project_watchers TO service_role;

DO $$ BEGIN
  CREATE POLICY "Visible projects watchers are readable"
    ON public.project_watchers FOR SELECT TO authenticated
    USING (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_watchers.project_id AND p.visibility = 'public'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can watch visible projects"
    ON public.project_watchers FOR INSERT TO authenticated
    WITH CHECK (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_watchers.project_id
          AND (p.visibility = 'public' OR p.profile_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can stop watching projects"
    ON public.project_watchers FOR DELETE TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS project_watchers_user_idx
  ON public.project_watchers(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.project_visits (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

ALTER TABLE public.project_visits ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.project_visits TO authenticated;
GRANT ALL ON public.project_visits TO service_role;

DO $$ BEGIN
  CREATE POLICY "Users manage their project visits"
    ON public.project_visits FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.project_recognitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_activity_id uuid NOT NULL REFERENCES public.project_activity(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  giver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_activity_id, giver_id, kind)
);

ALTER TABLE public.project_recognitions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.project_recognitions TO authenticated;
GRANT ALL ON public.project_recognitions TO service_role;

DO $$ BEGIN
  CREATE POLICY "Project recognitions are readable"
    ON public.project_recognitions FOR SELECT TO authenticated
    USING (
      giver_id = auth.uid()
      OR recipient_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_recognitions.project_id AND p.visibility = 'public'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users recognize visible project evidence"
    ON public.project_recognitions FOR INSERT TO authenticated
    WITH CHECK (
      giver_id = auth.uid()
      AND giver_id <> recipient_id
      AND EXISTS (
        SELECT 1
        FROM public.project_activity a
        JOIN public.projects p ON p.id = a.project_id
        WHERE a.id = project_recognitions.project_activity_id
          AND a.project_id = project_recognitions.project_id
          AND (p.visibility = 'public' OR p.profile_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users remove their own recognition"
    ON public.project_recognitions FOR DELETE TO authenticated
    USING (giver_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS project_recognitions_activity_idx
  ON public.project_recognitions(project_activity_id);

DO $$ BEGIN
  CREATE POLICY "Contributors can add project evidence"
    ON public.project_activity FOR INSERT TO authenticated
    WITH CHECK (
      actor_id = auth.uid()
      AND kind IN ('contribution', 'weekly_prompt')
      AND EXISTS (
        SELECT 1 FROM public.project_contributors c
        WHERE c.project_id = project_activity.project_id
          AND c.profile_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.profiles.evidence_shelf IS
  'Owner-curated evidence items shown in the public Studio; max 6 items enforced by the client.';
COMMENT ON COLUMN public.projects.collaboration_brief IS
  'Structured contribution brief: need, why_now, contribution_shape, time_shape.';
COMMENT ON COLUMN public.projects.lineage IS
  'Optional project lineage: previous_project_id, next_project_id, label.';

CREATE OR REPLACE FUNCTION public.record_project_evidence_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind IN ('contribution', 'weekly_prompt') AND NEW.actor_id IS NOT NULL THEN
    PERFORM public.log_contribution(
      NEW.actor_id,
      'project_impact',
      CASE WHEN NEW.kind = 'weekly_prompt' THEN 'weekly_show_your_work' ELSE 'project_evidence_added' END,
      CASE WHEN NEW.kind = 'weekly_prompt' THEN 3 ELSE 2 END,
      jsonb_build_object('project_id', NEW.project_id, 'activity_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_evidence_contribution ON public.project_activity;
CREATE TRIGGER trg_project_evidence_contribution
AFTER INSERT ON public.project_activity
FOR EACH ROW EXECUTE FUNCTION public.record_project_evidence_contribution();

CREATE OR REPLACE FUNCTION public.record_project_recognition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_title text;
  _giver_name text;
BEGIN
  SELECT title INTO _project_title FROM public.projects WHERE id = NEW.project_id;
  SELECT COALESCE(display_name, handle) INTO _giver_name FROM public.profiles WHERE id = NEW.giver_id;
  PERFORM public.log_contribution(
    NEW.recipient_id, 'project_impact', 'project_evidence_recognized', 2,
    jsonb_build_object('project_id', NEW.project_id, 'activity_id', NEW.project_activity_id, 'kind', NEW.kind)
  );
  PERFORM public.insert_notification(
    NEW.recipient_id, NEW.giver_id, 'project_recognition',
    COALESCE(_giver_name, 'Someone') || ' recognized your contribution',
    NEW.kind, 'project', NEW.project_id,
    jsonb_build_object('project_title', _project_title, 'recognition_kind', NEW.kind)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_recognition ON public.project_recognitions;
CREATE TRIGGER trg_project_recognition
AFTER INSERT ON public.project_recognitions
FOR EACH ROW EXECUTE FUNCTION public.record_project_recognition();

CREATE TABLE IF NOT EXISTS public.project_needs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  note        text,
  skill_id    uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  urgency     text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high')),
  is_filled   boolean NOT NULL DEFAULT false,
  filled_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_needs_project_idx
  ON public.project_needs (project_id, is_filled, created_at DESC);
CREATE INDEX IF NOT EXISTS project_needs_open_idx
  ON public.project_needs (is_filled, urgency, created_at DESC);
CREATE INDEX IF NOT EXISTS project_needs_skill_idx
  ON public.project_needs (skill_id, is_filled);

ALTER TABLE public.project_needs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Needs viewable on visible projects"
    ON public.project_needs FOR SELECT
    USING (public.is_project_visible(project_id));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Project members can manage needs"
    ON public.project_needs FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_needs.project_id
          AND (
            p.profile_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.project_contributors pc
              WHERE pc.project_id = p.id AND pc.profile_id = auth.uid()
            )
          )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_needs.project_id
          AND (
            p.profile_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.project_contributors pc
              WHERE pc.project_id = p.id AND pc.profile_id = auth.uid()
            )
          )
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

GRANT SELECT ON public.project_needs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_needs TO authenticated;
GRANT ALL ON public.project_needs TO service_role;

CREATE OR REPLACE FUNCTION public.record_project_need_filled_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_filled AND (OLD.is_filled IS DISTINCT FROM TRUE) THEN
    INSERT INTO project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
    VALUES (
      NEW.project_id, NEW.filled_by, 'need_filled',
      'Filled a need: ' || NEW.title, NULL,
      jsonb_build_object('need_id', NEW.id, 'title', NEW.title, 'filled_by', NEW.filled_by),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_activity_need_filled ON public.project_needs;
CREATE TRIGGER trg_project_activity_need_filled
AFTER UPDATE ON public.project_needs
FOR EACH ROW EXECUTE FUNCTION public.record_project_need_filled_activity();

NOTIFY pgrst, 'reload schema';